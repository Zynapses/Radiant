#!/usr/bin/env python3
"""
Merge Gemini-generated training data with existing dataset.
Validates JSON, deduplicates by input text, and reports stats.

Usage:
  python3 merge-gemini-output.py gemini-raw-output.jsonl
"""
import json, sys
from collections import Counter
from pathlib import Path

EXISTING = Path(__file__).parent / "mcdonalds-behavioral-training.jsonl"
OUTPUT = Path(__file__).parent / "mcdonalds-behavioral-training.jsonl"

VALID_BEHAVIORS = {
    "greet","take_order","take_order_breakfast","meal_upgrade","drink_selection",
    "sauce_selection","size_selection","customize","order_modify","meal_substitution",
    "happy_meal_options","add_on_suggestion","order_complete","order_confirmed",
    "payment","menu_inquiry","price_inquiry","nutrition_inquiry","allergen_inquiry",
    "allergen_alert","dietary_inquiry","recommend","value_recommendation",
    "complaint","machine_down","time_check"
}

def load_jsonl(path):
    examples = []
    errors = 0
    with open(path) as f:
        for i, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
                if "input" not in obj or "behavior" not in obj:
                    print(f"  SKIP line {i}: missing input/behavior")
                    errors += 1
                    continue
                if obj["behavior"] not in VALID_BEHAVIORS:
                    print(f"  SKIP line {i}: unknown behavior '{obj['behavior']}'")
                    errors += 1
                    continue
                # Normalize
                if "target_action" not in obj:
                    obj["target_action"] = obj["behavior"]
                if "target_data" not in obj:
                    obj["target_data"] = {}
                if "expected_response_contains" not in obj:
                    obj["expected_response_contains"] = []
                if "context" not in obj:
                    obj["context"] = None
                examples.append(obj)
            except json.JSONDecodeError as e:
                print(f"  SKIP line {i}: invalid JSON ({e})")
                errors += 1
    return examples, errors

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 merge-gemini-output.py <gemini-output.jsonl>")
        sys.exit(1)

    gemini_path = Path(sys.argv[1])
    if not gemini_path.exists():
        print(f"File not found: {gemini_path}")
        sys.exit(1)

    # Load existing
    print(f"Loading existing: {EXISTING}")
    existing, e1 = load_jsonl(EXISTING)
    print(f"  {len(existing)} examples, {e1} errors")

    # Load Gemini output
    print(f"\nLoading Gemini output: {gemini_path}")
    gemini, e2 = load_jsonl(gemini_path)
    print(f"  {len(gemini)} examples, {e2} errors")

    # Deduplicate by input text
    seen = {ex["input"].lower().strip() for ex in existing}
    new_examples = []
    dupes = 0
    for ex in gemini:
        key = ex["input"].lower().strip()
        if key in seen:
            dupes += 1
            continue
        seen.add(key)
        new_examples.append(ex)

    merged = existing + new_examples

    print(f"\nMerge results:")
    print(f"  Existing:    {len(existing)}")
    print(f"  Gemini new:  {len(new_examples)} (after {dupes} duplicates removed)")
    print(f"  Total:       {len(merged)}")

    # Stats
    behaviors = Counter(e["behavior"] for e in merged)
    print(f"\nBehavior distribution ({len(behaviors)} behaviors):")
    for b, c in behaviors.most_common():
        pct = c / len(merged) * 100
        print(f"  {b}: {c} ({pct:.1f}%)")

    context_count = sum(1 for e in merged if e.get("context"))
    print(f"\nContext-dependent examples: {context_count}")

    # Write output
    with open(OUTPUT, 'w') as f:
        for e in merged:
            f.write(json.dumps(e) + '\n')

    print(f"\nWritten to: {OUTPUT}")

if __name__ == "__main__":
    main()
