#!/usr/bin/env python3
"""
Round 2 boost: Hard-negative examples for the 5 remaining behaviors below 97%.
Each example is designed to be UNAMBIGUOUSLY its labeled behavior.

Confusion patterns to break:
  menu_inquiry (92.6%) ← confused with time_check, price_inquiry, value_recommendation
  take_order (94.7%)   ← confused with order_modify, price_inquiry
  value_recommendation (94.9%) ← confused with price_inquiry, menu_inquiry
  order_modify (96.1%) ← confused with take_order
  price_inquiry (96.1%) ← confused with menu_inquiry
"""

import json, random
from pathlib import Path
from collections import Counter

DATASET_PATH = Path(__file__).parent / 'mcdonalds-behavioral-training.jsonl'

def make(text, behavior):
    return {'input': text.strip(), 'behavior': behavior, 'target_action': behavior,
            'target_data': {}, 'expected_response_contains': [], 'context': None}

F = ['', 'um ', 'uh ', 'hey ', 'yo ', 'like ', 'so ', 'ok ', 'hmm ',
     'actually ', 'wait ', 'oh ', 'yeah ', 'alright ']
S = ['', ' please', ' thanks', ' real quick', ' bro', ' for me', ' today']

# ═══════════════════════════════════════════════════════════════
# 1. menu_inquiry — PURE "what items exist" questions
#    NO time words, NO price words, NO recommendation words
# ═══════════════════════════════════════════════════════════════
MENU_INQUIRY = [
    "what burgers do you have",
    "what chicken sandwiches are on the menu",
    "do you have fish sandwiches",
    "do you have wraps",
    "do you serve breakfast burritos",
    "what comes on a Big Mac",
    "what's in a Quarter Pounder",
    "what toppings are on the McChicken",
    "what sides do you have",
    "do you have onion rings",
    "do you have mozzarella sticks",
    "what desserts do you have",
    "do you have cookies",
    "do you have ice cream",
    "what flavors of McFlurry do you have",
    "what shake flavors do you have",
    "do you have strawberry shakes",
    "what drinks do you serve",
    "do you have lemonade",
    "do you have iced coffee",
    "do you have hot chocolate",
    "what's on the kids menu",
    "what toys are in the Happy Meal",
    "what comes in a Happy Meal",
    "what nugget options do you have",
    "do you have 4 piece nuggets",
    "do you have 40 piece nuggets",
    "what sauces do you have",
    "do you have buffalo sauce",
    "do you have ranch",
    "do you have honey mustard",
    "what kind of fries do you serve",
    "do you have curly fries",
    "do you have sweet potato fries",
    "what breakfast items do you have",
    "do you have pancakes",
    "do you serve oatmeal",
    "what's on the value menu",
    "what sandwiches do you have",
    "do you have a grilled chicken sandwich",
    "what salads are on the menu",
    "do you have any vegetarian items",
    "do you have a veggie burger",
    "do you serve fruit",
    "what McCafe drinks do you serve",
    "do you have espresso",
    "what size options are there for drinks",
    "do you have apple juice",
    "what's in a number 1 combo",
    "what's in a number 5 combo",
    "tell me what combos you have",
    "read me the burger menu",
    "show me the chicken options",
    "list all your sandwich options",
    "what items are on the breakfast menu",
    "do you carry McRibs",
    "is the McRib on the menu",
    "what are the combo options",
    "what comes with a combo meal",
    "do combos come with a drink and fries",
]

