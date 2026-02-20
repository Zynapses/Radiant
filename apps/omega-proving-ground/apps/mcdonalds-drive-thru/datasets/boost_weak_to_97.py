#!/usr/bin/env python3
"""
Targeted augmentation to push 6 weak behaviors above 97%.
Each behavior gets examples designed to AVOID its specific confusion pattern.
"""

import json, random
from pathlib import Path
from collections import Counter

DATASET_PATH = Path(__file__).parent / 'mcdonalds-behavioral-training.jsonl'

def make(text, behavior):
    return {'input': text.strip(), 'behavior': behavior, 'target_action': behavior,
            'target_data': {}, 'expected_response_contains': [], 'context': None}

# ── Fillers/suffixes for variety ──
F = ['', 'um ', 'uh ', 'hey ', 'yo ', 'like ', 'so ', 'ok ', 'hmm ',
     'actually ', 'wait ', 'oh ']
S = ['', ' please', ' thanks', ' real quick', ' bro', ' for me', ' today',
     ' right now', ' if you can']

def vary(template, **kwargs):
    """Generate varied versions of a template."""
    results = []
    for _ in range(3):
        text = template.format(**{k: random.choice(v) for k, v in kwargs.items()})
        text = random.choice(F) + text + random.choice(S)
        results.append(text.strip())
    return results

# ═══════════════════════════════════════════════════════════════
# 1. time_check — MUST use explicit TIME language, NOT availability
#    Confused with: menu_inquiry (8%)
#    Fix: Use words like "time", "when", "hours", "o'clock", "open", "close",
#         "morning", "night", "am", "pm", "late", "early"
# ═══════════════════════════════════════════════════════════════
def gen_time_check(n=500):
    templates = [
        "what time do you {action}",
        "when do you {action}",
        "what are your hours",
        "what are your hours {period}",
        "how late are you open",
        "how early do you open",
        "are you open right now",
        "are you open {period}",
        "are you still open",
        "what time is it",
        "do you close at {time}",
        "are you open until {time}",
        "are you open at {time}",
        "when does {meal} start",
        "when does {meal} end",
        "what time does {meal} start",
        "what time does {meal} end",
        "until what time do you serve {meal}",
        "how much longer are you serving {meal}",
        "is it too late for {meal}",
        "is it too early for {meal}",
        "am I too late for {meal}",
        "did I miss {meal}",
        "can I still get {meal} at this hour",
        "do you serve {meal} after {time}",
        "do you serve {meal} before {time}",
        "when do you switch from {meal} to lunch",
        "is the lobby still open",
        "is the drive thru open {period}",
        "what are your drive thru hours",
        "are you open 24 hours",
        "do you close early on weekends",
        "what time do you stop serving {meal}",
        "how long until you close",
        "are you about to close",
        "when is your last order",
        "what time is last call",
        "is it past {meal} time",
    ]
    actions = ['open', 'close', 'start serving', 'stop serving']
    periods = ['today', 'tonight', 'on weekends', 'on Sundays', 'right now',
               'this late', 'this early', 'in the morning', 'at night']
    times = ['10:30', '11', 'midnight', '6 am', '5 am', '10 pm', '9', '2 am']
    meals = ['breakfast', 'lunch', 'dinner', 'the breakfast menu', 'morning items']
    
    results = []
    for _ in range(n):
        tmpl = random.choice(templates)
        text = tmpl.format(
            action=random.choice(actions), period=random.choice(periods),
            time=random.choice(times), meal=random.choice(meals),
        )
        results.append(make(random.choice(F) + text + random.choice(S), 'time_check'))
    return results

