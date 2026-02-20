#!/usr/bin/env python3
"""
Generate v3 augmentation focused on fixing menu_inquiry (71.3%) and 
price_inquiry (86.8%) confusion with take_order.

Key insight: menu_inquiry MUST use information-seeking language ONLY:
  "what do you have", "tell me about", "describe", "list", "what are"
NOT ordering language: "can I get", "give me", "I want", "let me get"
"""
import json, random

random.seed(2026)
examples = []

# ============================================================================
# MENU_INQUIRY — purely informational, NO ordering intent
# ============================================================================

# Pattern 1: "what [category] do you have" — clearly asking for information
what_do_you_have = [
    "what burgers do you have",
    "what chicken sandwiches do you have",
    "what chicken items do you have",
    "what nugget sizes do you have",
    "what breakfast sandwiches do you have",
    "what breakfast items do you have",
    "what desserts do you have",
    "what ice cream do you have",
    "what shakes do you have",
    "what drinks do you have",
    "what coffee drinks do you have",
    "what sides do you have",
    "what fries sizes do you have",
    "what happy meal options do you have",
    "what fish items do you have",
    "what wraps do you have",
    "what salads do you have",
    "what mccafe drinks do you have",
    "what value meals do you have",
    "what meal deals do you have",
    "what bogo options do you have",
    "what mcvalue items do you have",
    "what extra value meals do you have",
    "what sandwich options do you have",
    "what beef items do you have",
    "what pies do you have",
    "what cookies do you have",
    "what sauces do you have",
    "what dipping sauces do you have",
    "what sauce options do you have",
    "what condiments do you have",
    "what toppings do you have",
    "what cheese options do you have",
    "what bun options do you have",
    "what sizes do you have",
    "what drink sizes do you have",
    "what combos do you have",
    "what meals do you have",
    "what specials do you have",
    "what new items do you have",
    "what limited time items do you have",
    "what seasonal items do you have",
]

# Pattern 2: "tell me about" / "describe" — clearly informational
tell_me_about = [
    "tell me about the big mac",
    "tell me about the quarter pounder",
    "tell me about the mcchicken",
    "tell me about the mccrispy",
    "tell me about the filet o fish",
    "tell me about the mcvalue deals",
    "tell me about the meal deals",
    "tell me about the bogo deal",
    "tell me about the buy one add one",
    "tell me about the eats menu",
    "tell me about the happy meal",
    "tell me about the mcflurry",
    "tell me about the breakfast menu",
    "tell me about the extra value meals",
    "tell me about your chicken options",
    "tell me about your burger options",
    "tell me about your dessert options",
    "tell me about your drink options",
    "tell me about the mcnuggets",
    "tell me about the daily double",
    "tell me about the sausage mcmuffin",
    "tell me about the egg mcmuffin",
    "tell me about the mcgriddles",
    "tell me about the hotcakes",
    "tell me about the hash browns",
    "tell me about your coffee",
    "tell me about the frappes",
    "tell me about the smoothies",
    "describe the big mac for me",
    "describe the quarter pounder",
    "describe the mccrispy sandwich",
    "describe the mcvalue meal deal",
    "describe what comes in the happy meal",
    "describe the breakfast bogo deal",
    "describe the eats section",
    "describe the filet o fish",
]

# Pattern 3: "what is" / "what are" — definition/info seeking
what_is = [
    "what is the big mac",
    "what is on the big mac",
    "what is in the big mac",
    "what is the quarter pounder",
    "what is on the quarter pounder",
    "what is the mccrispy",
    "what is the mcvalue",
    "what is the meal deal",
    "what is the bogo deal",
    "what is the buy one add one deal",
    "what is the eats section",
    "what is the daily double",
    "what is the mcflurry",
    "what is a happy meal",
    "what is in the happy meal",
    "what is in the egg mcmuffin",
    "what is on the mcchicken",
    "what is in the mcgriddle",
    "what are the ingredients in the big mac",
    "what are the toppings on the quarter pounder",
    "what are the happy meal toy options",
    "what are the mcflurry flavors",
    "what are the shake flavors",
    "what are the sauce choices",
    "what are the mcvalue deal options",
    "what are the bogo eligible items",
    "what are the meal deal choices",
    "what are the breakfast combos",
    "what are the lunch combos",
    "what are the extra value meal options",
    "what are your most popular items",
    "what are the new items",
]

