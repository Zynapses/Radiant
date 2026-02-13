#!/usr/bin/env python3
"""
Build McDonald's behavioral training data for OMEGA.
7-class behavior schema: greet, take_order, customize, complaint,
meal_substitution, combo_entree_swap, split_size_selection.
Aligned with RAG Master - McDonalds - 260212.json.
Output: mcdonalds-behavioral-training.jsonl
"""
import json
from pathlib import Path
from collections import Counter

OUT = Path(__file__).parent / "mcdonalds-behavioral-training.jsonl"
OUT_GENERATED_ONLY = Path(__file__).parent / "mcdonalds-behavioral-training-generated.jsonl"
examples, seen = [], set()

def ex(text, behavior, td=None, ctx=None):
    key = text.lower().strip()
    if key in seen:
        return
    seen.add(key)
    examples.append({
        "input": text,
        "behavior": behavior,
        "target_action": behavior,
        "target_data": td or {},
        "expected_response_contains": [],
        **({"context": ctx} if ctx else {}),
    })

# ============================================================================
# MENU DATA (from RAG Master - McDonalds - 260212.json)
# ============================================================================
BURGERS = [
    ("Big Mac", 5.69, 8.99, 1),
    ("Quarter Pounder with Cheese", 5.99, 9.29, 2),
    ("Double Quarter Pounder with Cheese", 7.49, 10.79, 3),
    ("McDouble", 2.79, 5.99, 7),
    ("Double Cheeseburger", 3.39, 6.59, None),
    ("Hamburger", 1.89, 5.09, None),
    ("Cheeseburger", 2.29, 5.49, 8),
]
CHICKEN = [
    ("McCrispy", 5.49, 8.79, 4),
    ("Filet-O-Fish", 4.79, 7.99, 5),
    ("10-piece Chicken McNuggets", 5.29, 8.49, 6),
    ("McChicken", 1.89, None, 10),
]
BREAKFAST = [
    ("Egg McMuffin", 4.49, 6.49),
    ("Sausage McMuffin with Egg", 4.79, 6.79),
    ("Sausage McMuffin", 2.29, 4.99),
    ("Hash Browns", 1.89, None),
]
DESSERTS = [
    ("McFlurry with OREO Cookies", 4.89),
    ("Baked Apple Pie", 1.69),
]

ALL_ENTREES = [(n, p, m) for n, p, m, _ in BURGERS] + \
              [(n, p, m) for n, p, m, _ in CHICKEN]

# ============================================================================
# 1. GREET
# ============================================================================
greetings = [
    "hi", "hello", "hey there", "good morning", "good afternoon",
    "hey, can I order?", "yo what's up", "hi, is this where I order?",
    "what's going on", "howdy", "hey hey", "hi there",
    "good evening", "hey can I place an order", "hola",
    "yo", "sup", "hi, ready to order", "hello there",
    "hey, I'd like to order please",
]
for g in greetings:
    ex(g, "greet")

# ============================================================================
# 2. TAKE ORDER — All menu items with diverse phrasings
# ============================================================================
prefixes = [
    "can I get a {}", "I'll have a {}", "let me get a {}", "one {} please",
    "I want a {}", "give me a {}", "I'd like a {}", "could I get a {}",
    "lemme get the {}", "I'll take a {}",
]
for name, price, meal, combo in BURGERS:
    td = {"item": name, "price": price}
    if meal:
        td["meal_price"] = meal
    for pfx in prefixes:
        ex(pfx.format(name), "take_order", td)
    if combo:
        ex(f"the number {combo}", "take_order", td)
        ex(f"number {combo} please", "take_order", td)
        ex(f"a number {combo}", "take_order", td)
        ex(f"I'll take a number {combo}", "take_order", td)
        ex(f"combo {combo}", "take_order", td)

for name, price, meal, combo in CHICKEN:
    td = {"item": name, "price": price}
    if meal:
        td["meal_price"] = meal
    for pfx in prefixes:
        ex(pfx.format(name), "take_order", td)
    if combo:
        ex(f"the number {combo}", "take_order", td)
        ex(f"number {combo} please", "take_order", td)

# Colloquial chicken/nuggets
ex("can I get a 10 piece", "take_order", {"item": "10-piece Chicken McNuggets", "price": 5.29, "meal_price": 8.49})
ex("20 piece nuggets please", "take_order", {"item": "20-piece Chicken McNuggets", "price": 8.99})
ex("gimme some nuggets", "take_order", {"item": "10-piece Chicken McNuggets", "price": 5.29, "meal_price": 8.49})
ex("I want a fish sandwich", "take_order", {"item": "Filet-O-Fish", "price": 4.79, "meal_price": 7.99})
ex("the crispy chicken sandwich", "take_order", {"item": "McCrispy", "price": 5.49, "meal_price": 8.79})
ex("chicken sandwich", "take_order", {"item": "McCrispy", "price": 5.49, "meal_price": 8.79})