# ═══════════════════════════════════════════════════════════════
# 2. take_order — MUST be first-order language, NOT add-on
#    Confused with: order_modify (4.5%), price_inquiry (3%)
#    Fix: Use "I want", "I'll have", "give me", "let me get", "can I get"
#         WITHOUT "also", "too", "add", "throw in" (those are order_modify)
# ═══════════════════════════════════════════════════════════════
def gen_take_order(n=500):
    templates = [
        "I want a {item}",
        "I'll have a {item}",
        "I'll take a {item}",
        "give me a {item}",
        "let me get a {item}",
        "can I get a {item}",
        "I'd like a {item}",
        "I need a {item}",
        "get me a {item}",
        "one {item}",
        "I'll do a {item}",
        "let me do a {item}",
        "I want the {item}",
        "give me the {item}",
        "I'll go with the {item}",
        "let me try the {item}",
        "I'll start with a {item}",
        "for my order I want a {item}",
        "I'm gonna go with a {item}",
        "put me down for a {item}",
        "I'll order a {item}",
        "could I get a {item}",
        "may I have a {item}",
        "{item} for me",
        "just a {item}",
        "a {item} is all I need",
    ]
    items = ['Big Mac', 'Big Mac combo', 'Quarter Pounder', 'Quarter Pounder meal',
             'McChicken', 'McDouble', 'double cheeseburger', 'Filet-O-Fish',
             '10 piece nuggets', '20 piece nuggets', '6 piece nuggets',
             'large fries', 'medium fries', 'small fries',
             'McFlurry', 'vanilla shake', 'chocolate shake',
             'Coke', 'large Coke', 'Sprite', 'sweet tea', 'Dr Pepper',
             'chicken sandwich', 'spicy McChicken', 'crispy chicken sandwich',
             'number 1', 'number 2', 'number 5', 'number 7',
             'Happy Meal', 'cheeseburger', 'hamburger', 'fish sandwich',
             'bacon burger', 'McRib', 'apple pie', 'cookie']
    
    results = []
    for _ in range(n):
        tmpl = random.choice(templates)
        text = tmpl.format(item=random.choice(items))
        results.append(make(random.choice(F) + text + random.choice(S), 'take_order'))
    return results

# ═══════════════════════════════════════════════════════════════
# 3. order_modify — MUST be about changing EXISTING order
#    Confused with: take_order (2.5%), customize (1%)
#    Fix: Use "change", "remove", "cancel", "add X to my order",
#         "I also want", "actually", "never mind", "scratch that"
# ═══════════════════════════════════════════════════════════════
def gen_order_modify(n=500):
    templates = [
        "add a {item} to my order",
        "I also want a {item}",
        "actually add a {item}",
        "wait I need to add a {item}",
        "can you add a {item} to that",
        "put a {item} on my order too",
        "remove the {item}",
        "take off the {item}",
        "take the {item} off my order",
        "cancel the {item}",
        "I don't want the {item} anymore",
        "never mind on the {item}",
        "scratch the {item}",
        "drop the {item} from my order",
        "forget the {item}",
        "I changed my mind about the {item}",
        "actually I don't need the {item}",
        "make that two instead of one",
        "I only want one not two",
        "change that to two {item}s",
        "double my order",
        "actually just one of those",
        "can I get two of those instead",
        "wait I need to change something",
        "hold on let me change my order",
        "I want to modify my order",
        "can I change something on my order",
        "I need to fix my order",
    ]
    items = ['fries', 'drink', 'shake', 'nuggets', 'Big Mac', 'McChicken',
             'apple pie', 'cookie', 'McFlurry', 'Coke', 'Sprite', 'sundae',
             'coffee', 'hash brown', 'cheeseburger', 'Quarter Pounder']
    
    results = []
    for _ in range(n):
        tmpl = random.choice(templates)
        text = tmpl.format(item=random.choice(items))
        results.append(make(random.choice(F) + text + random.choice(S), 'order_modify'))
    return results

