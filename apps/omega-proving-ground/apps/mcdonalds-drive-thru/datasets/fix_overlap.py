#!/usr/bin/env python3
"""
Fix semantic overlap between confused behavior pairs:
1. menu_inquiry vs price_inquiry — remove price-adjacent patterns from menu_inquiry
2. order_modify vs combo_entree_swap — clarify boundaries
3. Add more distinctive anchor examples for each weak behavior
"""

import json
import random
from pathlib import Path

DATASET_PATH = Path(__file__).parent / 'mcdonalds-behavioral-training.jsonl'

# ── Price-contaminated words that should NOT appear in menu_inquiry ──
PRICE_WORDS = {'price', 'cost', 'much', 'dollar', 'deal', 'deals', 'value', 'cheap',
               'expensive', 'afford', 'budget', 'save', 'discount', 'coupon', 'free'}

# ── Combo/meal words that distinguish combo_entree_swap from order_modify ──
COMBO_WORDS = {'combo', 'meal', 'number', '#', 'bundle'}

def load_dataset():
    examples = []
    with open(DATASET_PATH) as f:
        for line in f:
            if line.strip():
                examples.append(json.loads(line))
    return examples

def fix_menu_inquiry_overlap(examples):
    """Remove menu_inquiry examples that contain price-related words."""
    removed = 0
    kept = []
    for ex in examples:
        if ex['behavior'] == 'menu_inquiry':
            words = set(ex['input'].lower().split())
            if words & PRICE_WORDS:
                removed += 1
                continue
        kept.append(ex)
    print(f"[fix] Removed {removed} price-contaminated menu_inquiry examples")
    return kept

def fix_order_modify_overlap(examples):
    """Remove order_modify examples that look like combo_entree_swap."""
    removed = 0
    kept = []
    swap_patterns = ['swap', 'switch', 'instead of', 'change', 'replace']
    for ex in examples:
        if ex['behavior'] == 'order_modify':
            text = ex['input'].lower()
            # If it has swap language AND mentions specific items being exchanged, remove it
            has_swap = any(p in text for p in swap_patterns)
            has_combo = any(w in text for w in COMBO_WORDS)
            # "swap X for Y" or "change X to Y" without combo context → ambiguous, remove
            if has_swap and ' for ' in text and ' to ' not in text:
                removed += 1
                continue
            if has_swap and ' instead of ' in text:
                removed += 1
                continue
        kept.append(ex)
    print(f"[fix] Removed {removed} swap-pattern order_modify examples (overlap with combo_entree_swap)")
    return kept

