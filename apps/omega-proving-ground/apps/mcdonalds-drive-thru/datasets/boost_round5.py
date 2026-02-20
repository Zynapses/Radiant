#!/usr/bin/env python3
"""
Round 5 data augmentation: Fix Round 8 regressions.

Problem behaviors after Round 8:
  1. order_modify at 96.6% (below 97% target) — heavy customize augmentation
     in Round 4 pulled some order_modify examples across the boundary
  2. "my order is wrong" → order_modify (should be complaint)
  3. "make it a large" → customize (should be split_size_selection)

Strategy:
  - Add ORDER_MODIFY examples to restore its accuracy above 97%
  - Add COMPLAINT hard-negatives for "order is wrong/messed up" patterns
    (these express dissatisfaction, not a request to change something)
  - Add SPLIT_SIZE_SELECTION hard-negatives for short size-change phrases
    (these select a meal size, not customize an ingredient)
"""
import json
import random
from pathlib import Path

DATASET = Path(__file__).parent / 'mcdonalds-behavioral-training.jsonl'


def make_ex(text, behavior):
    return {
        "input": text,
        "behavior": behavior,
        "target_action": behavior,
        "target_data": {},
        "expected_response_contains": [],
        "context": None,
    }


# ── order_modify: order-level changes (not ingredient customization) ──
# These must be clearly DIFFERENT from customize (ingredient-level)
ORDER_MODIFY = [
    # Remove item from order
    "take off the McChicken",
    "remove the fries",
    "remove the fries from my order",
    "scratch the nuggets",
    "cancel the Big Mac",
    "drop the McFlurry",
    "I don't want the McChicken anymore",
    "never mind on the fries",
    "never mind the nuggets",
    "take the Big Mac off",
    "take the drink off my order",
    "remove that last item",
    "cancel that last thing",
    "scratch that last one",
    "I changed my mind about the nuggets",
    "actually remove the fries",
    "actually take the McChicken off",
    "lose the sundae",
    "nix the apple pie",
    "don't want the McFlurry anymore",
    "I don't need the fries anymore",
    "can you take the Big Mac off",
    "can you remove the nuggets",
    "please remove the McChicken",
    "get rid of the fries",
    # Change quantity
    "make that two Big Macs",
    "I want three of those",
    "double that",
    "make it two",
    "make it three",
    "actually make that two",
    "actually I want two of those",
    "change that to three",
    "I want two McChickens not one",
    "make the nuggets a 20 piece instead of 10",
    "change it to a 10 piece",
    "I need two of those",
    "give me two of those",
    "two of those please",
    "three of those actually",
    # Add item to existing order
    "also add a McChicken",
    "tack on a sundae",
    "throw in a pie",
    "also throw in some nuggets",
    "add a McFlurry to my order",
    "tack on an apple pie",
    "put a Sprite on there too",
    "add a coffee too",
    "oh and add a hash brown",
    "also I need a drink",
    # Upsize/downsize
    "upsize my meal",
    "upsize that to a large",
    "upgrade to large",
    "upgrade my meal",
    "downsize the meal",
    "downsize to a small",
    "make the meal a large",
    "can I upsize the meal",
    "I want to upsize",
    "supersize that",
    # General order modifications
    "I want to change my order",
    "can I change something",
    "I need to modify my order",
    "let me change something on my order",
    "hold on let me change something",
    "wait I want to change that",
    "actually can I change that",
    "I want to change the last thing",
]

# ── complaint: expressions of dissatisfaction (NOT modification requests) ──
# Key distinction: complaints DESCRIBE a problem, they don't REQUEST a change
COMPLAINT = [
    # "order is wrong" — the key test failure
    "my order is wrong",
    "my order is messed up",
    "my order is all wrong",
    "this order is wrong",
    "you got my order wrong",
    "that's not what I ordered",
    "this isn't what I ordered",
    "this isn't right",
    "that's not right",
    "you messed up my order",
    "the order is messed up",
    "my order is incorrect",
    "this is the wrong order",
    "I got the wrong order",
    "I got the wrong food",
    "this isn't my food",
    "you gave me the wrong thing",
    "this is wrong",
    # Food quality complaints
    "my fries are cold",
    "the fries are cold",
    "my burger is cold",
    "the food is cold",
    "this is cold",
    "my drink is flat",
    "my fries are soggy",
    "the burger is dry",
    "this doesn't taste right",
    "this tastes weird",
    "this tastes off",
    "there's something wrong with my food",
    # Missing items
    "I'm missing my fries",
    "you forgot my drink",
    "my nuggets are missing",
    "I didn't get my fries",
    "where are my fries",
    "you forgot the sauce",
    "the sauce is missing",
    "I didn't get my drink",
    "my order is missing items",
    "I'm missing half my order",
    # Service complaints
    "I've been waiting forever",
    "this is taking too long",
    "I've been sitting here for 20 minutes",
    "the wait is ridiculous",
    "why is this taking so long",
    "I've been waiting a really long time",
    # General dissatisfaction
    "this is unacceptable",
    "I'm not happy with this",
    "I'm disappointed",
    "this is terrible",
    "this is awful",
    "I want to speak to a manager",
    "can I talk to a manager",
    "I want a refund",
    "I need a refund",
    "I want my money back",
]

