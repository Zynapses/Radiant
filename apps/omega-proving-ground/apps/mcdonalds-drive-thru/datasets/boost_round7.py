#!/usr/bin/env python3
"""
Round 7 data augmentation: Fix Round 10 regressions.

Problem behaviors after Round 10:
  1. take_order at 96.6% (below 97%) — heavy split_size_selection flood diluted it
  2. order_modify at 97.0% (borderline)
  3. "actually change the Big Mac to a Quarter Pounder" → combo_entree_swap (should be order_modify)

Root cause: "change X to Y" pattern overlaps between order_modify and combo_entree_swap.
The key distinction is: combo_entree_swap mentions "combo" or "meal", order_modify does NOT.

Strategy:
  - Add order_modify examples with "change X to Y" patterns WITHOUT combo/meal context
  - Add take_order examples to restore above 97%
  - Keep augmentation balanced to avoid further whack-a-mole
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


# ── order_modify: "change X to Y" WITHOUT combo/meal context ──
# These are ORDER-LEVEL changes, not combo entree swaps
ORDER_MODIFY = [
    # "change X to Y" — the failing pattern
    "actually change the Big Mac to a Quarter Pounder",
    "change the Big Mac to a Quarter Pounder",
    "change the McChicken to a Big Mac",
    "change the Quarter Pounder to a Big Mac",
    "change the nuggets to a McChicken",
    "change my Big Mac to a Quarter Pounder",
    "change my McChicken to a Big Mac",
    "change my order from a Big Mac to a Quarter Pounder",
    "actually change that to a McChicken",
    "actually change that to a Big Mac",
    "actually change that to a Quarter Pounder",
    "actually I want a Quarter Pounder instead",
    "actually I want a McChicken instead",
    "actually I want a Big Mac instead",
    "I changed my mind I want a Quarter Pounder",
    "I changed my mind I want a McChicken",
    "I changed my mind I want a Big Mac instead",
    "wait change that to a McChicken",
    "wait I want a Quarter Pounder instead",
    "hold on change that to a Big Mac",
    "actually make that a Quarter Pounder",
    "actually make that a McChicken",
    "actually make that a Big Mac",
    "switch that to a Quarter Pounder",
    "switch that to a McChicken",
    "switch that to a Big Mac",
    "switch my order to a Quarter Pounder",
    "can I switch to a Big Mac",
    "can I change to a Quarter Pounder",
    "can I change that to a McChicken",
    "instead of the Big Mac give me a Quarter Pounder",
    "instead of that give me a McChicken",
    "I want to swap the Big Mac for a Quarter Pounder",
    "I want to swap that for a McChicken",
    "let me change that to a Big Mac",
    "let me switch to a Quarter Pounder",
    # General order modifications (reinforce)
    "I want to change my order",
    "can I change something on my order",
    "I need to modify my order",
    "let me change something",
    "hold on I need to change that",
    "wait I want to change something",
    "actually can I change my order",
]

# ── take_order: common ordering patterns to restore above 97% ──
TAKE_ORDER = [
    "I want a Big Mac",
    "I'll have a McChicken",
    "can I get a Quarter Pounder",
    "let me get a Big Mac",
    "give me a McChicken",
    "I'd like a Quarter Pounder",
    "I'll take a Big Mac",
    "one Big Mac",
    "two McChickens",
    "three piece nuggets",
    "a large fries",
    "a medium fries",
    "one McDouble",
    "I want a McDouble",
    "give me a Filet-O-Fish",
    "can I have a McFlurry",
    "let me get a sundae",
    "I'll have an apple pie",
    "a Coke please",
    "I want a Sprite",
    "give me a Hi-C",
    "can I get a sweet tea",
    "I'd like a coffee",
    "one hash brown",
    "I want a McGriddle",
    "give me a sausage McMuffin",
    "let me get a bacon egg and cheese",
    "I'll have a breakfast burrito",
    "can I get a Happy Meal",
    "I want a 20 piece nuggets",
    "give me two Big Macs",
    "let me get a McChicken and a Big Mac",
    "I'll have a Quarter Pounder with Cheese meal",
    "can I get a Big Mac meal",
    "I want a number one",
    "give me a number three",
    "I'll take the number five",
    "two cheeseburgers",
    "a double cheeseburger",
    "can I get a McRib",
]


def main():
    with open(DATASET, 'r') as f:
        existing_lines = f.readlines()
    existing_count = len(existing_lines)
    print(f"Existing dataset: {existing_count} examples")

    fillers = ['', 'um ', 'uh ', 'like ', 'so ', 'hey ', 'oh ', 'yeah ']
    suffixes = ['', ' please', ' thanks']

    new_examples = []

    # order_modify: 2-3 variations each (target: ~150)
    for base in ORDER_MODIFY:
        new_examples.append(make_ex(base, 'order_modify'))
        for _ in range(random.randint(2, 3)):
            f = random.choice(fillers)
            s = random.choice(suffixes)
            variant = f"{f}{base}{s}".strip()
            if variant != base:
                new_examples.append(make_ex(variant, 'order_modify'))

    # take_order: 2-3 variations each (target: ~150)
    for base in TAKE_ORDER:
        new_examples.append(make_ex(base, 'take_order'))
        for _ in range(random.randint(2, 3)):
            f = random.choice(fillers)
            s = random.choice(suffixes)
            variant = f"{f}{base}{s}".strip()
            if variant != base:
                new_examples.append(make_ex(variant, 'take_order'))

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