# Breakfast items — still take_order behavior
for name, price, meal in BREAKFAST:
    td = {"item": name, "price": price}
    if meal:
        td["meal_price"] = meal
    for pfx in prefixes:
        ex(pfx.format(name), "take_order", td)

ex("I want the pancakes", "take_order", {"item": "Hotcakes", "price": 3.99, "meal_price": 5.99})
ex("an egg mcmuffin please", "take_order", {"item": "Egg McMuffin", "price": 4.49, "meal_price": 6.49})
ex("sausage egg mcmuffin", "take_order", {"item": "Sausage McMuffin with Egg", "price": 4.79, "meal_price": 6.79})
ex("just a hash brown", "take_order", {"item": "Hash Browns", "price": 1.89})
ex("two hash browns", "take_order", {"item": "Hash Browns", "price": 1.89})

# Desserts
for name, price in DESSERTS:
    td = {"item": name, "price": price}
    for pfx in prefixes:
        ex(pfx.format(name), "take_order", td)

ex("oreo mcflurry", "take_order", {"item": "McFlurry with OREO Cookies", "price": 4.89})
ex("an apple pie", "take_order", {"item": "Baked Apple Pie", "price": 1.69})

# Fries and drinks
ex("small fries", "take_order", {"item": "French Fries", "price": 2.19})
ex("medium fries", "take_order", {"item": "French Fries", "price": 3.09})
ex("large fries please", "take_order", {"item": "French Fries", "price": 3.79})
ex("can I get fries", "take_order", {"item": "French Fries", "price": 3.09})
ex("fries please", "take_order", {"item": "French Fries", "price": 3.09})
ex("a Caramel Frappe", "take_order", {"item": "Caramel Frappe", "price": 4.79})
ex("can I get a frappe", "take_order", {"item": "Caramel Frappe", "price": 4.79})

# Multi-item orders
ex("can I get two Big Macs and a large fry", "take_order", {"item": "Big Mac", "price": 5.69, "meal_price": 8.99})
ex("I need three cheeseburgers", "take_order", {"item": "Cheeseburger", "price": 2.29, "meal_price": 5.49})
ex("let me get a Big Mac combo and a McChicken", "take_order", {"item": "Big Mac", "price": 5.69, "meal_price": 8.99})
ex("two McDoubles and a 10 piece", "take_order", {"item": "McDouble", "price": 2.79, "meal_price": 5.99})
ex("I'll take two Big Mac meals with Coke", "take_order", {"item": "Big Mac", "price": 5.69, "meal_price": 8.99})
ex("one McCrispy combo and one McChicken", "take_order", {"item": "McCrispy", "price": 5.49, "meal_price": 8.79})

# ============================================================================
# 3. CUSTOMIZE — add/remove/plain modifications
# ============================================================================
remove_items = [
    ("pickles", ["no pickles", "hold the pickles", "without pickles", "take off the pickles", "remove the pickles"]),
    ("onions", ["no onions on that", "hold the onions", "without onions", "no onions please", "take off the onions"]),
    ("lettuce", ["hold the lettuce", "no lettuce", "without lettuce", "take the lettuce off"]),
    ("tomato", ["no tomato", "without tomato", "hold the tomato"]),
    ("mayo", ["no mayo", "without mayo", "hold the mayo", "skip the mayo"]),
    ("ketchup", ["no ketchup", "without ketchup", "hold the ketchup"]),
    ("mustard", ["no mustard", "without mustard", "hold the mustard"]),
    ("special sauce", ["no special sauce", "hold the sauce", "no Big Mac sauce"]),
    ("cheese", ["no cheese", "without cheese", "hold the cheese"]),
    ("tartar sauce", ["no tartar sauce", "hold the tartar"]),
]
for ingredient, phrases in remove_items:
    for phrase in phrases:
        ex(phrase, "customize", {"modification": "remove", "ingredient": ingredient})

add_items = [
    ("bacon", ["add bacon", "extra bacon", "put bacon on it", "can I add bacon"]),
    ("cheese", ["extra cheese", "add cheese", "double cheese please"]),
    ("pickles", ["extra pickles please", "more pickles", "add extra pickles"]),
    ("Big Mac sauce", ["add mac sauce", "mac sauce on the side", "extra Big Mac sauce"]),
    ("lettuce", ["add lettuce", "extra lettuce"]),
    ("tomato", ["add tomato", "extra tomato", "put tomato on it"]),
]
for ingredient, phrases in add_items:
    for phrase in phrases:
        ex(phrase, "customize", {"modification": "add", "ingredient": ingredient})

