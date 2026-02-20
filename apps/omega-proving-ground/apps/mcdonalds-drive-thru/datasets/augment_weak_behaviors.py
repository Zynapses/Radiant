#!/usr/bin/env python3
"""
Augment weak behaviors in the McDonald's behavioral training dataset.

Problem: Massive class imbalance (59:1 ratio) + semantic overlap between inquiry behaviors.
Solution: Generate ~2500 diverse examples per weak behavior with sharply distinct phrasing.

Semantic boundaries enforced:
  menu_inquiry:         "What items do you have?" — EXISTENCE of items/categories
  price_inquiry:        "How much is the Big Mac?" — COST of a specific item
  value_recommendation: "What's a good deal?"     — RECOMMENDATION / best value
  time_check:           "Is breakfast still on?"   — TIME / availability windows
  order_modify:         "Change my fries to large"  — MODIFY an existing order
  take_order_breakfast:  "I'll have an Egg McMuffin" — ORDER a breakfast item
"""

import json
import random
import itertools
from pathlib import Path

random.seed(42)

# ── Filler/style templates to match existing dataset's casual tone ──
FILLERS = ['', 'um ', 'uh ', 'like ', 'so ', 'hey ', 'yo ', 'dude ', 'man ', 'listen ',
           'actually ', 'ok ', 'alright ', 'hmm ']
ENDINGS = ['', ' please', ' thanks', ' bro', ' for me', ' right now', ' today',
           ' instead', ' real quick', ' if you can']

# ── McDonald's menu items for realistic references ──
REGULAR_ITEMS = [
    'Big Mac', 'Quarter Pounder', 'Quarter Pounder with Cheese', 'McChicken',
    'McDouble', 'Double Cheeseburger', 'Filet-O-Fish', 'Chicken McNuggets',
    '10 piece nuggets', '20 piece nuggets', '6 piece nuggets', '4 piece nuggets',
    'large fries', 'medium fries', 'small fries', 'french fries',
    'Crispy Chicken Sandwich', 'Spicy Crispy Chicken Sandwich', 'Deluxe Crispy Chicken',
    'McFlurry', 'Oreo McFlurry', 'M&M McFlurry', 'vanilla cone', 'hot fudge sundae',
    'apple pie', 'chocolate shake', 'vanilla shake', 'strawberry shake',
    'Coke', 'Sprite', 'Dr Pepper', 'Hi-C Orange', 'sweet tea', 'iced coffee',
    'hot coffee', 'McCafe Latte', 'McCafe Mocha', 'Frappe',
    'Happy Meal', 'Mighty Kids Meal', 'Cheeseburger Happy Meal',
]

BREAKFAST_ITEMS = [
    'Egg McMuffin', 'Sausage McMuffin', 'Sausage McMuffin with Egg',
    'Bacon Egg and Cheese Biscuit', 'Sausage Biscuit', 'Sausage Biscuit with Egg',
    'Hotcakes', 'Hotcakes and Sausage', 'Big Breakfast', 'Big Breakfast with Hotcakes',
    'Fruit and Maple Oatmeal', 'Hash Browns', 'Sausage Burrito',
    'Bacon Egg and Cheese McGriddle', 'Sausage McGriddle', 'Sausage Egg and Cheese McGriddle',
    'Bacon Egg and Cheese Bagel',
]

MENU_CATEGORIES = [
    'breakfast menu', 'lunch menu', 'dinner menu', 'dollar menu', 'value menu',
    'dessert menu', 'drink menu', 'McCafe menu', 'chicken options', 'burger options',
    'sandwich options', 'salad options', 'sides', 'Happy Meal options',
    'combo meals', 'meal deals', 'specials', 'limited time items', 'new items',
]

SIZES = ['small', 'medium', 'large']
DRINKS = ['Coke', 'Sprite', 'Dr Pepper', 'Hi-C', 'sweet tea', 'lemonade', 'water', 'coffee', 'orange juice']
CUSTOMIZATIONS = ['no pickles', 'extra cheese', 'no onions', 'extra sauce', 'no lettuce',
                  'add bacon', 'no tomato', 'extra ketchup', 'light ice', 'no ice']


def make_examples(templates, behavior, target_action=None, target_data=None, count=2500):
    """Generate examples from templates with random fillers/endings."""
    target_action = target_action or behavior
    target_data = target_data or {}
    examples = []
    seen = set()

    while len(examples) < count:
        template = random.choice(templates)
        filler = random.choice(FILLERS)
        ending = random.choice(ENDINGS)
        text = f"{filler}{template}{ending}".strip()
        # Normalize whitespace
        text = ' '.join(text.split())

        if text.lower() not in seen:
            seen.add(text.lower())
            examples.append({
                'input': text,
                'behavior': behavior,
                'target_action': target_action,
                'target_data': target_data,
                'expected_response_contains': [],
                'context': None,
            })

    return examples


