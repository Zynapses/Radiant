# OMEGA Training Data Augmentation Request

## Problem

We have a McDonald's drive-thru behavioral classification model (OMEGA) that classifies customer utterances into behavior categories. Our training dataset has severe class imbalance — 5 minority classes have far fewer examples than the majority classes, which hurts novel query generalization.

## Current Class Distribution

| Class | Count | Status |
|-------|-------|--------|
| `split_size_selection` | 7,500 | ✅ Fine |
| `complaint` | 6,005 | ✅ Fine |
| `take_order` | 4,493 | ✅ Fine |
| `customize` | 4,036 | ✅ Fine |
| `combo_entree_swap` | 3,000 | ✅ Fine |
| `meal_substitution` | 3,000 | ✅ Fine |
| `greet` | 2,026 | ✅ Fine |
| `menu_inquiry` | 779 | ⚠️ Low |
| `value_recommendation` | 428 | ❌ Needs augmentation |
| `time_check` | 319 | ❌ Needs augmentation |
| `take_order_breakfast` | 286 | ❌ Needs augmentation |
| `price_inquiry` | 232 | ❌ Needs augmentation |
| `order_modify` | 128 | ❌ Needs augmentation |

## What I Need

Generate augmented training examples for the **5 minority classes** to bring each up to approximately **1,000–1,500 examples**. That means:

| Class | Current | Generate | Target |
|-------|---------|----------|--------|
| `order_modify` | 128 | ~900 | ~1,000 |
| `price_inquiry` | 232 | ~800 | ~1,000 |
| `take_order_breakfast` | 286 | ~750 | ~1,000 |
| `time_check` | 319 | ~700 | ~1,000 |
| `value_recommendation` | 428 | ~600 | ~1,000 |

## Output Format

Each line must be a valid JSON object (JSONL format). **Match this exact schema:**

```json
{"input": "<customer utterance>", "behavior": "<class>", "target_action": "<action>", "target_data": {<structured data>}, "expected_response_contains": [<strings>], "context": "<context_tag>"}
```

## Style Requirements

- **Conversational, naturalistic drive-thru speech** — filler words ("uh", "um", "like", "so"), slang ("bro", "dude", "man"), casual grammar
- **Varied sentence structures** — don't just swap one word in a template. Change phrasing, word order, length, formality
- **No robotic/formal phrasing** — these should sound like real people at a drive-thru speaker
- **Diverse vocabulary** — don't repeat the same prefix patterns ("can I get", "let me get") over and over

## Reference Examples Per Class

### `order_modify` (128 → ~1,000)
Action: `mcvalue_restriction` — customer tries to stack multiple offers/deals

```json
{"input": "uh let me get the mcchicken deal and the daily double deal thanks", "behavior": "order_modify", "target_action": "mcvalue_restriction", "target_data": {"violation": "multiple_offers", "attempted": ["McChicken Meal Deal", "Daily Double Meal Deal"]}, "expected_response_contains": ["one", "offer", "per order"], "context": "mcvalue_restriction"}
{"input": "actually can i do two bogo deals on different items bro", "behavior": "order_modify", "target_action": "mcvalue_restriction", "target_data": {"violation": "multiple_offers", "attempted": ["buy_one_add_one", "buy_one_add_one"]}, "expected_response_contains": ["one", "offer", "per order"], "context": "mcvalue_restriction"}
{"input": "uh let me redeem my points and use the bogo deal bro", "behavior": "order_modify", "target_action": "mcvalue_restriction", "target_data": {"violation": "rewards_plus_mcvalue", "attempted": ["rewards_redemption", "buy_one_add_one"]}, "expected_response_contains": ["one", "offer", "per order"], "context": "mcvalue_restriction"}
{"input": "actually give me the five dollar deal and also the bogo instead", "behavior": "order_modify", "target_action": "mcvalue_restriction", "target_data": {"violation": "multiple_offers", "attempted": ["meal_deal", "buy_one_add_one"]}, "expected_response_contains": ["one", "offer", "per order"], "context": "mcvalue_restriction"}
{"input": "can i get two meal deals today", "behavior": "order_modify", "target_action": "mcvalue_restriction", "target_data": {"violation": "multiple_offers", "attempted": ["meal_deal", "meal_deal"]}, "expected_response_contains": ["one", "offer", "per order"], "context": "mcvalue_restriction"}
```

### `price_inquiry` (232 → ~1,000)
Action: `price_lookup` — customer asks about prices, deals, cheap options

```json
{"input": "so tell me about the five dollar meals bro", "behavior": "price_inquiry", "target_action": "price_lookup", "target_data": {"category": "mcvalue", "section": "meal_deals"}, "expected_response_contains": ["McValue"], "context": "mcvalue_inquiry"}
{"input": "uh what can i get for cheap right now", "behavior": "price_inquiry", "target_action": "price_lookup", "target_data": {"category": "mcvalue", "section": "all"}, "expected_response_contains": ["McValue"], "context": "mcvalue_inquiry"}
{"input": "um tell me about the five dollar meals for me", "behavior": "price_inquiry", "target_action": "price_lookup", "target_data": {"category": "mcvalue", "section": "meal_deals"}, "expected_response_contains": ["McValue"], "context": "mcvalue_inquiry"}
{"input": "listen what is the cheapest thing you have please", "behavior": "price_inquiry", "target_action": "price_lookup", "target_data": {"category": "mcvalue", "section": "all"}, "expected_response_contains": ["McValue"], "context": "mcvalue_inquiry"}
```

