#!/usr/bin/env python3
"""Generate diverse training examples for weak behavior classes."""
import json, random, itertools

random.seed(42)
examples = []

# ============================================================================
# MENU_INQUIRY — "what do you have" / "tell me about" / availability questions
# Key differentiator: asking WHAT EXISTS, not HOW MUCH or WHAT TO GET
# ============================================================================
menu_templates = [
    "what {items} do you have",
    "do you have {item}",
    "do you still have {item}",
    "do you guys have {item}",
    "do you carry {item}",
    "tell me about the {item}",
    "tell me about your {items}",
    "what is the {item}",
    "what are the {items}",
    "what is in the {item}",
    "what comes in the {item}",
    "what comes with the {item}",
    "what are my options for {items}",
    "what options do you have for {items}",
    "what choices do i have for {items}",
    "what kind of {items} do you have",
    "what kinds of {items} do you got",
    "what types of {items} are there",
    "what type of {items} do you have",
    "what {items} are on the menu",
    "what {items} are available",
    "is {item} on the menu",
    "is the {item} available",
    "is the {item} still on the menu",
    "what flavors of {item} do you have",
    "what sizes does the {item} come in",
    "can you tell me about the {item}",
    "can you describe the {item}",
    "i want to know about the {item}",
    "i want to know what {items} you have",
    "run me through the {items}",
    "walk me through the {items}",
    "go over the {items} for me",
    "list the {items} for me",
    "show me the {items}",
    "read me the {items}",
    "what is on the {section} menu",
    "what do you have on the {section} menu",
    "let me hear the {items}",
    "let me see the {items}",
    "what all do you have for {items}",
    "what all is on the {section} menu",
    "what is included in the {item}",
    "what does the {item} come with",
    "does the {item} come with fries",
    "does the {item} come with a drink",
    "what toppings are on the {item}",
    "what is on the {item}",
]

items_singular = [
    "Big Mac", "Quarter Pounder", "McChicken", "McCrispy", "McDouble",
    "Filet-O-Fish", "McRib", "Spicy McChicken", "Double Cheeseburger",
    "Egg McMuffin", "Sausage McMuffin", "McGriddles", "Hotcakes",
    "Sausage Burrito", "Hash Browns", "Bacon Egg Cheese Biscuit",
    "McFlurry", "Apple Pie", "Sundae", "Vanilla Cone",
    "Happy Meal", "Chicken McNuggets", "McValue Meal Deal",
    "Daily Double", "Crispy Chicken Sandwich", "Spicy Deluxe",
    "10 Piece McNuggets Meal", "Big Mac Meal", "Quarter Pounder Meal",
    "Caramel Frappe", "Iced Coffee", "Chocolate Shake",
    "4 Piece McNuggets", "6 Piece McNuggets", "20 Piece McNuggets",
]

items_plural = [
    "burgers", "sandwiches", "chicken sandwiches", "nuggets",
    "breakfast items", "breakfast sandwiches", "breakfast meals",
    "desserts", "ice cream", "shakes", "frappes", "drinks", "beverages",
    "coffee drinks", "sides", "fries", "salads", "wraps",
    "happy meals", "value meals", "meal deals", "combos",
    "mcvalue items", "mcvalue deals", "bogo items", "eats items",
    "lunch items", "dinner options", "snacks", "cookies",
    "pies", "mcflurry flavors", "sauce options", "sauces",
    "chicken options", "fish options", "beef options",
    "extra value meals", "breakfast bogo options",
]

sections = [
    "breakfast", "lunch", "dinner", "dessert", "beverage",
    "mcvalue", "value", "kids", "late night", "snack",
]

# Prefixes to add natural variation
prefixes = [
    "hey ", "yo ", "uh ", "um ", "so ", "ok ", "alright ", "dude ",
    "bro ", "like ", "actually ", "hey can you ", "excuse me ",
    "", "", "", "", "", "",  # empty prefix weighted higher
]