# Pattern 4: "what comes with/in" — asking about contents
what_comes = [
    "what comes with the big mac meal",
    "what comes with the quarter pounder meal",
    "what comes with the mcnuggets meal",
    "what comes with the happy meal",
    "what comes with the mccrispy meal",
    "what comes with the mcvalue meal deal",
    "what comes with the filet o fish meal",
    "what comes in the mcvalue meal deal",
    "what comes in the extra value meal",
    "what comes in the happy meal",
    "what comes in the breakfast combo",
    "what does the big mac meal include",
    "what does the meal deal include",
    "what does the bogo deal include",
    "what does the extra value meal include",
    "what does the happy meal come with",
    "what is included in the meal deal",
    "what is included in the extra value meal",
    "what is included in the big mac meal",
    "what is included in the breakfast combo",
    "what drink comes with the meal",
    "what size fries comes with the meal",
]

# Pattern 5: "is [item] on the menu" — availability check (NOT ordering)
is_on_menu = [
    "is the mcrib on the menu",
    "is the shamrock shake on the menu",
    "is the mcgriddle on the menu",
    "is the snack wrap still on the menu",
    "is the filet o fish on the menu",
    "is the big mac on the menu",
    "is the spicy mcchicken on the menu",
    "is the double quarter pounder on the menu",
    "is the bacon quarter pounder on the menu",
    "is the grand mac on the menu",
    "is the mac jr on the menu",
    "is the travis scott meal on the menu",
    "is the crispy chicken on the menu",
    "is the mcflurry on the menu",
    "are mcnuggets on the menu",
    "are breakfast burritos on the menu",
    "are salads on the menu",
    "are wraps still on the menu",
]

# Pattern 6: "what options/choices" — clearly browsing
what_options = [
    "what are my choices for sandwiches",
    "what are my options for chicken",
    "what are the burger choices",
    "what are the breakfast choices",
    "what options do i have for lunch",
    "what options are there for dinner",
    "what choices do i have for dessert",
    "what are the drink options",
    "what options are there for kids",
    "what are the side options",
    "what are the dipping sauce options",
    "what options do i have for coffee",
    "what choices are there for shakes",
    "what are the mcflurry options",
    "what are the pie options",
    "what are the cookie options",
    "what meal options are available",
    "what value options do you offer",
    "what deal options are available right now",
    "what are the mcvalue options",
]

# Pattern 7: "list/show/read/run through" — browsing the menu
list_items = [
    "list your burgers",
    "list your chicken sandwiches",
    "list the breakfast items",
    "list the mcvalue deals",
    "list the desserts",
    "list the drink options",
    "list the sides",
    "list the happy meal options",
    "show me the burgers",
    "show me the chicken options",
    "show me the breakfast menu",
    "show me the mcvalue menu",
    "show me the dessert options",
    "read me the menu",
    "read me the breakfast menu",
    "read me the lunch menu",
    "read me the mcvalue options",
    "read me the dessert menu",
    "run through the menu for me",
    "run through the burgers",
    "run through the chicken options",
    "run through the breakfast items",
    "run through the deals for me",
    "go over the menu for me",
    "go over the breakfast options",
    "go over the mcvalue deals",
    "go over the dessert options",
    "walk me through the menu",
    "walk me through the deals",
    "walk me through the breakfast options",
    "walk me through the mcvalue menu",
]

# Pattern 8: General menu browsing
general_browse = [
    "what is on the menu",
    "what is on your menu",
    "what do you sell",
    "what do you serve",
    "what do you offer",
    "what can i choose from",
    "what is available",
    "what is on the menu today",
    "what are you serving today",
    "what do you have on the menu today",
    "i want to hear the menu",
    "i want to know what is on the menu",
    "i need to hear the options first",
    "i need to know what you have before i order",
    "let me hear the menu first",
    "let me hear the options",
    "can you read the menu to me",
    "can you go over the menu",
    "can you list the options",
    "can you tell me the menu",
    "just tell me what you got",
    "just run through the options",
    "just list what is available",
    "give me the rundown on the menu",
    "give me the rundown on breakfast",
    "give me the rundown on the deals",
    "what kind of food do you have",
    "what kind of meals do you have",
    "what all do you have",
    "what all is available right now",
]

all_menu = (what_do_you_have + tell_me_about + what_is + what_comes +
            is_on_menu + what_options + list_items + general_browse)

prefixes = ["", "", "", "", "", "hey ", "yo ", "uh ", "um ", "so ", "ok so ",
            "alright ", "bro ", "dude ", "excuse me ", "hey can you ", "oh "]