# Plain / only
ex("can I get that plain", "customize", {"modification": "plain"})
ex("make it plain", "customize", {"modification": "plain"})
ex("plain please, nothing on it", "customize", {"modification": "plain"})
ex("just ketchup and mustard only", "customize", {"modification": "only", "ingredient": "ketchup, mustard"})
ex("no mustard no ketchup", "customize", {"modification": "remove", "ingredient": "mustard, ketchup"})
ex("absolutely zero onions, I'm allergic", "customize", {"modification": "remove", "ingredient": "onions"})
ex("scrape the mayo off that", "customize", {"modification": "remove", "ingredient": "mayo"})
ex("can you put the sauce on the side", "customize", {"modification": "side", "ingredient": "sauce"})

# Spicy / deluxe variants
ex("make it spicy", "customize", {"modification": "add", "ingredient": "spicy version"})
ex("the deluxe version please", "customize", {"modification": "add", "ingredient": "deluxe version"})
ex("spicy McCrispy", "customize", {"modification": "add", "ingredient": "spicy version"})

# Menu hack customizations
ex("put fries under the bun", "customize", {"modification": "add", "ingredient": "fries inside"})
ex("nuggets inside the burger please", "customize", {"modification": "add", "ingredient": "nuggets inside"})

# ============================================================================
# 4. COMPLAINT — general, escalation, refund
# ============================================================================
# General complaints
general_complaints = [
    ("my order is wrong", {"type": "wrong_order", "issue": "incorrect items"}),
    ("this isn't what I ordered", {"type": "wrong_order", "issue": "incorrect items"}),
    ("there's hair in my food", {"type": "foreign_object", "issue": "contamination"}),
    ("this burger is raw", {"type": "quality", "issue": "undercooked"}),
    ("I've been waiting 20 minutes", {"type": "long_wait", "issue": "slow service"}),
    ("the drive through is too slow", {"type": "long_wait", "issue": "slow service"}),
    ("I'm missing items in my bag", {"type": "missing_items", "issue": "incomplete order"}),
    ("you forgot my sauce", {"type": "missing_items", "issue": "missing sauce"}),
    ("this food tastes terrible", {"type": "quality", "issue": "taste"}),
    ("my drink is flat", {"type": "quality", "issue": "flat drink"}),
    ("these nuggets are stale", {"type": "quality", "issue": "stale food"}),
    ("you gave me the wrong drink", {"type": "wrong_order", "issue": "wrong drink"}),
    ("I ordered a Big Mac but got a McChicken", {"type": "wrong_order", "issue": "wrong item"}),
    ("there are no pickles and I asked for extra pickles", {"type": "wrong_order", "issue": "missing customization"}),
]
for text, td in general_complaints:
    ex(text, "complaint", td)

# Escalation complaints
escalation_complaints = [
    "can I speak to a manager",
    "I want to talk to your manager right now",
    "get me a manager",
    "this is unacceptable, I need a manager",
    "I'm going to call corporate about this",
    "I want the manager's name",
    "I'm not leaving until I speak to someone in charge",
]
for text in escalation_complaints:
    ex(text, "complaint", {"type": "escalation"})

# Refund complaints
refund_complaints = [
    "my food is cold, I want a refund",
    "I want my money back",
    "I'd like a refund please",
    "give me a refund for this",
    "I'm not paying for cold food",
    "this is missing half the order, I want a refund",
]
for text in refund_complaints:
    ex(text, "complaint", {"type": "refund"})

# ============================================================================
# 5. MEAL SUBSTITUTION — swap combo components
# ============================================================================
meal_subs = [
    ("can I swap the fries for apple slices", {"from": "French Fries", "to": "Apple Slices"}),
    ("apple slices instead of fries", {"from": "French Fries", "to": "Apple Slices"}),
    ("substitute fries for apple slices", {"from": "French Fries", "to": "Apple Slices"}),
    ("swap out the fries for apple slices please", {"from": "French Fries", "to": "Apple Slices"}),
    ("can I get apple slices in my meal instead", {"from": "French Fries", "to": "Apple Slices"}),
    ("no fries, give me apple slices", {"from": "French Fries", "to": "Apple Slices"}),
    ("substitute the drink for a shake", {"from": "drink", "to": "shake"}),
    ("can I switch my drink to a frappe", {"from": "drink", "to": "Caramel Frappe"}),
    ("swap the Coke for an iced coffee", {"from": "Coca-Cola", "to": "Iced Coffee"}),
    ("change my drink to a sweet tea", {"from": "drink", "to": "Sweet Tea"}),
    ("I want a frappe instead of a regular drink in my combo", {"from": "drink", "to": "Caramel Frappe"}),
    ("can I get a shake instead of the regular drink", {"from": "drink", "to": "shake"}),
]
for text, td in meal_subs:
    ex(text, "meal_substitution", td)