suffixes = [
    "", "", "", "", "",  # empty suffix weighted higher
    " please", " thanks", " real quick", " for me",
    " right now", " today", " bro", " dude",
]

for _ in range(400):
    tmpl = random.choice(menu_templates)
    prefix = random.choice(prefixes)
    suffix = random.choice(suffixes)

    if "{item}" in tmpl and "{items}" not in tmpl:
        item = random.choice(items_singular)
        text = prefix + tmpl.format(item=item) + suffix
        td = {"category": "menu", "item": item}
    elif "{items}" in tmpl:
        items = random.choice(items_plural)
        text = prefix + tmpl.format(items=items) + suffix
        td = {"category": "menu", "section": items}
    elif "{section}" in tmpl:
        section = random.choice(sections)
        text = prefix + tmpl.format(section=section) + suffix
        td = {"category": "menu", "section": section}
    else:
        text = prefix + tmpl + suffix
        td = {"category": "menu"}

    examples.append({
        "input": text.strip(),
        "behavior": "menu_inquiry",
        "target_action": "menu_lookup",
        "target_data": td,
        "expected_response_contains": [],
        "context": "menu_inquiry",
    })

# ============================================================================
# VALUE_RECOMMENDATION — asking for ADVICE / SUGGESTIONS
# Key differentiator: "recommend", "suggest", "what should I", "best deal"
# ============================================================================
value_templates = [
    "what do you recommend",
    "what would you recommend",
    "what do you suggest",
    "what would you suggest",
    "what should i get",
    "what should i order",
    "what is the best deal",
    "what is the best value",
    "what is the best bang for my buck",
    "recommend something for me",
    "suggest something good",
    "give me a recommendation",
    "give me a suggestion",
    "help me pick something",
    "help me decide what to get",
    "help me choose",
    "pick something for me",
    "choose something for me",
    "surprise me with something good",
    "what is popular here",
    "what do most people get",
    "what is your most popular item",
    "what is the fan favorite",
    "what sells the most",
    "what is the go to order",
    "what is the move here",
    "which deal should i get",
    "which combo is the best",
    "which meal is the best value",
    "should i get the meal deal or the bogo",
    "which one is better the meal deal or buying separate",
    "is the bogo or the meal deal a better deal",
    "what is the smartest order",
    "what is the most filling for the least money",
    "i want something good but cheap what should i get",
    "i am on a budget recommend something",
    "i only have five dollars what can i get",
    "i only have ten bucks what should i order",
    "i am really hungry suggest something big",
    "i just want a quick bite suggest something small",
    "what is good here for breakfast",
    "what is the best breakfast item",
    "what is good for lunch today",
    "recommend the best chicken item",
    "recommend the best burger",
    "what is the tastiest thing on the menu",
    "what is the best thing you sell",
    "suggest something for someone who has never been here",
    "what would you order if you worked here",
    "what is your personal recommendation",
    "if you had to pick one thing what would it be",
    "recommend me a good meal deal",
    "which bogo deal is the most worth it",
    "which eats item is the best",
    "suggest a good combo for two people",
    "what should two people order to share",
    "recommend the best mcvalue deal",
    "which mcvalue item is the best bang for your buck",
    "help me find the best deal",
    "point me to the best value on the menu",
    "steer me towards something good and affordable",
]

value_qualifiers = [
    "for breakfast", "for lunch", "for dinner", "for a snack",
    "on a budget", "that is filling", "that is cheap",
    "for two people", "for my kids", "for someone hungry",
    "from the mcvalue menu", "from the deals",
    "", "", "", "", "",  # empty weighted higher
]

for _ in range(350):
    tmpl = random.choice(value_templates)
    prefix = random.choice(prefixes)
    suffix = random.choice(suffixes)
    qualifier = random.choice(value_qualifiers)

    text = prefix + tmpl
    if qualifier:
        text += " " + qualifier
    text += suffix

    examples.append({
        "input": text.strip(),
        "behavior": "value_recommendation",
        "target_action": "recommend_value",
        "target_data": {"category": "mcvalue", "suggest": ["Meal Deal", "Buy One Add One", "Eats"]},
        "expected_response_contains": ["McValue"],
        "context": "mcvalue_recommendation",
    })

