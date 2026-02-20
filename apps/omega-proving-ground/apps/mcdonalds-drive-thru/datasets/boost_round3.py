#!/usr/bin/env python3
"""
Round 3 data augmentation: Target the 4 remaining behaviors below 97%.

After round 3 training (temp=15, 8 ODE steps):
  menu_inquiry:   95.0%  (needs +2.0%)
  take_order:     95.5%  (needs +1.5%)
  order_modify:   96.2%  (needs +0.8%)
  price_inquiry:  96.8%  (needs +0.2%)

Strategy: Add hard-negative pairs that disambiguate these confusion clusters.
Each behavior gets distinctive patterns the model can latch onto.
"""
import json
import random
from pathlib import Path

DATASET = Path(__file__).parent / 'mcdonalds-behavioral-training.jsonl'

# ── menu_inquiry: "WHAT do you have / serve / offer" (NO specific item, NO price)
MENU_INQUIRY = [
    # Pattern: asking about categories/options available
    "what burgers do you have",
    "what sandwiches are on the menu",
    "what kind of drinks do you serve",
    "show me the menu",
    "what are my options for lunch",
    "what's available right now",
    "do you have any wraps",
    "what flavors of McFlurry do you have",
    "what comes in a Happy Meal",
    "what sides do you offer",
    "can you tell me what's on the menu",
    "what are your breakfast options",
    "do you still have the McRib",
    "what fish sandwiches do you have",
    "is there anything new on the menu",
    "what are your salad options",
    "do you have any vegetarian options",
    "what desserts do you serve",
    "tell me about your chicken options",
    "what's on the breakfast menu",
    "do you have smoothies",
    "what McCafe drinks are available",
    "what types of coffee do you have",
    "do you serve ice cream",
    "what's on the value menu",
    "what kinds of nugget sauces do you have",
    "do you have apple pies",
    "what are your combo meal options",
    "is the shamrock shake available",
    "what sizes of fries do you have",
    "do you have mozzarella sticks",
    "what's new on the menu today",
    "can I see your drink options",
    "what hot drinks do you offer",
    "do you have anything spicy",
    "what are your premium burgers",
    "what chicken nugget sizes do you offer",
    "do you have any limited time items",
    "what's on the dollar menu these days",
    "what are the Happy Meal toy options",
    "do you serve oatmeal",
    "what muffins do you have",
    "do you have fruit on the menu",
    "what iced coffee flavors are available",
    "tell me your sauce selection",
    "do you have hash browns all day",
    "what types of McMuffins do you offer",
    "do you carry any organic items",
    "what are your kids meal choices",
    "what's your most popular item",
    # Hard negatives: these SOUND like ordering but are inquiries
    "what Big Macs do you have",
    "do you have McNuggets",
    "is the Filet-O-Fish available",
    "do you carry the Quarter Pounder",
    "what about chicken sandwiches",
    "any specials today",
    "what's the soup of the day",
    "do you have a fish option",
    "what burgers come with bacon",
    "is there a spicy chicken sandwich",
]

# ── take_order: "I WANT / GIVE ME / LET ME GET" (specific item, imperative)
TAKE_ORDER = [
    # Pattern: direct request with quantity or specific item
    "I want a Big Mac",
    "give me two cheeseburgers",
    "let me get a number 3 combo",
    "I'll take a McDouble",
    "one McChicken please",
    "can I get a Quarter Pounder",
    "I'd like three McChickens",
    "give me a 20 piece nuggets",
    "I want the number 1 combo",
    "let me have a Filet-O-Fish",
    "two Big Macs please",
    "I'll get a double cheeseburger",
    "one large fries please",
    "give me a 6 piece nuggets",
    "I want a chocolate shake",
    "can I have a large Coke",
    "let me get two apple pies",
    "I'll take a Happy Meal",
    "give me a McFlurry with Oreos",
    "I want a medium Dr Pepper",
    "one sundae please",
    "can I get a vanilla cone",
    "I'd like a southwest salad",
    "give me a bacon McDouble",
    "let me get the crispy chicken",
    "I'll have two orders of fries",
    "I want a caramel frappe",
    "one iced coffee please",
    "give me a sausage McMuffin",
    "I'd like a hash brown",
    # Hard negatives: sound like inquiries but are orders
    "yeah the Big Mac",
    "the Quarter Pounder please",
    "number 5 combo",
    "a McChicken and a large fries",
    "two cheeseburger Happy Meals",
    "I'll do the 10 piece",
    "get me a sweet tea",
    "put me down for a Big Mac",
    "add a large fries to that",
    "and a Coke with that",
    # More ordering patterns
    "I need a Big Mac combo",
    "I'm gonna get the double quarter pounder",
    "hook me up with some nuggets",
    "throw in a McFlurry",
    "I'll start with a Big Mac",
    "first thing I want is a McChicken",
    "for my meal I'll have the number 7",
    "gimme a McDouble and fries",
    "I want to order a filet o fish sandwich",
    "please give me a 4 piece nuggets",
]