# ============================================================================
# 6. COMBO ENTREE SWAP — change the main sandwich in a combo
# ============================================================================
swap_pairs = [
    ("Big Mac", "Double Cheeseburger"),
    ("Big Mac", "Quarter Pounder with Cheese"),
    ("Big Mac", "McCrispy"),
    ("Quarter Pounder with Cheese", "Big Mac"),
    ("Quarter Pounder with Cheese", "McDouble"),
    ("McCrispy", "Filet-O-Fish"),
    ("McDouble", "Cheeseburger"),
    ("Double Quarter Pounder with Cheese", "Big Mac"),
    ("McCrispy", "Big Mac"),
    ("10-piece Chicken McNuggets", "McCrispy"),
]
swap_templates = [
    "actually change the {} in my meal to a {}",
    "swap the {} for a {}",
    "can you change my {} combo to a {}",
    "I want a {} instead of the {}",
    "switch the {} to a {} in my meal",
    "make that a {} instead of a {} combo",
]
for from_item, to_item in swap_pairs:
    for tmpl in swap_templates:
        if "{}" in tmpl:
            text = tmpl.format(from_item, to_item)
            ex(text, "combo_entree_swap", {"from_item": from_item, "to_item": to_item})

# Casual entree swaps
ex("actually make that a McDouble instead", "combo_entree_swap", {"from_item": "Big Mac", "to_item": "McDouble"})
ex("wait, can I change to a McCrispy combo", "combo_entree_swap", {"from_item": "Big Mac", "to_item": "McCrispy"})
ex("scratch the QP, give me a Big Mac combo", "combo_entree_swap", {"from_item": "Quarter Pounder with Cheese", "to_item": "Big Mac"})

# ============================================================================
# 7. SPLIT SIZE SELECTION — different sizes for combo drink vs fries
# ============================================================================
split_combos = [
    ("large", "medium", "Make my drink large but keep the fries medium"),
    ("medium", "large", "Large fries but keep the drink medium"),
    ("large", "large", "Make both the drink and fries large"),
    ("small", "medium", "Small drink but medium fries"),
    ("large", "small", "Large drink and small fries please"),
    ("medium", "small", "Medium drink but small fries"),
]
for drink_size, fries_size, text in split_combos:
    ex(text, "split_size_selection", {"drink_size": drink_size, "fries_size": fries_size})

# More phrasing variants
split_phrases = [
    ("can I get the drink in large and fries in medium", "large", "medium"),
    ("I want a large drink but medium fries", "large", "medium"),
    ("large fries, small drink", "small", "large"),
    ("keep the fries medium, upsize just the drink", "large", "medium"),
    ("small fries but large drink please", "large", "small"),
    ("just upsize the fries to large", "medium", "large"),
    ("just upsize the drink please", "large", "medium"),
    ("make the fries large but the drink small", "small", "large"),
    ("large everything", "large", "large"),
    ("make it all large", "large", "large"),
    ("supersize the fries but keep drink medium", "medium", "large"),
    ("can I get a large fry and small drink with that", "small", "large"),
    ("medium drink, large fries", "medium", "large"),
    ("I want different sizes — large fries and a small drink", "small", "large"),
]
for text, drink_size, fries_size in split_phrases:
    ex(text, "split_size_selection", {"drink_size": drink_size, "fries_size": fries_size})

# ============================================================================
# WRITE OUTPUT
# ============================================================================

# Save generated-only backup
with open(OUT_GENERATED_ONLY, 'w') as f:
    for e in examples:
        f.write(json.dumps(e) + '\n')

# Merge into main training file: keep existing entries, append new ones
existing = []
existing_keys = set()
if OUT.exists():
    with open(OUT) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                entry = json.loads(line)
                key = entry.get('input', '').lower().strip()
                existing_keys.add(key)
                existing.append(line)
            except json.JSONDecodeError:
                existing.append(line)

new_count = 0
with open(OUT, 'w') as f:
    for line in existing:
        f.write(line + '\n')
    for e in examples:
        key = e.get('input', '').lower().strip()
        if key not in existing_keys:
            f.write(json.dumps(e) + '\n')
            new_count += 1

behaviors = Counter(e['behavior'] for e in examples)
items = set()
for e in examples:
    if 'item' in e['target_data'] and e['target_data']['item']:
        items.add(e['target_data']['item'])

print(f"Generated {len(examples)} training examples")
print(f"Behaviors: {len(behaviors)} (target: 7)")
for b, c in behaviors.most_common():
    print(f"  {b}: {c}")
print(f"\nUnique items: {len(items)}")
print(f"Existing entries in main file: {len(existing)}")
print(f"New entries appended: {new_count}")
print(f"Main output: {OUT}")
print(f"Generated-only backup: {OUT_GENERATED_ONLY}")