def generate_distinctive_menu_inquiry(n=800):
    """Generate clearly distinctive menu_inquiry examples — NO price words."""
    templates = [
        # Availability questions
        "do you have {item}",
        "do you still have {item}",
        "is {item} available",
        "is {item} on the menu",
        "are you still serving {item}",
        "do you carry {item}",
        "do you sell {item}",
        "you got {item}",
        "you got any {item}",
        "can I see the menu",
        "what's on the menu",
        "show me the menu",
        "let me see the menu",
        "what do you have",
        "what do you serve",
        "what are you serving",
        "what's available",
        "what items do you have",
        "what kind of {category} do you have",
        "what {category} options are there",
        "tell me about the {category}",
        "what comes on the {item}",
        "what's in the {item}",
        "what's included in the {item}",
        "what are the ingredients in the {item}",
        "do you have anything {adjective}",
        "is there anything {adjective}",
        "what {adjective} options do you have",
        "any {adjective} items",
        "what are my options",
        "what can I choose from",
        "read me the menu",
        "list the {category}",
        "what {category} are available",
        "I want to know what you serve",
        "what flavors do you have",
        "what sizes does {item} come in",
        "does {item} come in different sizes",
        "is {item} still on the menu",
        "did you get rid of {item}",
        "when did you stop serving {item}",
        "is {item} seasonal",
        "is {item} limited time",
        "do you have a kids menu",
        "what's on the breakfast menu",
        "what's on the lunch menu",
        "what's on the dinner menu",
        "what comes with the {item}",
        "does {item} come with fries",
        "does {item} come with a drink",
        "what are the Happy Meal options",
        "what toys are in the Happy Meal",
        "is the McRib back",
        "do you have milkshakes",
        "what shake flavors do you have",
        "what McFlurry flavors do you have",
        "do you have any vegetarian options",
        "do you have any spicy options",
        "anything new on the menu",
        "any new items",
        "what's new",
    ]
    
    items = ['Big Mac', 'Quarter Pounder', 'McChicken', 'nuggets', 'fries', 'Filet-O-Fish',
             'McFlurry', 'apple pie', 'hot fudge sundae', 'Egg McMuffin', 'hash browns',
             'hotcakes', 'ice cream', 'McDouble', 'cheeseburger', 'hamburger', 'Sprite',
             'Coke', 'Dr Pepper', 'sweet tea', 'coffee', 'iced coffee', 'frappe',
             'chicken sandwich', 'crispy chicken', 'spicy McChicken', 'fish sandwich',
             'bacon burger', 'double cheeseburger', 'triple cheeseburger']
    
    categories = ['burgers', 'chicken', 'sandwiches', 'drinks', 'desserts', 'breakfast',
                  'sides', 'salads', 'wraps', 'fish', 'McCafe', 'snacks', 'combos']
    
    adjectives = ['new', 'spicy', 'healthy', 'light', 'vegetarian', 'limited time',
                  'seasonal', 'popular', 'hot', 'cold', 'iced', 'frozen']
    
    fillers = ['', 'um ', 'uh ', 'hey ', 'yo ', 'like ', 'so ', 'ok ', 'hmm ',
               'bro ', 'dude ', 'man ', 'actually ', 'alright ', 'listen ']
    
    suffixes = ['', ' please', ' thanks', ' real quick', ' bro', ' for me', ' today',
                ' right now', ' instead', ' if you can']
    
    results = []
    for _ in range(n):
        tmpl = random.choice(templates)
        text = tmpl.format(
            item=random.choice(items),
            category=random.choice(categories),
            adjective=random.choice(adjectives),
        )
        text = random.choice(fillers) + text + random.choice(suffixes)
        results.append({
            'input': text.strip(),
            'behavior': 'menu_inquiry',
            'target_action': 'menu_inquiry',
            'target_data': {},
            'expected_response_contains': [],
            'context': None,
        })
    return results

def generate_distinctive_order_modify(n=600):
    """Generate clearly distinctive order_modify — adding/removing items, NOT swapping entrees."""
    templates = [
        # Adding items
        "add a {item} to my order",
        "throw in a {item} too",
        "I also want a {item}",
        "also give me a {item}",
        "wait I also need a {item}",
        "put a {item} on there too",
        "can I add a {item}",
        "let me add a {item}",
        "I want to add a {item}",
        "tack on a {item}",
        "I forgot I need a {item}",
        "one more thing add a {item}",
        # Removing items
        "remove the {item}",
        "take off the {item}",
        "I don't want the {item} anymore",
        "cancel the {item}",
        "never mind on the {item}",
        "scratch the {item}",
        "drop the {item} from my order",
        "take the {item} off",
        "forget the {item}",
        "nah I don't need the {item}",
        # Quantity changes
        "make that two {item}s",
        "I only want one not two",
        "make it three instead",
        "I want two of those",
        "double that",
        "actually just one {item}",
        "can I get two {item}s instead",
        # Size changes (non-combo)
        "make my drink a large",
        "change my fries to a large",
        "upsize my drink",
        "I want a bigger {item}",
        "downsize the {item}",
        "make my {item} a medium",
    ]
    
    items = ['fries', 'drink', 'shake', 'nuggets', 'apple pie', 'cookie', 'McFlurry',
             'hash brown', 'coffee', 'Coke', 'Sprite', 'sweet tea', 'sundae',
             'Big Mac', 'McChicken', 'cheeseburger', 'Quarter Pounder']
    
    fillers = ['', 'um ', 'uh ', 'hey ', 'yo ', 'like ', 'so ', 'ok ', 'hmm ',
               'wait ', 'oh ', 'actually ']
    
    suffixes = ['', ' please', ' thanks', ' real quick', ' bro', ' for me', ' today']
    
    results = []
    for _ in range(n):
        tmpl = random.choice(templates)
        text = tmpl.format(item=random.choice(items))
        text = random.choice(fillers) + text + random.choice(suffixes)
        results.append({
            'input': text.strip(),
            'behavior': 'order_modify',
            'target_action': 'order_modify',
            'target_data': {},
            'expected_response_contains': [],
            'context': None,
        })
    return results