# ── order_modify: "CHANGE / SWITCH / REMOVE / INSTEAD" (modifying existing order)
ORDER_MODIFY = [
    # Pattern: explicitly referencing changing something already ordered
    "actually change that to a McChicken",
    "wait switch the Big Mac to a Quarter Pounder",
    "can you change my drink to a Sprite",
    "I changed my mind take off the fries",
    "remove the shake from my order",
    "cancel the nuggets I ordered",
    "instead of the Big Mac give me a McDouble",
    "swap my Coke for a Dr Pepper",
    "wait take that last item off",
    "actually I don't want the McFlurry anymore",
    "change my combo from a 1 to a 3",
    "can you switch my fries to a salad",
    "remove the apple pie I just ordered",
    "I want to change my drink order",
    "hold on take the cheeseburger off",
    "wait actually make that a large combo instead",
    "switch my McChicken to a crispy chicken",
    "can you take the sundae off my order",
    "I changed my mind about the nuggets",
    "actually cancel the Happy Meal",
    "replace my order of the Big Mac with a McDouble",
    "modify my combo to be a number 5 instead",
    "I need to change what I just ordered",
    "wait go back and change my burger",
    "scratch the last thing I said",
    "take that back I don't want fries",
    "actually switch from regular to large",
    "can I change from 6 piece to 10 piece",
    "remove one of the cheeseburgers",
    "cancel my last item",
    # Hard negatives: sound like new orders but are modifications
    "no wait make it a Big Mac instead",
    "actually the Quarter Pounder",
    "hold on switch that",
    "never mind on the fries",
    "change of plans I want the chicken",
    "let me switch to something else",
    "go back to the burger I want to change it",
    "actually you know what change my whole order",
    "take off one of those and add a different one",
    "I want to modify my previous item",
]

# ── price_inquiry: "HOW MUCH / WHAT'S THE PRICE / COST" (asking about money)
PRICE_INQUIRY = [
    # Pattern: explicit price/cost/money language
    "how much is a Big Mac",
    "what's the price of a Quarter Pounder",
    "how much does the 10 piece cost",
    "what's a McChicken run",
    "how much for a large combo",
    "what does a Happy Meal cost",
    "how much is a McFlurry",
    "what's the price on nuggets",
    "how much is a large fries",
    "what would a number 3 combo be",
    "how much for two Big Macs",
    "what's the cost of a shake",
    "how much is the Filet-O-Fish",
    "what do you charge for a sundae",
    "how much is a medium drink",
    "what's the damage for a 20 piece",
    "how much would a McDouble cost me",
    "what's the price for breakfast",
    "how much are the apple pies",
    "what does a caramel frappe cost",
    "how much is the dollar menu stuff",
    "what's the cheapest burger",
    "how much for a sausage McMuffin",
    "what's the most expensive combo",
    "how much is an iced coffee",
    "what do hash browns cost",
    "how much for a kids meal",
    "what's the going rate on a Big Mac meal",
    "how much is it for extra sauce",
    "what would my total be for a Big Mac and fries",
    # Hard negatives: mention items but ask about price
    "what's the Big Mac going for these days",
    "is the McChicken still a dollar",
    "how much did the price go up",
    "what's the cheapest thing on the menu",
    "is there anything under 5 dollars",
    "how expensive is the Quarter Pounder meal",
    "what's the price difference between medium and large",
    "how much more for the large size",
    "can you tell me the total cost",
    "what would it cost to add bacon",
]


def main():
    # Read existing data
    existing = []
    with open(DATASET) as f:
        for line in f:
            existing.append(json.loads(line))
    print(f"Existing: {len(existing)} examples")

    def make_ex(text, behavior):
        return {
            "input": text,
            "behavior": behavior,
            "target_action": behavior,
            "target_data": {},
            "expected_response_contains": [],
            "context": None,
        }

    new_examples = []
    for text in MENU_INQUIRY:
        new_examples.append(make_ex(text, "menu_inquiry"))
    for text in TAKE_ORDER:
        new_examples.append(make_ex(text, "take_order"))
    for text in ORDER_MODIFY:
        new_examples.append(make_ex(text, "order_modify"))
    for text in PRICE_INQUIRY:
        new_examples.append(make_ex(text, "price_inquiry"))

    # Duplicate each example 8x for emphasis (these are targeted hard examples)
    augmented = []
    for ex in new_examples:
        for _ in range(8):
            augmented.append(ex)

    print(f"New examples: {len(new_examples)} unique, {len(augmented)} after 8x duplication")

    # Merge
    combined = existing + augmented
    random.seed(42)
    random.shuffle(combined)

    with open(DATASET, 'w') as f:
        for ex in combined:
            f.write(json.dumps(ex) + '\n')

    print(f"Written: {len(combined)} total examples to {DATASET}")

    # Count per behavior
    from collections import Counter
    counts = Counter(ex['behavior'] for ex in combined)
    for b in sorted(counts):
        print(f"  {b:30s} {counts[b]:>6d}")


if __name__ == '__main__':
    main()