def gen_menu_inquiry():
    """EXISTENCE questions — what items/categories are available."""
    templates = []

    # Category browsing — the core of menu_inquiry
    for cat in MENU_CATEGORIES:
        templates.extend([
            f"what's on the {cat}",
            f"what do you have on the {cat}",
            f"can you tell me about the {cat}",
            f"what are your {cat}",
            f"do you have a {cat}",
            f"show me the {cat}",
            f"what comes on the {cat}",
            f"what's available on the {cat}",
            f"I want to see the {cat}",
            f"tell me about your {cat}",
        ])

    # General menu questions
    templates.extend([
        "what do you have",
        "what do you guys have",
        "what do you serve",
        "what's on the menu",
        "what's available",
        "what are my options",
        "what can I order",
        "what can I choose from",
        "what are you serving",
        "what kind of food do you have",
        "what items do you have",
        "what choices do I have",
        "what do you offer",
        "what all do you have",
        "what's available right now",
        "can you tell me the menu",
        "run me through the menu",
        "walk me through what you got",
        "read me the menu",
        "what's good here",
        "go over the menu for me",
        "let me hear the menu",
        "I need to see the menu first",
        "hold on let me look at the menu",
        "I'm not sure what I want yet",
        "I haven't decided yet what's on the menu",
        "what all do you have to eat",
        "give me a rundown of the menu",
    ])

    # Specific category existence
    templates.extend([
        "do you have salads",
        "do you have wraps",
        "do you guys have ice cream",
        "do you have smoothies",
        "do you still have the McRib",
        "are nuggets still available",
        "do you have chicken sandwiches",
        "do you sell breakfast all day",
        "do you have fish sandwiches",
        "is there anything new on the menu",
        "do you have any new items",
        "got any specials going on",
        "any limited time offers",
        "what new items do you have",
        "are you still serving lunch",
        "what kind of burgers do you have",
        "what chicken do you have",
        "what kind of drinks do you have",
        "what desserts do you have",
        "what sides do you have",
        "what kind of shakes do you have",
        "what kind of coffee do you have",
        "what McCafe drinks do you have",
        "what Happy Meal toys do you have",
        "what comes in the Happy Meal",
        "what comes in a combo meal",
        "what's in the Big Mac",
        "what comes on the McChicken",
        "what toppings can I get",
        "what sauces do you have",
        "what dipping sauces do you have",
        "what kind of sauce options are there",
    ])

    # Item-specific existence
    for item in random.sample(REGULAR_ITEMS, min(20, len(REGULAR_ITEMS))):
        templates.extend([
            f"do you have {item}",
            f"is the {item} still available",
            f"do you still carry {item}",
            f"do you serve {item}",
        ])

    return make_examples(templates, 'menu_inquiry', count=2500)


def gen_price_inquiry():
    """COST questions — how much does a specific item cost."""
    templates = []

    # Direct price questions for specific items
    for item in REGULAR_ITEMS:
        templates.extend([
            f"how much is the {item}",
            f"how much does the {item} cost",
            f"what's the price of the {item}",
            f"what does the {item} cost",
            f"how much for a {item}",
            f"what's a {item} run me",
            f"price on the {item}",
            f"how much is a {item} gonna cost me",
        ])

    for item in BREAKFAST_ITEMS[:8]:
        templates.extend([
            f"how much is the {item}",
            f"what's the price on the {item}",
            f"how much for a {item}",
        ])

    # General pricing
    templates.extend([
        "how much is a combo",
        "what are the combo prices",
        "how much is the meal upgrade",
        "what's the upcharge to make it a meal",
        "how much extra for large",
        "how much to upsize",
        "how much more for a large fries",
        "how much more for a large drink",
        "how much is the Happy Meal",
        "what does a Happy Meal cost",
        "what's the cheapest thing on the menu",
        "what's your most expensive item",
        "how much is the most expensive thing",
        "what's the cheapest burger",
        "how much are nuggets",
        "what's the price on fries",
        "how much for just fries",
        "how much is a drink",
        "how much is a medium drink",
        "what do drinks cost",
        "how much for an extra sauce",
        "is there a charge for extra sauce",
        "how much is tax",
        "what's the total going to be",
        "how much would that be",
        "how much for two Big Macs",
        "what would three McChickens cost",
        "how much if I add a drink",
        "how much to add fries",
        "what's the damage",
        "what's that gonna run me",
        "give me the price on that",
        "how much is it",
        "what's the cost",
        "tell me the prices",
        "I just want to know the price",
        "can you tell me the price of that",
        "what are your prices",
        "what are the prices on your combos",
    ])

    # Comparative pricing
    templates.extend([
        "which is cheaper the McChicken or the McDouble",
        "is the Big Mac more expensive than the Quarter Pounder",
        "which burger is the cheapest",
        "what's cheaper nuggets or a sandwich",
        "is it cheaper to get the meal",
        "do I save money with the combo",
    ])

    return make_examples(templates, 'price_inquiry', count=2500)