suffixes = ["", "", "", "", "", " please", " thanks", " real quick",
            " for me", " bro", " dude"]

for base in all_menu:
    prefix = random.choice(prefixes)
    suffix = random.choice(suffixes)
    text = (prefix + base + suffix).strip()
    examples.append({
        "input": text,
        "behavior": "menu_inquiry",
        "target_action": "menu_lookup",
        "target_data": {"category": "menu"},
        "expected_response_contains": [],
        "context": "menu_inquiry",
    })

# ============================================================================
# PRICE_INQUIRY reinforcement — focus on "how much" / "price" / "cost"
# ============================================================================
price_bases = [
    "how much is the big mac",
    "how much is the quarter pounder",
    "how much is the mcchicken",
    "how much is the mccrispy",
    "how much is the mcnuggets",
    "how much is the 6 piece",
    "how much is the 10 piece",
    "how much is the 20 piece",
    "how much is the filet o fish",
    "how much is the double cheeseburger",
    "how much is the mcdouble",
    "how much is the daily double",
    "how much is the big mac meal",
    "how much is the quarter pounder meal",
    "how much is the mcnuggets meal",
    "how much is the mccrispy meal",
    "how much is the egg mcmuffin meal",
    "how much is the mcgriddles meal",
    "how much is the happy meal",
    "how much is the mcflurry",
    "how much is the apple pie",
    "how much is the sundae",
    "how much is the vanilla cone",
    "how much is the chocolate shake",
    "how much is a large fries",
    "how much is a medium fries",
    "how much is a small fries",
    "how much is a large coke",
    "how much is a sweet tea",
    "how much is an iced coffee",
    "how much is the caramel frappe",
    "how much is the meal deal",
    "how much is the five dollar deal",
    "how much is the bogo deal",
    "how much is the eats deal",
    "what does the big mac cost",
    "what does the quarter pounder cost",
    "what does the mcchicken cost",
    "what does the mcnuggets cost",
    "what does the meal deal cost",
    "what does the happy meal cost",
    "what is the price of the big mac",
    "what is the price of the quarter pounder",
    "what is the price of the mcnuggets",
    "what is the price of the meal deal",
    "what is the price of the filet o fish",
    "what is the price of the mccrispy",
    "price on the big mac",
    "price on the quarter pounder",
    "price on the mcnuggets",
    "price on the meal deal",
    "price on the happy meal",
    "price on the egg mcmuffin",
    "price check on the big mac",
    "price check on the quarter pounder",
    "price check on the mcdouble",
    "give me the price on the big mac",
    "give me the price on the meal deal",
    "give me the price on the mcnuggets",
    "what are your prices",
    "what are the prices on the menu",
    "what are the meal deal prices",
    "what are the extra value meal prices",
    "what are the breakfast prices",
    "what are the mcvalue prices",
    "how much for a big mac",
    "how much for a quarter pounder",
    "how much for a mcchicken",
    "how much for nuggets",
    "how much for the meal",
    "how much for the combo",
    "how much for the drink",
    "how much for the fries",
    "how much for the dessert",
    "how much total",
    "how much is my order",
    "how much is everything",
    "how much am i at so far",
    "how much will that be",
    "how much do i owe",
    "what is the total",
    "what is the damage",
    "what am i looking at price wise",
    "how much money do i need",
    "cost of the big mac",
    "cost of the meal deal",
    "cost of the mcnuggets",
    "total cost please",
]

for base in price_bases:
    prefix = random.choice(prefixes)
    suffix = random.choice(suffixes)
    text = (prefix + base + suffix).strip()
    examples.append({
        "input": text,
        "behavior": "price_inquiry",
        "target_action": "price_lookup",
        "target_data": {"category": "pricing"},
        "expected_response_contains": [],
        "context": "price_inquiry",
    })

# Deduplicate
seen = set()
unique = []
for ex in examples:
    key = ex["input"].lower().strip()
    if key not in seen:
        seen.add(key)
        unique.append(ex)

random.shuffle(unique)

outpath = "/Users/robertlong/CascadeProjects/Radiant/apps/omega-lab/data/mcvalue-augment-v3.jsonl"
with open(outpath, "w") as f:
    for ex in unique:
        f.write(json.dumps(ex) + "\n")

from collections import Counter
dist = Counter(ex["behavior"] for ex in unique)
print(f"Generated {len(unique)} unique examples:")
for b, c in sorted(dist.items(), key=lambda x: -x[1]):
    print(f"  {b}: {c}")
