# Gemini Deep Thinking Prompt — OMEGA Drive-Thru Training Data Generation

> **Instructions**: Copy this entire prompt into Gemini 2.0 Flash Thinking or Gemini 1.5 Pro.
> Ask it to generate the JSONL output in multiple batches (500-800 lines per batch).
> Concatenate all batches into a single file: `mcdonalds-behavioral-training.jsonl`

---

## Task

You are generating behavioral training data for OMEGA, a quantum-inspired neural network that powers a McDonald's drive-thru AI. OMEGA classifies customer speech into one of 26 behavioral categories. It does NOT generate text responses — it only classifies WHAT behavior to execute.

Generate **3,500 training examples** in JSONL format (one JSON object per line).

## Output Format

```jsonl
{"input": "can I get a Big Mac", "behavior": "take_order", "target_action": "take_order", "target_data": {"item": "Big Mac", "price": 5.69, "meal_price": 8.99}, "expected_response_contains": [], "context": null}
```

### Fields:
- `input` (string, required): Customer utterance as speech recognition would capture it
- `behavior` (string, required): One of the 26 types below
- `target_action` (string, required): Same as behavior
- `target_data` (object, required): Structured data for the behavior
- `expected_response_contains` (array, required): Empty array `[]`
- `context` (string or null): Previous crew message IF this is a contextual response (yes/no/short answer)

## The 26 Behavior Types

1. **greet** — Customer greets. `target_data: {}`
2. **take_order** — Orders lunch/dinner item. `target_data: {"item": "<exact name>", "price": <num>, "meal_price": <num or null>}`
3. **take_order_breakfast** — Orders breakfast item. Same target_data as take_order.
4. **meal_upgrade** — Accepts combo/meal. `target_data: {"item": "<item>", "meal_price": <num>}`
5. **drink_selection** — Picks drink. `target_data: {"drink": "<drink name>", "size": "medium"}`
6. **sauce_selection** — Picks sauce. `target_data: {"sauce": "<sauce>"}`
7. **size_selection** — Picks size. `target_data: {"size": "small|medium|large"}`
8. **customize** — Modifies item. `target_data: {"modification": "add|remove|plain|only", "ingredient": "<ingredient>"}`
9. **order_modify** — Changes/removes ordered item. `target_data: {"action": "remove|change|change_qty|add|remove_last", "item": "<item>", "qty": <num>}`
10. **meal_substitution** — Swaps meal side/drink. `target_data: {"from": "<original>", "to": "<replacement>"}`
11. **happy_meal_options** — Orders Happy Meal. `target_data: {"item": "<happy meal>", "price": <num>}`
12. **add_on_suggestion** — Accepts add-on. `target_data: {"item": "<item>", "price": <num>}`
13. **order_complete** — Done ordering. `target_data: {}`
14. **order_confirmed** — Confirms readback. `target_data: {}`
15. **payment** — Payment method. `target_data: {"method": "card|cash|mobile|app|coupon"}`
16. **menu_inquiry** — Asks about menu. `target_data: {"category": "<cat>"}` or `{}`
17. **price_inquiry** — Asks price. `target_data: {"item": "<item>", "price": <num>}`
18. **nutrition_inquiry** — Asks nutrition. `target_data: {"item": "<item>"}`
19. **allergen_inquiry** — Asks about allergens. `target_data: {"item": "<item>", "allergen": "<allergen>"}`
20. **allergen_alert** — Declares allergy. `target_data: {"allergen": "<allergen>"}`
21. **dietary_inquiry** — Asks diet options. `target_data: {"diet": "<diet type>"}`
22. **recommend** — Asks for suggestion. `target_data: {}` or `{"category": "<cat>"}`
23. **value_recommendation** — Asks for deals. `target_data: {}`
24. **complaint** — Has problem. `target_data: {"type": "<complaint type>"}`
25. **machine_down** — Orders ice cream/shake. `target_data: {"item": "<item>"}`
26. **time_check** — Asks about wait/hours. `target_data: {"query": "wait_time|hours|breakfast_hours"}`