def gen_value_recommendation():
    """RECOMMENDATION questions — what's the best deal / what should I get."""
    templates = []

    # Direct recommendation requests
    templates.extend([
        "what do you recommend",
        "what would you recommend",
        "what should I get",
        "what should I order",
        "what's good here",
        "what do you suggest",
        "what's your best seller",
        "what's the most popular item",
        "what does everyone get",
        "what's your favorite thing here",
        "what would you get",
        "if you were me what would you order",
        "what's the move here",
        "what's worth getting",
        "what's the best thing on the menu",
        "what's the best burger you have",
        "what's your best chicken sandwich",
        "what's the best meal to get",
        "surprise me with something good",
        "pick something good for me",
        "just give me whatever's good",
        "what's fire here",
        "what slaps here",
        "what should I try",
        "I've never been here what should I get",
        "first time here what's good",
        "help me decide what to order",
        "I can't decide help me pick",
        "I don't know what I want suggest something",
    ])

    # Value/deal focused
    templates.extend([
        "what's the best deal",
        "what's the best bang for my buck",
        "what's the best value",
        "what's the most food for the money",
        "what's the most filling thing for cheap",
        "what gives me the most food",
        "what's a good deal right now",
        "any good deals going on",
        "what are your best deals",
        "what's the smartest thing to order",
        "what gets me the most for my money",
        "where do I get the most value",
        "how do I get the best deal here",
        "what's the most cost effective order",
        "I want a lot of food for not a lot of money",
        "feed me cheap",
        "what can I get that's filling and cheap",
    ])

    # Budget-constrained
    templates.extend([
        "I'm on a budget what should I get",
        "I only have five dollars what can I get",
        "I only have ten dollars what should I get",
        "I don't have a lot of money what's good",
        "cheapest way to fill up",
        "I need something cheap and filling",
        "what's good and affordable",
        "I'm broke what do you recommend",
        "what's the cheapest meal I can get",
        "what's a budget friendly option",
        "I want something good but not too expensive",
        "I need to stretch my dollars what should I get",
        "what can I get for under five bucks",
        "what can I get for under ten dollars",
        "I want to keep it cheap what should I order",
        "what's the most affordable way to eat here",
    ])

    # Situation-based recommendations
    templates.extend([
        "I'm really hungry what should I get",
        "I want something light what do you recommend",
        "what's good for a snack",
        "I just want something small and quick",
        "I'm feeding four people what should I order",
        "I need food for the whole family what's good",
        "what's a good combo to get",
        "what combo would you recommend",
        "which combo is the best",
        "what's better the Big Mac meal or the Quarter Pounder meal",
        "should I get nuggets or a burger",
        "is the McChicken or the Crispy Chicken better",
        "which is better the Filet-O-Fish or the McChicken",
        "what's the best McNuggets sauce",
        "which shake flavor is the best",
        "what McFlurry should I get",
    ])

    return make_examples(templates, 'value_recommendation', count=2500)