# ═══════════════════════════════════════════════════════════════
# 2. take_order — PURE first-order "I want X" language
#    NO "add to", "also", "throw in", "change", "modify"
# ═══════════════════════════════════════════════════════════════
TAKE_ORDER = [
    "I want a Big Mac",
    "I'll have a Quarter Pounder",
    "give me a number 1",
    "let me get a McChicken",
    "can I get a 10 piece nuggets",
    "I'd like a Filet-O-Fish",
    "I want a large fries",
    "I'll take a chocolate shake",
    "give me a McFlurry",
    "let me get a Happy Meal",
    "can I order a number 3",
    "I'd like the double cheeseburger",
    "I want the spicy chicken sandwich",
    "I'll have a McDouble",
    "give me a crispy chicken sandwich",
    "let me get a bacon cheeseburger",
    "can I get a fish sandwich",
    "I'd like an apple pie",
    "I want two cheeseburgers",
    "I'll have three McChickens",
    "give me a large Coke",
    "let me get a sweet tea",
    "can I get a coffee",
    "I'd like a Sprite",
    "I want a Dr Pepper",
    "I'll have a vanilla cone",
    "give me a sundae",
    "let me get a hash brown",
    "can I get a sausage McMuffin",
    "I'd like an Egg McMuffin",
    "I want a number 7 combo",
    "I'll have the chicken nugget meal",
    "give me a medium fries",
    "let me get a small fries",
    "can I get a 20 piece",
    "I'd like a Big Mac meal",
    "I want a Quarter Pounder meal",
    "I'll have the 2 for deal",
    "give me two Big Macs",
    "let me get the family bundle",
    "I'll order a large sweet tea",
    "can I get a caramel frappe",
    "I'd like a McGriddle",
    "I want the sausage biscuit combo",
    "I'll take a hotcakes platter",
    "give me a bacon egg and cheese biscuit",
    "let me get a chicken biscuit",
    "can I get the steak bagel",
    "I want a fruit and yogurt parfait",
    "I'd like an orange juice",
]

# ═══════════════════════════════════════════════════════════════
# 3. value_recommendation — PURE advice-seeking
#    NO price words, NO "how much", NO menu listing words
# ═══════════════════════════════════════════════════════════════
VALUE_RECOMMENDATION = [
    "what do you recommend",
    "what would you suggest",
    "what's your best item",
    "what should I try",
    "what's the most popular thing",
    "what do most people order",
    "what's your number one seller",
    "what's the best burger here",
    "which sandwich is the best",
    "what's your favorite menu item",
    "if you could only get one thing what would it be",
    "what should a first timer order",
    "I've never been here before what's good",
    "what do you recommend for lunch",
    "what's the best combo to get",
    "I can't decide help me pick",
    "just pick something good for me",
    "surprise me with something tasty",
    "what's the best thing for a hungry person",
    "I want something filling what should I get",
    "what's the most satisfying meal",
    "which nugget meal is the best",
    "is the Big Mac or Quarter Pounder better",
    "which chicken sandwich do you recommend",
    "what's better the McChicken or the crispy chicken",
    "should I get a McFlurry or a shake",
    "what's the best breakfast item",
    "what do kids usually like",
    "what's the best Happy Meal option",
    "I'm feeling adventurous what should I try",
    "what's your hidden gem on the menu",
    "what's underrated here",
    "give me your honest recommendation",
    "what would you eat if you worked here",
    "I want something new what should I get",
    "talk me into something",
    "what's the fan favorite",
    "what's trending right now",
    "what do regulars usually get",
    "what's your go-to order",
]

# ═══════════════════════════════════════════════════════════════
# 4. order_modify — PURE "change my existing order" language
#    MUST reference existing order: "my order", "that", "change", "remove"
# ═══════════════════════════════════════════════════════════════
ORDER_MODIFY = [
    "add a cookie to my order",
    "add fries to that",
    "I also want a drink",
    "throw in an apple pie",
    "tack on a McFlurry",
    "put a sundae on my order too",
    "wait I need to add something",
    "can you add a nuggets to that",
    "I forgot I need a drink too",
    "oh and add a hash brown",
    "actually remove the fries",
    "take the drink off",
    "cancel the shake",
    "I don't want the nuggets anymore",
    "never mind on the apple pie",
    "scratch that last item",
    "drop the cookie from my order",
    "forget about the sundae",
    "take that off",
    "remove the last thing I ordered",
    "change my drink to a Sprite",
    "switch my fries to a large",
    "make that two instead of one",
    "I only want one not two",
    "change that to a medium",
    "I want to change something on my order",
    "let me modify my order",
    "hold on I need to change something",
    "wait can I change my drink",
    "actually make that three nugget meals",
    "double my fries order",
    "can you change my combo number",
    "switch my meal to a number 3",
    "replace my drink with a shake",
    "I changed my mind on the burger",
    "give me the McChicken instead of the McDouble",
    "swap my side for a salad",
    "update my order I want large everything",
    "change all my drinks to Sprite",
    "add one more cheeseburger to that",
]