# ═══════════════════════════════════════════════════════════════
# 4. value_recommendation — MUST be about asking for advice/deals
#    Confused with: price_inquiry (3.5%), menu_inquiry (2%)
#    Fix: Use "recommend", "suggest", "best", "popular", "worth it",
#         "good deal", "what should I get", "favorite"
# ═══════════════════════════════════════════════════════════════
def gen_value_recommendation(n=400):
    templates = [
        "what do you recommend",
        "what would you recommend",
        "what's your recommendation",
        "what should I get",
        "what should I order",
        "what's good here",
        "what's the best thing on the menu",
        "what's popular",
        "what's your best seller",
        "what's the most popular item",
        "what do most people get",
        "what do you suggest",
        "any suggestions",
        "what's worth getting",
        "what's a good deal",
        "what's the best bang for my buck",
        "I can't decide what to get",
        "help me pick something",
        "what would you get",
        "what's your favorite thing here",
        "is the {item} any good",
        "is the {item} worth it",
        "what's the best combo",
        "what's the best value",
        "I'm hungry what should I get",
        "surprise me",
        "just give me whatever's good",
        "what's the move",
        "what should a first timer get",
        "what's the go-to order",
    ]
    items = ['Big Mac', 'Quarter Pounder', 'McChicken', 'nuggets', 'McFlurry',
             'Filet-O-Fish', 'chicken sandwich', 'McDouble']
    
    results = []
    for _ in range(n):
        tmpl = random.choice(templates)
        text = tmpl.format(item=random.choice(items))
        results.append(make(random.choice(F) + text + random.choice(S), 'value_recommendation'))
    return results

# ═══════════════════════════════════════════════════════════════
# 5. price_inquiry — MUST be explicitly about cost/price
#    Confused with: menu_inquiry (3%)
#    Fix: Always use "how much", "price", "cost", "total", "$"
# ═══════════════════════════════════════════════════════════════
def gen_price_inquiry(n=300):
    templates = [
        "how much is the {item}",
        "how much does the {item} cost",
        "how much for a {item}",
        "what's the price of the {item}",
        "what does a {item} cost",
        "what's a {item} gonna cost me",
        "how much would a {item} be",
        "price check on the {item}",
        "what's the price on a {item}",
        "how much is a {item} gonna run me",
        "what's the damage for a {item}",
        "how expensive is the {item}",
        "is the {item} expensive",
        "what does the {item} go for",
        "what's the total",
        "how much do I owe",
        "what's my total",
        "how much is that",
        "how much is everything",
        "what's the subtotal so far",
        "how much for everything so far",
        "can you tell me the total",
        "ring me up how much is it",
    ]
    items = ['Big Mac', 'Big Mac combo', 'Quarter Pounder', '10 piece nuggets',
             '20 piece nuggets', 'McChicken', 'Filet-O-Fish', 'large fries',
             'McFlurry', 'Happy Meal', 'number 1', 'McDouble', 'chicken sandwich',
             'shake', 'medium drink', 'apple pie', 'sundae', 'coffee']
    
    results = []
    for _ in range(n):
        tmpl = random.choice(templates)
        text = tmpl.format(item=random.choice(items))
        results.append(make(random.choice(F) + text + random.choice(S), 'price_inquiry'))
    return results

# ═══════════════════════════════════════════════════════════════
# 6. menu_inquiry — MUST be about what's on the menu/available items
#    Confused with: time_check (3.5%), price_inquiry (1.5%)
#    Fix: Use "what do you have", "do you have", "is X on the menu",
#         "what comes on", "what options", "what flavors"
#    AVOID: time words, price words
# ═══════════════════════════════════════════════════════════════
def gen_menu_inquiry(n=400):
    templates = [
        "what do you have",
        "what do you serve",
        "what's on the menu",
        "show me the menu",
        "let me see the menu",
        "read me the menu",
        "do you have {item}",
        "do you carry {item}",
        "do you sell {item}",
        "is {item} on the menu",
        "do you still have {item}",
        "you got {item}",
        "you got any {item}",
        "what kind of {category} do you have",
        "what {category} do you serve",
        "what are your {category} options",
        "tell me about the {category}",
        "what comes on the {item}",
        "what's in the {item}",
        "what's included with the {item}",
        "what are the ingredients in the {item}",
        "what flavors do you have",
        "what sizes does {item} come in",
        "does {item} come with fries",
        "does {item} come with a drink",
        "what are the Happy Meal options",
        "do you have a kids menu",
        "do you have any vegetarian options",
        "any spicy options",
        "what are my options for {category}",
        "list the {category}",
        "what {category} are available",
        "anything new on the menu",
        "what's new",
        "any new items",
        "what sauces do you have",
        "what dipping sauces come with nuggets",
    ]
    items = ['Big Mac', 'Quarter Pounder', 'McChicken', 'nuggets', 'Filet-O-Fish',
             'McFlurry', 'apple pie', 'Egg McMuffin', 'ice cream', 'milkshakes',
             'salads', 'wraps', 'chicken tenders', 'McRib', 'fish sandwich',
             'bacon burger', 'crispy chicken', 'spicy McChicken', 'hash browns']
    categories = ['burgers', 'chicken', 'sandwiches', 'drinks', 'desserts',
                  'sides', 'breakfast', 'McCafe', 'snacks', 'salads', 'fish']
    
    results = []
    for _ in range(n):
        tmpl = random.choice(templates)
        text = tmpl.format(item=random.choice(items), category=random.choice(categories))
        results.append(make(random.choice(F) + text + random.choice(S), 'menu_inquiry'))
    return results