def gen_time_check():
    """TIME/AVAILABILITY questions — when is something served."""
    templates = []

    # Breakfast timing
    templates.extend([
        "is breakfast still available",
        "is it still breakfast time",
        "am I too late for breakfast",
        "can I still get breakfast",
        "is the breakfast menu still on",
        "are you still serving breakfast",
        "did I miss breakfast",
        "when does breakfast end",
        "what time does breakfast end",
        "what time do you stop serving breakfast",
        "how long until breakfast is over",
        "is breakfast over",
        "do you serve breakfast all day",
        "can I get breakfast after 10:30",
        "is breakfast available after 11",
        "when is the last call for breakfast",
        "what time is breakfast over",
        "is the breakfast still going",
        "how much longer for breakfast",
        "am I too late for the Egg McMuffin",
        "can I still order hotcakes",
        "is it too early for lunch",
        "is it too late for breakfast items",
    ])

    # Lunch/dinner timing
    templates.extend([
        "when does lunch start",
        "what time does the lunch menu start",
        "is it lunch time yet",
        "can I get a Big Mac yet",
        "are you serving lunch now",
        "when can I get a burger",
        "is the regular menu available",
        "when does the lunch menu come on",
        "has the lunch menu started",
        "can I order off the regular menu",
        "is the full menu available now",
        "what time do you switch to lunch",
        "when does the changeover happen",
        "when do you switch from breakfast to lunch",
    ])

    # Store hours
    templates.extend([
        "what time do you close",
        "what time do you open",
        "what are your hours",
        "are you open right now",
        "how late are you open",
        "are you guys 24 hours",
        "is the drive thru still open",
        "what time does the drive thru close",
        "is it too late to order",
        "are you still taking orders",
        "when do you stop taking orders",
        "how much longer are you open",
        "what time is last call",
        "do you close soon",
        "are you about to close",
        "what are your drive thru hours",
        "is the inside open",
        "what time does the lobby open",
        "can I still order food",
        "is the kitchen still open",
    ])

    # Specific availability windows
    templates.extend([
        "when is the McRib available",
        "is the Shamrock Shake available",
        "when do seasonal items come out",
        "are you still serving that limited time item",
        "when does the promotion end",
        "how long is this deal running",
        "is the deal still going on",
        "when does the special end",
        "is Happy Meal still available this late",
        "can I still get ice cream",
        "is the ice cream machine working",
        "is the shake machine down",
        "when will the ice cream machine be fixed",
        "is McCafe available right now",
        "can I get coffee this late",
    ])

    return make_examples(templates, 'time_check', count=2500)


def gen_order_modify():
    """MODIFY an existing order — change, remove, add, swap items."""
    templates = []

    # Remove items
    for item in random.sample(REGULAR_ITEMS, 15):
        templates.extend([
            f"actually remove the {item}",
            f"take off the {item}",
            f"I don't want the {item} anymore",
            f"cancel the {item}",
            f"scratch the {item}",
            f"never mind on the {item}",
            f"drop the {item} from my order",
        ])

    # Change items
    pairs = list(itertools.combinations(random.sample(REGULAR_ITEMS, 15), 2))
    for a, b in random.sample(pairs, min(30, len(pairs))):
        templates.extend([
            f"actually change the {a} to a {b}",
            f"swap the {a} for a {b}",
            f"can I switch the {a} to a {b}",
            f"make that a {b} instead of the {a}",
            f"I changed my mind make the {a} a {b}",
        ])

    # Size changes
    for item in ['fries', 'drink', 'Coke', 'coffee', 'shake']:
        for s1, s2 in [('small', 'medium'), ('medium', 'large'), ('small', 'large')]:
            templates.extend([
                f"make the {item} {s2} instead of {s1}",
                f"can I upsize the {item} to {s2}",
                f"change my {item} to a {s2}",
                f"actually make the {item} a {s2}",
            ])

    # Add items to existing order
    for item in random.sample(REGULAR_ITEMS, 15):
        templates.extend([
            f"also add a {item}",
            f"throw in a {item} too",
            f"can you add a {item} to that",
            f"I also want a {item}",
            f"add a {item} to my order",
            f"wait also give me a {item}",
        ])

    # Quantity changes
    templates.extend([
        "actually make that two",
        "make it a double order",
        "I need two of those",
        "change that to three",
        "actually just give me one",
        "I only want one not two",
        "make it two Big Macs instead of one",
        "can I change the quantity to three",
        "I want to add another one of those",
        "give me one more of the same",
    ])

    # General modification phrases
    templates.extend([
        "I want to change my order",
        "can I modify my order",
        "I need to change something",
        "wait I want to change that",
        "hold on let me change something",
        "actually can I switch that up",
        "I changed my mind",
        "let me redo my order",
        "scratch that last thing",
        "take that last item off",
        "remove the last thing I said",
        "I want to start over",
        "can I redo the whole order",
        "wait go back",
        "can I take something off",
        "I need to remove an item",
        "I need to swap something out",
        "let me switch something",
        "hold on I need to fix my order",
        "that's wrong let me change it",
        "wait that's not what I wanted",
        "no I said I wanted something else",
        "can I add something to my order",
        "I forgot to add something",
        "oh wait I also need something",
        "I want to add one more thing",
        "can I tack on one more item",
    ])

    # Drink swaps
    for d1, d2 in itertools.combinations(random.sample(DRINKS, 5), 2):
        templates.extend([
            f"switch the {d1} to a {d2}",
            f"change the drink to {d2} instead of {d1}",
        ])

    # Meal/combo modifications
    templates.extend([
        "make it a meal instead",
        "actually don't make it a combo",
        "take the combo off just the sandwich",
        "I don't want the meal just the burger",
        "upgrade that to a meal",
        "downgrade from the combo",
        "just the sandwich no meal",
        "actually yeah make it a combo",
        "I changed my mind make it a meal",
        "keep the fries but change the drink",
    ])

    return make_examples(templates, 'order_modify', count=2500)