# ── split_size_selection: choosing sizes for meal components ──
# Key distinction: these select MEAL SIZES, not customize ingredients
SPLIT_SIZE_SELECTION = [
    # Short direct size phrases (the key test failure: "make it a large")
    "make it a large",
    "make it a medium",
    "make it a small",
    "large please",
    "medium please",
    "small please",
    "I'll take a large",
    "I'll do a large",
    "I'll go with large",
    "I'll have a large",
    "large fries large drink",
    "medium fries medium drink",
    "small fries small drink",
    "large fries and a large drink",
    "medium fries and a medium drink",
    "large for both",
    "medium for both",
    "make both large",
    "make both medium",
    "both large please",
    "both medium please",
    # Drink size selection
    "large drink",
    "medium drink",
    "small drink",
    "large Coke",
    "medium Coke",
    "small Coke",
    "large Sprite",
    "medium Sprite",
    "I'll take a large drink",
    "make the drink a large",
    "make my drink a large",
    "make the drink large",
    "large on the drink",
    "medium on the drink",
    # Fries size selection
    "large fries",
    "medium fries",
    "small fries",
    "I'll take large fries",
    "make the fries large",
    "make my fries a large",
    "make the fries a large",
    "large on the fries",
    "medium on the fries",
    # Mixed sizes
    "large fries small drink",
    "small fries large drink",
    "medium fries large drink",
    "large fries medium drink",
    "large fries and a small drink",
    "small fries and a large drink",
    "medium fries and a large Coke",
    # Size change for meal
    "make the meal a large",
    "make my meal large",
    "I want the large meal",
    "the large one",
    "the medium one",
    "what sizes do you have",
    "can I get that in a large",
    "give me the large",
    "I'll take the large size",
    "large size please",
    "medium size please",
]


def main():
    with open(DATASET, 'r') as f:
        existing_lines = f.readlines()
    existing_count = len(existing_lines)
    print(f"Existing dataset: {existing_count} examples")

    fillers = ['', 'um ', 'uh ', 'like ', 'so ', 'hey ', 'oh ', 'yeah ']
    suffixes = ['', ' please', ' thanks', ' if you can', ' for me']

    new_examples = []

    # order_modify examples (target: ~250 new)
    for base in ORDER_MODIFY:
        new_examples.append(make_ex(base, 'order_modify'))
        for _ in range(random.randint(2, 3)):
            f = random.choice(fillers)
            s = random.choice(suffixes)
            variant = f"{f}{base}{s}".strip()
            if variant != base:
                new_examples.append(make_ex(variant, 'order_modify'))

    # complaint examples (target: ~200 new)
    for base in COMPLAINT:
        new_examples.append(make_ex(base, 'complaint'))
        for _ in range(random.randint(1, 2)):
            f = random.choice(fillers)
            s = random.choice(suffixes)
            variant = f"{f}{base}{s}".strip()
            if variant != base:
                new_examples.append(make_ex(variant, 'complaint'))

    # split_size_selection examples (target: ~200 new)
    for base in SPLIT_SIZE_SELECTION:
        new_examples.append(make_ex(base, 'split_size_selection'))
        for _ in range(random.randint(1, 2)):
            f = random.choice(fillers)
            s = random.choice(suffixes)
            variant = f"{f}{base}{s}".strip()
            if variant != base:
                new_examples.append(make_ex(variant, 'split_size_selection'))

    random.shuffle(new_examples)
    print(f"Generated {len(new_examples)} new examples:")
    by_behavior = {}
    for e in new_examples:
        b = e['behavior']
        by_behavior[b] = by_behavior.get(b, 0) + 1
    for b, c in sorted(by_behavior.items()):
        print(f"  {b}: {c}")

    with open(DATASET, 'a') as f:
        for ex in new_examples:
            f.write(json.dumps(ex) + '\n')

    total = existing_count + len(new_examples)
    print(f"Dataset updated: {existing_count} → {total} examples")


if __name__ == '__main__':
    main()