# ═══════════════════════════════════════════════════════════════
# Also: remove confusing examples from the dataset
# ═══════════════════════════════════════════════════════════════
TIME_WORDS = {'time', 'hours', 'open', 'close', 'late', 'early', 'morning',
              'night', 'tonight', 'midnight', 'am', 'pm', 'hour', 'o\'clock',
              'weekends', 'sunday', 'saturday'}
PRICE_WORDS = {'price', 'cost', 'much', 'dollar', 'expensive', 'cheap',
               'afford', 'total', 'owe', 'charge'}

def clean_confusing_examples(examples):
    """Remove examples where the text strongly contradicts the label."""
    removed = 0
    kept = []
    for ex in examples:
        text_lower = ex['input'].lower()
        words = set(text_lower.split())
        
        # menu_inquiry should NOT have time words
        if ex['behavior'] == 'menu_inquiry' and words & TIME_WORDS:
            if 'limited time' in text_lower or 'all day' in text_lower:
                removed += 1
                continue
        
        # time_check should NOT look like menu inquiry
        if ex['behavior'] == 'time_check':
            # "is X available" without time context → confusing
            if 'available' in text_lower and not any(w in text_lower for w in ['time', 'hour', 'when', 'late', 'early', 'morning', 'night', 'still', 'yet', 'after', 'before']):
                removed += 1
                continue
        
        # take_order should NOT have "add" / "also" / "too" / "throw in" (those are order_modify)
        if ex['behavior'] == 'take_order':
            if any(p in text_lower for p in ['also want', 'also give', 'also need',
                                              'throw in', 'tack on', 'put a', 'put an']):
                removed += 1
                continue
        
        kept.append(ex)
    
    print(f"[boost] Removed {removed} confusing cross-labeled examples")
    return kept

def main():
    random.seed(42)
    
    # Load existing dataset
    print("[boost] Loading dataset...")
    examples = []
    with open(DATASET_PATH) as f:
        for line in f:
            if line.strip():
                examples.append(json.loads(line))
    
    before = Counter(e['behavior'] for e in examples)
    print(f"[boost] Loaded {len(examples)} examples")
    
    # Clean confusing examples
    examples = clean_confusing_examples(examples)
    
    # Generate targeted augmentations
    new_tc = gen_time_check(500)
    new_to = gen_take_order(500)
    new_om = gen_order_modify(500)
    new_vr = gen_value_recommendation(400)
    new_pi = gen_price_inquiry(300)
    new_mi = gen_menu_inquiry(400)
    
    all_new = new_tc + new_to + new_om + new_vr + new_pi + new_mi
    examples.extend(all_new)
    
    # Shuffle
    random.shuffle(examples)
    
    after = Counter(e['behavior'] for e in examples)
    
    print(f"\n[boost] Dataset changes:")
    for b in sorted(set(list(before.keys()) + list(after.keys()))):
        b_before = before.get(b, 0)
        b_after = after.get(b, 0)
        delta = b_after - b_before
        flag = " ← CHANGED" if delta != 0 else ""
        print(f"  {b:30s}: {b_before:5d} → {b_after:5d} ({delta:+d}){flag}")
    
    print(f"\n[boost] Total: {len(examples)} examples")
    
    # Write
    with open(DATASET_PATH, 'w') as f:
        for ex in examples:
            f.write(json.dumps(ex) + '\n')
    
    print(f"[boost] Written to {DATASET_PATH}")

if __name__ == '__main__':
    main()
