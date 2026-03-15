#!/usr/bin/env python3
"""
OMEGA ↔ Llama Bridge

Coordinates OMEGA's behavioral decisions with Llama's language generation.

Flow:
    1. Customer text comes in
    2. OMEGA's trained CryoLiquidLayer produces a behavioral phase vector
    3. BehavioralCodebook decodes which behavior + confidence
    4. This module maps decoded behavior + associated data → structured instruction
    5. Structured instruction is sent to Llama as system context
    6. Llama generates natural language response

OMEGA decides WHAT to do. Llama decides HOW to say it.

The knowledge base (menu, prices, SOP) is loaded into this module.
When OMEGA decodes "take_order" for a Big Mac, this module looks up:
  price=$5.69, meal_price=$8.99, allergens=[wheat, soy, milk, sesame], etc.
and formats it into a precise instruction for Llama.
"""

import json
import logging
import requests
from typing import Dict, Any, Optional, List, Tuple
from pathlib import Path

logger = logging.getLogger('llama_bridge')

OLLAMA_URL = "http://localhost:11434"
DEFAULT_MODEL = "llama3.2:1b"


class LlamaBridge:
    """
    Bridges OMEGA behavioral decisions to Llama language generation.

    OMEGA provides: behavior type, confidence, associated data
    This module provides: structured instruction with menu/price knowledge
    Llama provides: natural language response
    """

    def __init__(self, knowledge_base: Dict[str, Any], model: str = DEFAULT_MODEL):
        self.kb = knowledge_base
        self.model = model
        self.menu_index = self._build_menu_index()
        self.order_state: List[Dict[str, Any]] = []
        self.running_total: float = 0.0

    def _build_menu_index(self) -> Dict[str, Dict[str, Any]]:
        """Index all menu items by name (lowercase) for fast lookup."""
        index = {}

        def _strip(name: str) -> str:
            """Normalize name: lowercase, strip ® ™ * symbols."""
            return name.lower().replace('®', '').replace('™', '').replace('*', '').strip()

        # Legacy format: top-level 'menu' dict { category: [items] }
        for category, items in self.kb.get('menu', {}).items():
            if isinstance(items, list):
                for item in items:
                    name = _strip(item.get('name', ''))
                    item['_category'] = category
                    index[name] = item

        # Current format: 'tabs' → categories → items
        for tab in self.kb.get('tabs', []):
            for cat in tab.get('categories', []):
                cat_label = cat.get('label', cat.get('id', ''))
                for item in cat.get('items', []):
                    name = _strip(item.get('name', ''))
                    item['_category'] = cat_label
                    index[name] = item

        return index

    def find_menu_item(self, query: str) -> Optional[Dict[str, Any]]:
        """Fuzzy match a menu item by name."""
        q = query.lower().replace('®', '').replace('™', '').replace('*', '').strip()
        # Exact match
        if q in self.menu_index:
            return self.menu_index[q]
        # Partial match
        for name, item in self.menu_index.items():
            if q in name or name in q:
                return item
        return None

    def add_to_order(self, item_name: str, quantity: int = 1,
                     is_meal: bool = False, customizations: List[str] = None,
                     drink: str = None, sauce: str = None) -> Dict[str, Any]:
        """Add an item to the current order and track running total."""
        item = self.find_menu_item(item_name)
        if not item:
            return {"error": f"Item not found: {item_name}"}

        if is_meal and item.get('meal_price'):
            price = item['meal_price']
        elif isinstance(item.get('price'), dict):
            price = item['price'].get('medium', list(item['price'].values())[0])
        elif isinstance(item.get('prices'), dict):
            price = item['prices'].get('medium', list(item['prices'].values())[0])
        else:
            price = item.get('price', 0)

        entry = {
            "item": item.get('name', item_name),
            "quantity": quantity,
            "is_meal": is_meal,
            "unit_price": price,
            "line_total": price * quantity,
            "customizations": customizations or [],
            "drink": drink,
            "sauce": sauce,
        }
        self.order_state.append(entry)
        self.running_total += entry['line_total']
        return entry

    def get_order_summary(self) -> str:
        """Format current order as readable text."""
        if not self.order_state:
            return "No items in order."
        lines = []
        for i, entry in enumerate(self.order_state, 1):
            desc = f"{entry['quantity']}x {entry['item']}"
            if entry['is_meal']:
                desc += " meal"
            if entry['drink']:
                desc += f" with {entry['drink']}"
            if entry['customizations']:
                desc += f" ({', '.join(entry['customizations'])})"
            if entry['sauce']:
                desc += f" + {entry['sauce']} sauce"
            desc += f" — ${entry['line_total']:.2f}"
            lines.append(f"  {i}. {desc}")
        lines.append(f"\n  Subtotal: ${self.running_total:.2f}")
        return "\n".join(lines)

    def clear_order(self):
        """Reset order state."""
        self.order_state = []
        self.running_total = 0.0

    def build_llama_instruction(
        self,
        behavior: str,
        confidence: float,
        target_data: Dict[str, Any],
        customer_text: str,
    ) -> str:
        """
        Build a precise instruction for Llama based on OMEGA's behavioral decision.

        This is NOT a generic system prompt. It's a specific behavioral instruction
        derived from OMEGA's trained phase pattern + the knowledge base.

        Args:
            behavior: Decoded behavior type from OMEGA
            confidence: OMEGA's confidence in the behavior classification
            target_data: Associated data from training (items, prices, etc.)
            customer_text: The original customer text

        Returns:
            Structured instruction string for Llama's system prompt
        """
        sop = self.kb.get('sops', self.kb.get('sop', {}))
        ops_rules = self.kb.get('operational_rules', {})
        combo_rules = sop.get('combo_handling', {})
        order_summary = self.get_order_summary()

        base_instruction = (
            "You are a friendly McDonald's drive-thru worker taking an order over a speaker. "
            "VOICE-ONLY — the customer HEARS your reply spoken aloud.\n"
            "ABSOLUTE RULES:\n"
            "- MAX 1-2 short sentences. Never exceed 20 words total.\n"
            "- Sound natural and human, like a real employee. Use casual phrasing.\n"
            "- NEVER start with 'Sure!', 'Great choice!', 'Absolutely!', 'Here\'s my response', or any filler.\n"
            "- NEVER list ingredients, options, or menu items unless explicitly asked.\n"
            "- NEVER read back the order or list what they've ordered so far — save that for when they're DONE ordering.\n"
            "- NEVER repeat the item name and price together after a combo upgrade — just confirm and move on.\n"
            "- After adding an item that has NO meal/combo option: just say 'Anything else?'\n"
            "- If the item HAS a meal option and the customer did NOT already say 'meal' or 'combo': you MUST ask 'Want to make that a combo for $X.XX?' using the exact MEAL PRICE.\n"
            "- Use EXACT prices from the data below. Never guess or calculate.\n"
            "- Examples of good responses: 'Want to make that a combo for $8.99?' / 'Got it. Anything else?' / 'What drink with that?' / 'Combo it is. What to drink?'\n\n"
        )

        if behavior == "greet":
            return (
                base_instruction +
                "BEHAVIOR: Greet the customer.\n"
                "INSTRUCTION: Welcome them warmly and ask what they'd like to order.\n"
                f"Example greetings: {json.dumps(sop.get('greeting', []))}\n"
            )

        elif behavior == "take_order":
            item_data = target_data.get('item', '')
            item_not_found = target_data.get('item_not_found', False)
            item_info = self.find_menu_item(item_data) if item_data else None

            instruction = base_instruction + "BEHAVIOR: Take order.\n"

            if item_not_found:
                # Customer asked for something NOT on the McDonald's menu
                instruction += (
                    f"Customer asked for: {customer_text}\n"
                    "ITEM NOT AVAILABLE: The item the customer requested is NOT on our menu.\n"
                    "INSTRUCTION: Politely tell them we don't carry that item. "
                    "Do NOT add anything to the order. Do NOT suggest random items. "
                    "Just say something like 'Sorry, we don't have that. What else can I get you?' "
                    "Keep it to one short sentence.\n"
                )
            elif item_info:
                price = item_info.get('price', 'unknown')
                meal_price = item_info.get('meal_price')
                ingredients = item_info.get('default_ingredients', [])
                customizable = item_info.get('customizable', [])

                instruction += f"ITEM ORDERED: {item_info['name']}\n"

                if meal_price:
                    instruction += (
                        f"PRICE: ${price} | MEAL: ${meal_price}\n"
                        f"INSTRUCTION: Ask if they want the combo. Say EXACTLY something like: "
                        f"'Want to make that a combo for ${meal_price}?'\n"
                        f"DO NOT say 'Anything else?' — ask about the combo FIRST.\n"
                    )
                else:
                    instruction += (
                        f"PRICE: ${price}\n"
                        "INSTRUCTION: Say 'Got it. Anything else?'\n"
                    )

                sauce_choices = item_info.get('sauce_choices', [])
                if sauce_choices:
                    instruction += f"SAUCE OPTIONS: {', '.join(sauce_choices)}\n"
                    instruction += "Also ask which sauce(s) they'd like.\n"
            else:
                instruction += (
                    f"Customer asked for: {customer_text}\n"
                    "INSTRUCTION: The item wasn't recognized. Ask the customer to clarify what they'd like. "
                    "Do NOT guess or add random items.\n"
                )

            if self.order_state:
                instruction += f"\nCURRENT ORDER:\n{order_summary}\n"

            return instruction

        elif behavior == "combo_entree_swap":
            to_item = target_data.get('to_item', '')
            item_info = self.find_menu_item(to_item) if to_item else None
            instruction = (
                base_instruction +
                "BEHAVIOR: Customer wants to swap the main sandwich in their combo.\n"
                f"NEW SANDWICH: {to_item}\n"
            )
            if item_info:
                instruction += f"NEW ITEM PRICE: ${item_info.get('price', '?')}\n"
                if item_info.get('meal_price'):
                    instruction += f"NEW MEAL PRICE: ${item_info['meal_price']}\n"
            instruction += (
                f"SOP: {combo_rules.get('combo_entree_swap', '')}\n"
                "INSTRUCTION: Confirm the swap. Ask if they want to keep fries and drink as a combo. "
                "Example: 'Changed to a [item]. Keep the fries and drink as a meal?'\n"
            )
            return instruction

        elif behavior == "split_size_selection":
            drink_size = target_data.get('drink_size', 'medium')
            fries_size = target_data.get('fries_size', 'medium')
            instruction = (
                base_instruction +
                "BEHAVIOR: Customer wants different sizes for combo components.\n"
                f"DRINK SIZE: {drink_size}\n"
                f"FRIES SIZE: {fries_size}\n"
                f"SOP: {combo_rules.get('split_size_selection', '')}\n"
                f"SIZE DEFAULTS: {combo_rules.get('size_defaults', 'Combos default to Medium.')}\n"
            )
            # Calculate upcharges
            upcharges = []
            if fries_size == 'large':
                upcharges.append('Large fries +$0.70')
            if drink_size == 'large':
                upcharges.append('Large drink +$0.30')
            if upcharges:
                instruction += f"UPCHARGES: {', '.join(upcharges)}\n"
            instruction += (
                "INSTRUCTION: Confirm the split sizes. Mention any upcharges. "
                "Example: 'Got it — large fries and small drink. That's an extra $0.70. Anything else?'\n"
            )
            return instruction

        elif behavior == "meal_substitution":
            from_item = target_data.get('from', '')
            to_item = target_data.get('to', '')
            instruction = (
                base_instruction +
                "BEHAVIOR: Customer wants to substitute a combo component.\n"
                f"REPLACING: {from_item}\n"
                f"WITH: {to_item}\n"
                f"SOP: {combo_rules.get('meal_substitution', '')}\n"
            )
            # Check for upcharge items
            sub_info = self.find_menu_item(to_item)
            if sub_info and to_item.lower() != 'apple slices':
                instruction += "NOTE: This substitution may have an upcharge.\n"
            else:
                instruction += "NOTE: Apple slices substitute at no extra charge.\n"
            instruction += (
                "INSTRUCTION: Confirm the substitution. Mention upcharge if applicable. "
                "Example: 'Swapped fries for apple slices, no extra charge. Anything else?'\n"
            )
            return instruction

        elif behavior == "customize":
            mods = target_data.get('modifications', [target_data.get('modification', '')])
            upcharge = target_data.get('upcharge', 0)
            instruction = (
                base_instruction +
                f"BEHAVIOR: Customize order.\n"
                f"MODIFICATIONS: {', '.join(mods)}\n"
            )
            if upcharge > 0:
                instruction += f"UPCHARGE: +${upcharge:.2f}\n"
            instruction += "INSTRUCTION: Confirm the customization. Repeat back the modification.\n"
            return instruction

        elif behavior == "order_complete":
            return (
                base_instruction +
                "BEHAVIOR: Customer is done ordering.\n"
                f"CURRENT ORDER:\n{order_summary}\n"
                f"TOTAL: ${self.running_total:.2f}\n"
                "INSTRUCTION: Read back the complete order with all items, "
                "quantities, and customizations. State the total. "
                "Ask 'Does that look right?'\n"
                f"Confirmation format: {sop.get('confirmation_format', '')}\n"
            )

        elif behavior == "order_confirmed":
            return (
                base_instruction +
                "BEHAVIOR: Order confirmed by customer.\n"
                f"TOTAL: ${self.running_total:.2f}\n"
                "INSTRUCTION: Ask for payment method — 'Will that be cash, card, or mobile pay?'\n"
            )

        elif behavior == "payment":
            method = target_data.get('method', 'card')
            return (
                base_instruction +
                f"BEHAVIOR: Payment.\n"
                f"METHOD: {method}\n"
                f"TOTAL: ${self.running_total:.2f}\n"
                "INSTRUCTION: Thank the customer and let them know their order will be ready shortly.\n"
                f"Closing options: {json.dumps(sop.get('closing', []))}\n"
            )

        elif behavior == "menu_inquiry":
            item_name = target_data.get('item', '')
            item_info = self.find_menu_item(item_name) if item_name else None
            instruction = base_instruction + "BEHAVIOR: Menu question.\n"
            if item_info:
                instruction += f"ITEM: {json.dumps(item_info, default=str)}\n"
            instruction += f"CUSTOMER ASKED: {customer_text}\n"
            instruction += "INSTRUCTION: Answer using ONLY the menu data provided. Be accurate.\n"
            return instruction

        elif behavior == "price_inquiry":
            items = target_data.get('items', [])
            item_name = target_data.get('item', '')
            instruction = base_instruction + "BEHAVIOR: Price question.\n"
            if items:
                for it in items:
                    instruction += f"  - {it.get('item', '')}: ${it.get('price', '?')}\n"
            elif item_name:
                item_info = self.find_menu_item(item_name)
                if item_info:
                    instruction += f"PRICE: ${item_info.get('price', '?')}\n"
                    if item_info.get('meal_price'):
                        instruction += f"MEAL PRICE: ${item_info['meal_price']}\n"
            instruction += f"CUSTOMER ASKED: {customer_text}\n"
            instruction += "INSTRUCTION: Quote the EXACT prices listed above. Do not estimate.\n"
            return instruction

        elif behavior == "nutrition_inquiry":
            item_name = target_data.get('item', '')
            calories = target_data.get('calories', '')
            return (
                base_instruction +
                f"BEHAVIOR: Nutrition question.\n"
                f"ITEM: {item_name}\n"
                f"CALORIES: {calories}\n"
                f"CUSTOMER ASKED: {customer_text}\n"
                "INSTRUCTION: State the exact calorie count. Mention nutritional info is available on mcdonalds.com.\n"
            )

        elif behavior in ("allergen_alert", "allergen_inquiry"):
            allergen = target_data.get('allergen', '')
            safe = target_data.get('safe_items', [])
            avoid = target_data.get('avoid_items', [])
            policy = self.kb.get('allergen_policy', {})
            return (
                base_instruction +
                f"BEHAVIOR: Allergen concern.\n"
                f"ALLERGEN: {allergen}\n"
                f"SAFE OPTIONS: {', '.join(safe)}\n"
                f"ITEMS TO AVOID: {', '.join(avoid)}\n"
                f"CROSS-CONTAMINATION WARNING: {policy.get('cross_contamination_warning', '')}\n"
                "INSTRUCTION: Take the allergen concern seriously. List safe options. "
                "Warn about cross-contamination. Never say 'everything is safe.'\n"
            )

        elif behavior == "dietary_inquiry":
            diet = target_data.get('diet', '')
            options = target_data.get('options', [])
            return (
                base_instruction +
                f"BEHAVIOR: Dietary question.\n"
                f"DIET: {diet}\n"
                f"AVAILABLE OPTIONS: {', '.join(options)}\n"
                "INSTRUCTION: List the available options for their diet. Be helpful.\n"
            )

        elif behavior == "complaint":
            complaint_type = target_data.get('type', 'general')
            issue = target_data.get('issue', '')
            resolution = target_data.get('resolution', '')
            instruction = base_instruction + "BEHAVIOR: Handle complaint.\n"
            if complaint_type == 'escalation':
                instruction += (
                    f"ESCALATION POLICY: {ops_rules.get('ESCALATION_SAFETY', '')}\n"
                    "INSTRUCTION: Stay calm. Tell the customer you're getting a manager. "
                    "Do NOT argue or engage further. Example: 'Let me get my manager for you right away.'\n"
                )
            elif complaint_type == 'refund':
                instruction += (
                    f"REFUND POLICY: {ops_rules.get('REFUNDS', '')}\n"
                    "INSTRUCTION: Apologize and direct them to the window for resolution. "
                    "Example: 'I'm sorry about that. Please pull to the window and we'll take care of it.'\n"
                )
            else:
                instruction += (
                    f"ISSUE: {issue}\n"
                    f"RESOLUTION: {resolution}\n"
                    "INSTRUCTION: Apologize sincerely. Offer to fix it immediately. "
                    "Never blame the customer.\n"
                )
            return instruction

        else:
            return (
                base_instruction +
                f"BEHAVIOR: {behavior}\n"
                f"CUSTOMER SAID: {customer_text}\n"
                f"DATA: {json.dumps(target_data)}\n"
                "INSTRUCTION: Respond helpfully as a McDonald's order taker.\n"
            )

    def generate_response(
        self,
        behavior: str,
        confidence: float,
        target_data: Dict[str, Any],
        customer_text: str,
        conversation_history: List[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        """
        Generate a full response using OMEGA's behavior decision + Llama.

        Returns response text plus metadata showing what OMEGA decided
        and what instruction was sent to Llama.
        """
        # Build the structured instruction from OMEGA's decision
        instruction = self.build_llama_instruction(
            behavior, confidence, target_data, customer_text
        )

        # ALWAYS inject the full cumulative order so Llama knows exact order state
        if self.order_state:
            instruction += (
                "\n--- FULL CURRENT ORDER (authoritative) ---\n"
                f"{self.get_order_summary()}\n"
                f"RUNNING TOTAL: ${self.running_total:.2f}\n"
                "--- END ORDER ---\n"
            )
        else:
            instruction += "\n--- ORDER IS EMPTY ---\n"

        # Call Llama via Ollama
        try:
            llama_response = self._call_ollama(
                instruction, customer_text,
                conversation_history=conversation_history or [],
            )
        except Exception as e:
            logger.error(f"Ollama call failed: {e}")
            llama_response = f"[Llama unavailable: {e}]"

        return {
            "response": llama_response,
            "omega_behavior": behavior,
            "omega_confidence": round(confidence, 4),
            "omega_instruction": instruction,
            "target_data": target_data,
            "order_state": [e.copy() for e in self.order_state],
            "running_total": round(self.running_total, 2),
        }

    def generate_raw_llama_response(self, customer_text: str) -> str:
        """
        Generate a response using ONLY Llama — no OMEGA.

        This is the "control group" to prove OMEGA is adding value.
        Llama gets a generic system prompt with NO specific prices or SOP.
        """
        generic_prompt = (
            "You are a McDonald's order-taking assistant. "
            "Help the customer with their order."
        )
        try:
            return self._call_ollama(generic_prompt, customer_text)
        except Exception as e:
            return f"[Llama unavailable: {e}]"

    def _call_ollama(self, system_prompt: str, user_message: str,
                      conversation_history: List[Dict[str, str]] = None) -> str:
        """Call Ollama API for text generation with conversation history."""
        messages = [{"role": "system", "content": system_prompt}]

        # Include conversation history for context-aware responses
        if conversation_history:
            for msg in conversation_history[-10:]:  # Last 10 messages max
                role = "user" if msg.get("role") == "customer" else "assistant"
                messages.append({"role": role, "content": msg.get("text", "")})

        messages.append({"role": "user", "content": user_message})

        payload = {
            "model": self.model,
            "messages": messages,
            "stream": False,
            "options": {
                "temperature": 0.6,
                "num_predict": 60,
                "top_p": 0.9,
                "repeat_penalty": 1.2,
            }
        }

        resp = requests.post(
            f"{OLLAMA_URL}/api/chat",
            json=payload,
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()
        return data.get("message", {}).get("content", "")

    def check_ollama(self) -> bool:
        """Check if Ollama is running and the model is available."""
        try:
            resp = requests.get(f"{OLLAMA_URL}/api/tags", timeout=5)
            if resp.status_code == 200:
                models = [m['name'] for m in resp.json().get('models', [])]
                return any(self.model in m for m in models)
            return False
        except Exception:
            return False