# ============================================================================
# TIME_CHECK — availability / timing / hours questions
# Key differentiator: "right now", "still", "when", "what time", "available"
# ============================================================================
time_templates = [
    "do you still serve {item} right now",
    "is it too late for {item}",
    "is it too early for {item}",
    "can i still get {item}",
    "can i get {item} right now",
    "am i too late for {item}",
    "am i too early for {item}",
    "when does {daypart} end",
    "when does {daypart} start",
    "what time does {daypart} end",
    "what time does {daypart} start",
    "what time do you switch to {daypart}",
    "what time does the {daypart} menu start",
    "what time does the {daypart} menu end",
    "is {item} available right now",
    "is the {item} available at this time",
    "are you still serving {daypart}",
    "are you still doing {daypart}",
    "is it {daypart} time still",
    "did i miss {daypart}",
    "have you switched to {daypart} yet",
    "when do you stop serving {item}",
    "when do you start serving {item}",
    "are you open right now",
    "what time do you close",
    "what time do you open",
    "when does the drive thru close",
    "when does the lobby close",
    "is the lobby open",
    "how late are you open",
    "are you open 24 hours",
    "what are your hours",
    "what are the hours today",
    "is the ice cream machine working right now",
    "do you have the mcflurry machine on",
    "is the {deal} still going on",
    "is the {deal} available today",
    "when does the {deal} end",
    "how long is the {deal} going for",
    "is the {deal} an all day thing",
    "can i still use the {deal} right now",
]

time_items = [
    "breakfast", "Egg McMuffin", "McGriddles", "Hotcakes",
    "Sausage McMuffin", "Sausage Burrito", "Hash Browns",
    "Bacon Egg Cheese Biscuit", "lunch", "Big Mac",
    "Quarter Pounder", "McNuggets", "McCrispy",
    "breakfast burritos", "pancakes", "the breakfast menu",
]

dayparts = ["breakfast", "lunch", "dinner", "late night"]

deals = [
    "mcvalue deal", "meal deal", "bogo deal", "buy one add one",
    "five dollar deal", "breakfast bogo", "mcvalue breakfast",
    "daily double deal", "eats deal",
]

for _ in range(250):
    tmpl = random.choice(time_templates)
    prefix = random.choice(prefixes)
    suffix = random.choice(suffixes)

    if "{item}" in tmpl:
        item = random.choice(time_items)
        text = prefix + tmpl.format(item=item) + suffix
        td = {"category": "menu", "item": item}
    elif "{daypart}" in tmpl:
        dp = random.choice(dayparts)
        text = prefix + tmpl.format(daypart=dp) + suffix
        td = {"category": "menu", "daypart": dp}
    elif "{deal}" in tmpl:
        deal = random.choice(deals)
        text = prefix + tmpl.format(deal=deal) + suffix
        td = {"category": "mcvalue", "deal": deal}
    else:
        text = prefix + tmpl + suffix
        td = {"category": "store"}

    examples.append({
        "input": text.strip(),
        "behavior": "time_check",
        "target_action": "check_availability",
        "target_data": td,
        "expected_response_contains": [],
        "context": "time_check",
    })

# Deduplicate by input text
seen = set()
unique = []
for ex in examples:
    key = ex["input"].lower()
    if key not in seen:
        seen.add(key)
        unique.append(ex)

random.shuffle(unique)

# Write
outpath = "/Users/robertlong/CascadeProjects/Radiant/apps/omega-lab/data/mcvalue-augment-v2.jsonl"
with open(outpath, "w") as f:
    for ex in unique:
        f.write(json.dumps(ex) + "\n")

from collections import Counter
dist = Counter(ex["behavior"] for ex in unique)
print(f"Generated {len(unique)} unique examples:")
for b, c in sorted(dist.items(), key=lambda x: -x[1]):
    print(f"  {b}: {c}")