def generate_distinctive_price_inquiry(n=400):
    """Generate clearly distinctive price_inquiry — explicit price/cost questions."""
    templates = [
        "how much is the {item}",
        "how much does the {item} cost",
        "what's the price of the {item}",
        "what does the {item} cost",
        "how much for a {item}",
        "what's a {item} gonna run me",
        "how much would a {item} be",
        "price on the {item}",
        "what's the damage for a {item}",
        "how much is that gonna cost",
        "what's the total",
        "how much do I owe",
        "what's the subtotal",
        "how much so far",
        "what's my total at",
    ]
    
    items = ['Big Mac', 'Quarter Pounder', 'McChicken', '10 piece nuggets', '20 piece nuggets',
             'Filet-O-Fish', 'large fries', 'medium drink', 'McFlurry', 'Egg McMuffin',
             'Happy Meal', 'combo', 'McDouble', 'double cheeseburger']
    
    fillers = ['', 'um ', 'uh ', 'hey ', 'yo ', 'like ', 'so ']
    suffixes = ['', ' please', ' thanks', ' real quick', ' bro']
    
    results = []
    for _ in range(n):
        tmpl = random.choice(templates)
        text = tmpl.format(item=random.choice(items))
        text = random.choice(fillers) + text + random.choice(suffixes)
        results.append({
            'input': text.strip(),
            'behavior': 'price_inquiry',
            'target_action': 'price_inquiry',
            'target_data': {},
            'expected_response_contains': [],
            'context': None,
        })
    return results

def main():
    print("[fix] Loading dataset...")
    examples = load_dataset()
    print(f"[fix] Loaded {len(examples)} examples")
    
    # Count before
    from collections import Counter
    before = Counter(e['behavior'] for e in examples)
    
    # Fix overlapping examples
    examples = fix_menu_inquiry_overlap(examples)
    examples = fix_order_modify_overlap(examples)
    
    # Count after removal
    after_removal = Counter(e['behavior'] for e in examples)
    
    # Generate distinctive replacements
    new_mi = generate_distinctive_menu_inquiry(800)
    new_om = generate_distinctive_order_modify(600)
    new_pi = generate_distinctive_price_inquiry(400)
    
    examples.extend(new_mi)
    examples.extend(new_om)
    examples.extend(new_pi)
    
    # Shuffle
    random.seed(42)
    random.shuffle(examples)
    
    # Count final
    final = Counter(e['behavior'] for e in examples)
    
    print(f"\n[fix] Dataset changes:")
    for b in sorted(set(list(before.keys()) + list(final.keys()))):
        b_before = before.get(b, 0)
        b_after = final.get(b, 0)
        delta = b_after - b_before
        flag = " ← CHANGED" if delta != 0 else ""
        print(f"  {b:30s}: {b_before:5d} → {b_after:5d} ({delta:+d}){flag}")
    
    print(f"\n[fix] Total: {len(examples)} examples")
    
    # Write
    with open(DATASET_PATH, 'w') as f:
        for ex in examples:
            f.write(json.dumps(ex) + '\n')
    
    print(f"[fix] Written to {DATASET_PATH}")

if __name__ == '__main__':
    main()