## Complete Menu with EXACT Prices

### Burgers
| Item | Price | Meal Price |
|------|-------|------------|
| Big Mac | 5.69 | 8.99 |
| Quarter Pounder with Cheese | 5.99 | 9.29 |
| Double Quarter Pounder with Cheese | 7.49 | 10.79 |
| McDouble | 2.79 | 5.99 |
| Double Cheeseburger | 3.39 | 6.59 |
| Hamburger | 1.89 | 5.09 |
| Cheeseburger | 2.29 | 5.49 |

### Chicken
| Item | Price | Meal Price |
|------|-------|------------|
| McCrispy | 5.49 | 8.79 |
| Filet-O-Fish | 4.79 | 7.99 |
| 10-piece Chicken McNuggets | 5.29 | 8.49 |
| 6-piece Chicken McNuggets | 3.69 | 6.89 |
| 4-piece Chicken McNuggets | 2.49 | null |
| 20-piece Chicken McNuggets | 8.99 | null |
| McChicken | 1.89 | null |

### Breakfast (breakfast_only)
| Item | Price | Meal Price |
|------|-------|------------|
| Egg McMuffin | 4.49 | 6.49 |
| Sausage McMuffin | 2.29 | 4.99 |
| Sausage McMuffin with Egg | 4.79 | 6.79 |
| Bacon, Egg & Cheese Biscuit | 4.89 | 6.89 |
| Sausage Burrito | 2.49 | null |
| Hotcakes | 3.99 | 5.99 |
| Hash Browns | 1.89 | null |

### Drinks (prices: small/medium/large)
- Coca-Cola, Diet Coke, Sprite, Dr Pepper, Fanta Orange, Hi-C Orange Lavaburst, Sweet Tea, Unsweetened Iced Tea: 1.39/1.79/2.09
- Lemonade: 1.79/2.29/2.69
- Hot Coffee (Premium Roast): 1.49/1.89/2.19
- Iced Coffee: 2.49/3.29/3.79
- Dasani Water: 1.39
- Milk (1% Low Fat): 1.59
- Chocolate Milk: 1.79

### McCafé (prices: small/medium/large)
- Caramel Frappé, Mocha Frappé: 3.99/4.79/5.39
- Caramel Macchiato, Mocha Latte: 3.69/4.39/4.99

### Desserts
| Item | Price |
|------|-------|
| McFlurry with OREO Cookies | 4.89 (regular), 3.69 (snack) |
| McFlurry with M&M'S Candies | 4.89 (regular), 3.69 (snack) |
| Hot Fudge Sundae | 2.89 |
| Caramel Sundae | 2.89 |
| Vanilla Cone | 1.89 |
| Chocolate Chip Cookie | 1.29 |
| Baked Apple Pie | 1.69 |

### Happy Meals
| Item | Price |
|------|-------|
| Hamburger Happy Meal | 4.99 |
| 4-piece McNuggets Happy Meal | 5.29 |
| 6-piece McNuggets Happy Meal | 5.79 |

### Sauces
BBQ, Sweet & Sour, Honey Mustard, Hot Mustard, Ranch, Tangy BBQ, Spicy Buffalo

### Combo Numbers (drive-thru shorthand)
1=Big Mac, 2=Quarter Pounder with Cheese, 3=Double Quarter Pounder with Cheese, 4=McCrispy, 5=Filet-O-Fish, 6=10-piece Chicken McNuggets, 7=McDouble, 8=Cheeseburger, 9=6-piece Chicken McNuggets, 10=McChicken

## Generation Rules