def gen_take_order_breakfast():
    """ORDER a breakfast-specific item."""
    templates = []

    # Direct breakfast orders
    for item in BREAKFAST_ITEMS:
        templates.extend([
            f"I'll have a {item}",
            f"let me get a {item}",
            f"can I get a {item}",
            f"I want a {item}",
            f"give me a {item}",
            f"I'd like a {item}",
            f"I'll take a {item}",
            f"one {item}",
            f"let me do the {item}",
            f"I'll go with the {item}",
            f"get me a {item}",
            f"could I have a {item}",
            f"I need a {item}",
            f"hit me with a {item}",
            f"lemme get a {item}",
        ])

    # Breakfast combos
    for item in BREAKFAST_ITEMS[:10]:
        templates.extend([
            f"I'll have the {item} meal",
            f"can I get the {item} combo",
            f"give me the {item} with a hash brown and coffee",
            f"I want the {item} with orange juice",
        ])

    # Multiple breakfast items
    pairs = list(itertools.combinations(random.sample(BREAKFAST_ITEMS, 8), 2))
    for a, b in random.sample(pairs, min(20, len(pairs))):
        templates.extend([
            f"let me get a {a} and a {b}",
            f"I'll have the {a} and also a {b}",
        ])

    # Breakfast with customizations
    for item in BREAKFAST_ITEMS[:8]:
        templates.extend([
            f"I'll have a {item} with extra cheese",
            f"can I get the {item} no meat",
            f"give me a {item} add bacon",
        ])

    # General breakfast ordering
    templates.extend([
        "I want breakfast",
        "let me get something for breakfast",
        "what breakfast can I order",
        "I'll do the breakfast special",
        "give me a breakfast sandwich",
        "I want a breakfast combo",
        "I need some breakfast",
        "can I get some hash browns",
        "just some hash browns",
        "coffee and a hash brown",
        "I'll have two hash browns",
        "give me a large coffee and a McMuffin",
        "one Egg McMuffin and a coffee",
        "sausage and egg biscuit with a hash brown",
        "I want pancakes",
        "give me the hotcakes",
        "let me get the big breakfast",
        "I'll take the big breakfast with hotcakes",
        "I want the oatmeal",
        "can I get the fruit and maple oatmeal",
    ])

    return make_examples(templates, 'take_order_breakfast', count=2500)


def main():
    dataset_path = Path(__file__).parent / 'mcdonalds-behavioral-training.jsonl'

    # Load existing data
    existing = []
    with open(dataset_path) as f:
        for line in f:
            existing.append(json.loads(line))

    existing_count = len(existing)
    print(f"Existing examples: {existing_count}")

    # Count existing per behavior
    from collections import Counter
    before = Counter(e['behavior'] for e in existing)
    print("\nBefore augmentation:")
    for b, c in sorted(before.items(), key=lambda x: -x[1]):
        print(f"  {b:30s} {c:6d}")

    # Generate augmented data
    augmented = []
    generators = [
        ('menu_inquiry', gen_menu_inquiry),
        ('price_inquiry', gen_price_inquiry),
        ('value_recommendation', gen_value_recommendation),
        ('time_check', gen_time_check),
        ('order_modify', gen_order_modify),
        ('take_order_breakfast', gen_take_order_breakfast),
    ]

    for name, gen_fn in generators:
        new_examples = gen_fn()
        # Deduplicate against existing
        existing_inputs = {e['input'].lower() for e in existing if e['behavior'] == name}
        new_examples = [e for e in new_examples if e['input'].lower() not in existing_inputs]
        augmented.extend(new_examples)
        print(f"\n  Generated {len(new_examples)} new {name} examples")

    # Combine
    all_data = existing + augmented

    # Shuffle augmented data into the full dataset
    random.shuffle(all_data)

    # Write back
    with open(dataset_path, 'w') as f:
        for ex in all_data:
            f.write(json.dumps(ex) + '\n')

    # Final counts
    after = Counter(e['behavior'] for e in all_data)
    print(f"\n\nAfter augmentation: {len(all_data)} total")
    print("\nFinal distribution:")
    for b, c in sorted(after.items(), key=lambda x: -x[1]):
        delta = c - before.get(b, 0)
        delta_str = f" (+{delta})" if delta > 0 else ""
        print(f"  {b:30s} {c:6d}{delta_str}")


if __name__ == '__main__':
    main()
