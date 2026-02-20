#!/usr/bin/env python3
"""
Round 4 data augmentation: Fix 3 persistent classification test failures.

Problem behaviors (test-time misclassifications):
  1. "no pickles on that" → order_modify (should be customize)
  2. "can I get extra cheese" → take_order (should be customize)
  3. "swap the Big Mac for a McChicken in my combo" → take_order (should be combo_entree_swap)

Root cause: customize examples in the dataset are very elaborate ("dude make sure there
are absolutely zero pickles i'm allergic thanks") while real speech is short ("no pickles
on that"). Similarly, combo_entree_swap uses patterns like "change the burger in my meal"
but not "swap [item] for [item] in my combo".

Strategy: Add SHORT, natural customize phrases and explicit swap-in-combo patterns.
These are hard negatives that teach the boundary between:
  - customize (ingredient changes) vs order_modify (order-level changes)
  - combo_entree_swap (swap entree in combo) vs take_order (new item)
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


# ── customize: SHORT ingredient-level modifications ──
# These are the exact patterns that get confused with order_modify and take_order
CUSTOMIZE = [
    # "no X on that" pattern (confused with order_modify "remove X")
    "no pickles on that",
    "no pickles please",
    "no pickles",
    "hold the pickles",
    "hold the onions",
    "hold the lettuce",
    "hold the tomato",
    "hold the mayo",
    "hold the mustard",
    "hold the ketchup",
    "no onions on that",
    "no onions please",
    "no onions",
    "no lettuce on that",
    "no lettuce please",
    "no lettuce",
    "no tomato on that",
    "no tomato please",
    "no tomato",
    "no mayo on that",
    "no mayo please",
    "no mayo",
    "no mustard on that",
    "no mustard please",
    "no mustard",
    "no ketchup on that",
    "no ketchup please",
    "no ketchup",
    "no cheese on that",
    "no cheese please",
    "no cheese",
    "no sauce on that",
    "no sauce please",
    "no sauce",
    "skip the pickles",
    "skip the onions",
    "leave off the pickles",
    "leave off the onions",
    "without pickles",
    "without onions",
    "without lettuce",
    "without mayo",
    "without mustard",
    "without ketchup",
    "without cheese",
    # "extra X" pattern (confused with take_order)
    "can I get extra cheese",
    "extra cheese please",
    "extra cheese on that",
    "extra cheese",
    "add extra cheese",
    "extra pickles please",
    "extra pickles on that",
    "extra pickles",
    "extra onions please",
    "extra onions",
    "extra lettuce please",
    "extra lettuce",
    "extra mayo please",
    "extra mayo",
    "extra ketchup please",
    "extra ketchup",
    "extra mustard please",
    "extra mustard",
    "extra sauce please",
    "extra sauce",
    "extra tomato please",
    "extra tomato",
    "can I get extra pickles",
    "can I get extra onions",
    "can I get extra lettuce",
    "can I get extra mayo",
    "can I get extra ketchup",
    "can I get extra mustard",
    "can I get extra sauce",
    "can I get extra tomato",
    "add extra pickles",
    "add extra onions",
    "add extra lettuce",
    "add extra mayo",
    "add extra ketchup",
    "put extra cheese on it",
    "put extra pickles on it",
    "I want extra cheese on that",
    "I want extra pickles on that",
    "make it extra cheesy",
    "double the cheese",
    "double the pickles",
    "light on the mayo",
    "light mayo",
    "light ketchup",
    "easy on the onions",
    "easy on the mustard",
    "go light on the sauce",
    "just a little ketchup",
    "only a little mayo",
    # Specific customization patterns
    "no salt on the fries",
    "no salt on my fries",
    "extra crispy fries",
    "well done fries",
    "light ice in my drink",
    "no ice in my drink",
    "no ice please",
    "extra ice please",
    "can you toast the bun extra",
    "I want it plain",
    "make it plain",
    "plain please",
    "just ketchup",
    "ketchup only",
    "only ketchup on that",
    "just mustard and ketchup",
    "add bacon to that",
    "add bacon please",
    "can I add bacon",
    "put bacon on it",
    "add lettuce and tomato",
    "no special sauce",
    "sub mac sauce",
]

# ── combo_entree_swap: explicit "swap X for Y in my combo/meal" patterns ──
# These are the patterns that get confused with take_order
COMBO_ENTREE_SWAP = [
    # Direct swap pattern with specific items
    "swap the Big Mac for a McChicken in my combo",
    "swap the Big Mac for a McChicken in my meal",
    "swap the Big Mac for a Quarter Pounder in my combo",
    "swap the McChicken for a Big Mac in my combo",
    "swap the Quarter Pounder for a Big Mac in my meal",
    "swap the nuggets for a Big Mac in my combo",
    "swap my combo entree for a McChicken",
    "swap my combo entree for a Big Mac",
    "swap my meal entree for a Quarter Pounder",
    "swap the entree in my combo to a McChicken",
    "swap the entree in my meal to a Big Mac",
    # "switch X for Y in combo" pattern
    "switch the Big Mac for a McChicken in my combo",
    "switch the burger in my combo to a McChicken",
    "switch the burger in my meal to a Big Mac",
    "switch the sandwich in my combo for a Quarter Pounder",
    "switch my combo sandwich to a Filet-O-Fish",
    "switch my meal sandwich to a McDouble",
    # "change X to Y in combo" with specific items
    "change the Big Mac in my combo to a McChicken",
    "change the McChicken in my combo to a Big Mac",
    "change the Quarter Pounder in my meal to a McChicken",
    "change my combo burger to a McChicken",
    "change my combo burger to a Quarter Pounder",
    "change my meal burger to a Filet-O-Fish",
    # "replace X with Y" in combo context
    "replace the Big Mac with a McChicken in my combo",
    "replace the McChicken with a Big Mac in my meal",
    "replace the entree with a Quarter Pounder in my combo",
    "replace the sandwich in my combo with a McChicken",
    # "make my combo/meal a X instead"
    "make my combo a McChicken instead",
    "make my combo a Big Mac instead",
    "make my combo a Quarter Pounder instead",
    "make my meal a McChicken instead",
    "make my meal a Big Mac instead",
    "make my meal a Filet-O-Fish instead",
    "make my combo sandwich a McChicken instead",
    "make my meal sandwich a Big Mac instead",
    # "I want X instead of Y in my combo"
    "I want a McChicken instead of the Big Mac in my combo",
    "I want a Big Mac instead of the McChicken in my combo",
    "I want a Quarter Pounder instead of the Big Mac in my meal",
    "I want a Filet-O-Fish instead of the McChicken in my meal",
    "can I get a McChicken instead of the Big Mac in my combo",
    "can I get a Big Mac instead of the McChicken in my meal",
    # Shorter natural patterns
    "actually make the combo a McChicken",
    "actually make the meal a Big Mac",
    "actually can I change the combo to a McChicken",
    "wait can I change the combo to a Big Mac",
    "actually swap the combo entree to McChicken",
    "can I swap what's in my combo",
    "I changed my mind on the combo entree",
    "different entree for the combo please",
]


def main():
    # Read existing data
    with open(DATASET, 'r') as f:
        existing_lines = f.readlines()
    existing_count = len(existing_lines)
    print(f"Existing dataset: {existing_count} examples")

    # Generate augmented examples with filler variations
    fillers = ['', 'um ', 'uh ', 'like ', 'so ', 'hey ', 'oh ', 'yeah ']
    suffixes = ['', ' please', ' thanks', ' if you can', ' for me']

    new_examples = []

    # Customize examples (target: ~500 new)
    for base in CUSTOMIZE:
        new_examples.append(make_ex(base, 'customize'))
        # Add 2-3 variations
        for _ in range(random.randint(2, 3)):
            f = random.choice(fillers)
            s = random.choice(suffixes)
            variant = f"{f}{base}{s}".strip()
            if variant != base:
                new_examples.append(make_ex(variant, 'customize'))

    # Combo entree swap examples (target: ~300 new)
    for base in COMBO_ENTREE_SWAP:
        new_examples.append(make_ex(base, 'combo_entree_swap'))
        # Add 1-2 variations
        for _ in range(random.randint(1, 2)):
            f = random.choice(fillers)
            s = random.choice(suffixes)
            variant = f"{f}{base}{s}".strip()
            if variant != base:
                new_examples.append(make_ex(variant, 'combo_entree_swap'))

    # Shuffle
    random.shuffle(new_examples)
    print(f"Generated {len(new_examples)} new examples:")
    cust = sum(1 for e in new_examples if e['behavior'] == 'customize')
    swap = sum(1 for e in new_examples if e['behavior'] == 'combo_entree_swap')
    print(f"  customize: {cust}")
    print(f"  combo_entree_swap: {swap}")

    # Append to dataset
    with open(DATASET, 'a') as f:
        for ex in new_examples:
            f.write(json.dumps(ex) + '\n')

    total = existing_count + len(new_examples)
    print(f"Dataset updated: {existing_count} → {total} examples")


if __name__ == '__main__':
    main()