### Distribution (approximate)
- take_order: 800+ examples (25%)
- drink_selection: 250+ (8%)
- take_order_breakfast: 220+ (7%)
- meal_upgrade: 200+ (6%)
- customize: 170+ (5%)
- order_modify: 170+ (5%)
- order_complete: 160+ (5%)
- sauce_selection: 130+ (4%)
- greet: 100+ (3%)
- price_inquiry: 100+ (3%)
- menu_inquiry: 100+ (3%)
- payment: 80+ (3%)
- size_selection: 80+ (3%)
- happy_meal_options: 80+ (3%)
- order_confirmed: 70+ (2%)
- recommend: 60+ (2%)
- complaint: 60+ (2%)
- add_on_suggestion: 50+ (2%)
- value_recommendation: 50+ (2%)
- allergen_inquiry: 50+ (2%)
- allergen_alert: 40+ (1%)
- dietary_inquiry: 40+ (1%)
- nutrition_inquiry: 40+ (1%)
- meal_substitution: 40+ (1%)
- machine_down: 30+ (1%)
- time_check: 30+ (1%)

### Phrasing Variety per Item (for take_order)
Generate 10-15 variants per menu item:
1. "Can I get a [item]"
2. "I'll have a [item] please"
3. "Let me get a [item]"
4. "One [item]"
5. "[item] please"
6. "I want a [item]"
7. "Give me a [item]"
8. "I'd like a [item]"
9. "[colloquial name]" (e.g., "nuggets", "the fish sandwich", "quarter pounder")
10. "[speech error variant]" (e.g., "big mack", "mc double", "file a fish")
11. "Two [item]s" / "Three [item]s"
12. "[item] combo" / "[item] meal"
13. "Number [N]" (combo number)
14. "[item] with no [ingredient]" (overlaps with customize — classify as take_order)
15. Mumbled: "uh yeah the [item]"

### Context-Dependent Examples (CRITICAL — generate 300+)
These MUST have the `context` field set to the prior crew message:

**After combo offer** ("Want to make that a meal/combo for $X?"):
- "yes" → meal_upgrade
- "yeah" → meal_upgrade  
- "sure why not" → meal_upgrade
- "no just the sandwich" → take_order (decline)
- "nah I'm good" → take_order (decline)

**After "Anything else?"**:
- "no that's it" → order_complete
- "nope" → order_complete
- "yeah can I also get..." → take_order (continue)
- "actually yes, add a..." → take_order (continue)

**After "What drink would you like?"**:
- "Coke" → drink_selection
- "sprite please" → drink_selection
- "just water" → drink_selection

**After order readback "Does that sound right?"**:
- "yes" → order_confirmed
- "yep looks good" → order_confirmed
- "actually can you remove the..." → order_modify

**After "Cash, card, or mobile pay?"**:
- "card" → payment
- "Apple Pay" → payment
- "cash" → payment

### Speech Recognition Error Patterns
Include these common misrecognitions:
- big mack, bigmac → Big Mac
- quarter pounder cheese, QP → Quarter Pounder with Cheese
- mc double, mick double → McDouble
- mc chicken, mick chicken → McChicken
- mc crispy, the crispy → McCrispy
- file a fish, fillet of fish, fish fillet → Filet-O-Fish
- mc nuggets, chicken mcnuggets → Chicken McNuggets
- mc flurry, make flurry → McFlurry
- egg mc muffin, mcmuffin → Egg McMuffin
- doctor pepper → Dr Pepper
- hi c, high c → Hi-C Orange Lavaburst
- frappe, frappy → Frappé

### Edge Cases to Include
1. "What do I have so far?" → order_modify with `{"action": "readback"}`
2. "What's my total?" → price_inquiry with `{"query": "order_total"}`
3. "Can you repeat that?" → greet with `{}`
4. "Never mind, cancel everything" → order_modify with `{"action": "cancel_all"}`
5. "Actually make that two" → order_modify with `{"action": "change_qty", "qty": 2}`
6. "And a large Coke with that" → drink_selection
7. "BBQ and ranch sauce" → sauce_selection with `{"sauce": "BBQ, Ranch"}`
8. "Plain, nothing on it" → customize with `{"modification": "plain"}`
9. "Is the ice cream machine working?" → machine_down
10. "Can I speak to a manager?" → complaint with `{"type": "escalation"}`

## Output

Generate the JSONL now. Output ONLY the JSON lines, no commentary, no markdown fencing.
Start with greet examples, then take_order (by menu category), then other behaviors in order.
Ensure every line is valid JSON. Use double quotes only. No trailing commas.