# ═══════════════════════════════════════════════════════════════
# 5. price_inquiry — PURE cost/price questions
#    MUST have price/cost/money language
# ═══════════════════════════════════════════════════════════════
PRICE_INQUIRY = [
    "how much is a Big Mac",
    "how much does a Quarter Pounder cost",
    "what's the price of a 10 piece nuggets",
    "how much for a McChicken",
    "what does a combo cost",
    "how much is a number 1",
    "what's the price on the McFlurry",
    "how much are fries",
    "how much is a large fries",
    "what does a shake cost",
    "how much for a Happy Meal",
    "what's the price of a fish sandwich",
    "how much is the chicken sandwich",
    "what does apple pie cost",
    "how much for two Big Macs",
    "what's a 20 piece nuggets gonna cost",
    "how much for the family bundle",
    "what's the price on the value meals",
    "how much is a medium drink",
    "what does a large Coke cost",
    "how much is an Egg McMuffin",
    "what's the price of breakfast combos",
    "how much for a sausage McMuffin",
    "what does coffee cost here",
    "how much is a caramel frappe",
    "what's my total so far",
    "how much do I owe",
    "what's the total",
    "can you ring that up",
    "what does all that come to",
    "how much is everything",
    "what's the bill",
    "give me the total",
    "how much for all of that",
    "what am I looking at price wise",
    "is tax included in that price",
    "does the combo save me money compared to individual items",
    "how much more for a large",
    "what's the upcharge for extra cheese",
    "how much extra for bacon",
]

def gen_examples(templates, behavior, n=400):
    results = []
    for _ in range(n):
        text = random.choice(templates)
        text = random.choice(F) + text + random.choice(S)
        results.append(make(text.strip(), behavior))
    return results

def main():
    random.seed(123)
    
    print("[boost2] Loading dataset...")
    examples = []
    with open(DATASET_PATH) as f:
        for line in f:
            if line.strip():
                examples.append(json.loads(line))
    
    before = Counter(e['behavior'] for e in examples)
    print(f"[boost2] Loaded {len(examples)} examples")
    
    # Generate hard-negative examples
    new_mi = gen_examples(MENU_INQUIRY, 'menu_inquiry', 500)
    new_to = gen_examples(TAKE_ORDER, 'take_order', 400)
    new_vr = gen_examples(VALUE_RECOMMENDATION, 'value_recommendation', 400)
    new_om = gen_examples(ORDER_MODIFY, 'order_modify', 300)
    new_pi = gen_examples(PRICE_INQUIRY, 'price_inquiry', 300)
    
    all_new = new_mi + new_to + new_vr + new_om + new_pi
    examples.extend(all_new)
    
    random.shuffle(examples)
    
    after = Counter(e['behavior'] for e in examples)
    
    print(f"\n[boost2] Dataset changes:")
    for b in sorted(set(list(before.keys()) + list(after.keys()))):
        b_before = before.get(b, 0)
        b_after = after.get(b, 0)
        delta = b_after - b_before
        flag = " ← BOOSTED" if delta != 0 else ""
        print(f"  {b:30s}: {b_before:5d} → {b_after:5d} ({delta:+d}){flag}")
    
    print(f"\n[boost2] Total: {len(examples)} examples")
    
    with open(DATASET_PATH, 'w') as f:
        for ex in examples:
            f.write(json.dumps(ex) + '\n')
    
    print(f"[boost2] Written to {DATASET_PATH}")

if __name__ == '__main__':
    main()