### `take_order_breakfast` (286 → ~1,000)
Action: `add_to_order` — customer orders breakfast items

```json
{"input": "hey can i get the sausage egg cheese mcgriddle meal please", "behavior": "take_order_breakfast", "target_action": "add_to_order", "target_data": {"item": "Sausage Egg Cheese McGriddles Meal", "meal": true, "daypart": "breakfast", "category": "extra_value"}, "expected_response_contains": ["Sausage"], "context": "extra_value_breakfast"}
{"input": "listen let me get two sausage burrito with that add one deal today", "behavior": "take_order_breakfast", "target_action": "add_to_order", "target_data": {"item": "Sausage Burrito", "mcvalue_offer": "buy_one_add_one", "add_on_price": 1, "daypart": "breakfast"}, "expected_response_contains": ["Sausage Burrito", "$1"], "context": "mcvalue_bogo_breakfast"}
{"input": "so one bacon egg cheese biscuit meal instead", "behavior": "take_order_breakfast", "target_action": "add_to_order", "target_data": {"item": "Bacon Egg Cheese Biscuit Meal", "meal": true, "daypart": "breakfast", "category": "extra_value"}, "expected_response_contains": ["Bacon"], "context": "extra_value_breakfast"}
{"input": "like one egg mcmuffin meal right now", "behavior": "take_order_breakfast", "target_action": "add_to_order", "target_data": {"item": "Egg McMuffin Meal", "meal": true, "daypart": "breakfast", "category": "extra_value"}, "expected_response_contains": ["Egg"], "context": "extra_value_breakfast"}
```

### `time_check` (319 → ~1,000)
Action: `check_availability` — customer asks about breakfast/lunch timing, availability windows

```json
{"input": "hey is it too late for the breakfast mcvalue right now", "behavior": "time_check", "target_action": "check_availability", "target_data": {"category": "mcvalue", "daypart": "breakfast"}, "expected_response_contains": [], "context": "mcvalue_time_check"}
{"input": "listen can i still get the sausage biscuit bogo bro", "behavior": "time_check", "target_action": "check_availability", "target_data": {"category": "mcvalue", "daypart": "breakfast"}, "expected_response_contains": [], "context": "mcvalue_time_check"}
{"input": "dude can i get the daily double deal for breakfast thanks", "behavior": "time_check", "target_action": "check_availability", "target_data": {"category": "mcvalue", "daypart": "breakfast"}, "expected_response_contains": [], "context": "mcvalue_time_check"}
{"input": "listen when does the mcvalue breakfast end bro", "behavior": "time_check", "target_action": "check_availability", "target_data": {"category": "mcvalue", "daypart": "breakfast"}, "expected_response_contains": [], "context": "mcvalue_time_check"}
```

### `value_recommendation` (428 → ~1,000)
Action: `recommend_value` — customer asks for recommendations, best deals, best bang for buck

```json
{"input": "like what do you recommend for a good deal right now", "behavior": "value_recommendation", "target_action": "recommend_value", "target_data": {"category": "mcvalue", "suggest": ["Meal Deal", "Buy One Add One", "Eats"]}, "expected_response_contains": ["McValue", "deal"], "context": "mcvalue_recommendation"}
{"input": "uh what is the best value here today", "behavior": "value_recommendation", "target_action": "recommend_value", "target_data": {"category": "mcvalue", "suggest": ["Meal Deal", "Buy One Add One", "Eats"]}, "expected_response_contains": ["McValue", "deal"], "context": "mcvalue_recommendation"}
{"input": "dude what is the best bang for my buck thanks", "behavior": "value_recommendation", "target_action": "recommend_value", "target_data": {"category": "mcvalue", "suggest": ["Meal Deal", "Buy One Add One", "Eats"]}, "expected_response_contains": ["McValue", "deal"], "context": "mcvalue_recommendation"}
{"input": "man i am on a budget what should i get today", "behavior": "value_recommendation", "target_action": "recommend_value", "target_data": {"category": "mcvalue", "suggest": ["Meal Deal", "Buy One Add One", "Eats"]}, "expected_response_contains": ["McValue", "deal"], "context": "mcvalue_recommendation"}
```

## Rules

1. **ONLY generate for the 5 minority classes listed above** — do NOT generate for greet, take_order, complaint, etc.
2. **Match the exact JSON schema** — every field must be present
3. **Match the `target_data` structure** from the reference examples for each class
4. **Output as raw JSONL** — one JSON object per line, no markdown, no code fences, no commentary
5. **Vary the `target_data` values** where appropriate (different menu items, different violation types, different dayparts)
6. **No duplicate inputs** — every `input` string must be unique

## Breakfast Menu Items for `take_order_breakfast`

Use these real items in `target_data`:
- Sausage Egg Cheese McGriddles Meal
- Egg McMuffin Meal
- Bacon Egg Cheese Biscuit Meal
- Sausage McMuffin with Egg Meal
- Hotcakes Meal
- Sausage Burrito (with BOGO: `"mcvalue_offer": "buy_one_add_one", "add_on_price": 1`)
- Hash Browns
- Big Breakfast

## Violation Types for `order_modify`

- `multiple_offers` — trying to stack two deals
- `rewards_plus_mcvalue` — trying to use rewards points AND a McValue deal
- Attempted items: `meal_deal`, `buy_one_add_one`, `McChicken Meal Deal`, `Daily Double Meal Deal`, `rewards_redemption`
