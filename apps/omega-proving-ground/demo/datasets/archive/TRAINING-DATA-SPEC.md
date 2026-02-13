# OMEGA Drive-Thru Training Data Specification

> **Purpose**: Feed this spec + the knowledge base JSON to Gemini Deep Thinking to generate
> 3,000–5,000 behavioral training examples for OMEGA's CryoLiquidLayer brain.
>
> **Context**: OMEGA is a quantum-inspired neural network that classifies customer utterances
> into behavioral categories. It does NOT generate text — it only decides WHAT behavior to
> execute. A separate LLM (Llama) handles HOW to respond in natural language.
>
> **Current state**: 334 examples, 26 behaviors, 95.6% accuracy. Target: 99%+.

---

## 1. Output Format

One JSON object per line (JSONL). Every line MUST be valid JSON.

```jsonl
{"input": "<customer utterance>", "behavior": "<behavior_type>", "target_action": "<behavior_type>", "target_data": {<structured data>}, "expected_response_contains": [], "context": "<optional prior crew message>"}
```

### Field Definitions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `input` | string | YES | The customer's spoken utterance (as captured by speech recognition) |
| `behavior` | string | YES | One of the 26 behavior types listed below |
| `target_action` | string | YES | Same as `behavior` (legacy compat) |
| `target_data` | object | YES | Structured data associated with the behavior (see per-behavior specs) |
| `expected_response_contains` | string[] | NO | Keywords the ideal response should contain (for evaluation) |
| `context` | string | NO | The previous crew message, if this utterance is context-dependent |

---

## 2. Behavior Types (26 total)

### Order Flow Behaviors
| Behavior | When to classify | `target_data` fields |
|----------|-----------------|---------------------|
| `greet` | Customer greets or initiates conversation | `{}` |
| `take_order` | Customer orders a lunch/dinner menu item | `{"item": "<exact menu name>", "price": <number>, "meal_price": <number or null>}` |
| `take_order_breakfast` | Customer orders a breakfast item | Same as `take_order` |
| `meal_upgrade` | Customer accepts combo/meal upgrade | `{"item": "<item being upgraded>", "meal_price": <combo price>}` |
| `drink_selection` | Customer specifies a drink | `{"drink": "<drink name>", "size": "small|medium|large"}` |
| `sauce_selection` | Customer specifies sauce(s) | `{"sauce": "<sauce name>"}` |
| `size_selection` | Customer specifies a size | `{"size": "small|medium|large"}` |
| `customize` | Customer modifies an item (no pickles, extra cheese, etc.) | `{"modification": "add|remove|plain|only", "ingredient": "<ingredient>"}` |
| `order_modify` | Customer changes/removes an already-ordered item | `{"action": "remove|change|change_qty|add|remove_last", "item": "<item>", "qty": <number>}` |
| `meal_substitution` | Customer swaps a meal side or drink | `{"from": "<original>", "to": "<replacement>"}` |
| `happy_meal_options` | Customer orders a Happy Meal | `{"item": "<happy meal type>", "price": <number>}` |
| `add_on_suggestion` | Customer agrees to an add-on | `{"item": "<add-on item>", "price": <number>}` |
| `order_complete` | Customer signals they're done ordering | `{}` |
| `order_confirmed` | Customer confirms the order readback is correct | `{}` |
| `payment` | Customer specifies payment method | `{"method": "card|cash|mobile|app|coupon"}` |

### Information Behaviors
| Behavior | When to classify | `target_data` fields |
|----------|-----------------|---------------------|
| `menu_inquiry` | Customer asks about menu items/categories | `{"category": "<category>"}` or `{"item": "<item>"}` or `{}` |
| `price_inquiry` | Customer asks how much something costs | `{"item": "<item>", "price": <number>}` |
| `nutrition_inquiry` | Customer asks about calories/nutrition | `{"item": "<item>"}` |
| `allergen_inquiry` | Customer asks if an item contains an allergen | `{"item": "<item>", "allergen": "<allergen>"}` |
| `allergen_alert` | Customer declares an allergy | `{"allergen": "<allergen>"}` |
| `dietary_inquiry` | Customer asks about dietary options | `{"diet": "gluten-free|vegetarian|vegan|low-calorie|keto"}` |
| `recommend` | Customer asks for a recommendation | `{"category": "<category>"}` or `{}` |
| `value_recommendation` | Customer asks for cheap/deal options | `{}` |

### Situational Behaviors
| Behavior | When to classify | `target_data` fields |
|----------|-----------------|---------------------|
| `complaint` | Customer has a problem or complaint | `{"type": "wrong_order|cold_food|long_wait|missing_items|quality|escalation|foreign_object"}` |
| `machine_down` | Customer orders ice cream / shake (machine down scenario) | `{"item": "<item>"}` |
| `time_check` | Customer asks about wait time, hours, or breakfast availability | `{"query": "wait_time|hours|breakfast_hours"}` |

---

## 3. Menu Items Reference

Use EXACT names and prices from the knowledge base. Here are the key items:

### Burgers
- Big Mac — $5.69 (meal $8.99)
- Quarter Pounder with Cheese — $5.99 (meal $9.29)
- Double Quarter Pounder with Cheese — $7.49 (meal $10.79)
- McDouble — $2.79 (meal $5.99)
- Double Cheeseburger — $3.39 (meal $6.59)
- Hamburger — $1.89 (meal $5.09)
- Cheeseburger — $2.29 (meal $5.49)

### Chicken
- McCrispy — $5.49 (meal $8.79)
- Filet-O-Fish — $4.79 (meal $7.99)
- 10-piece Chicken McNuggets — $5.29 (meal $8.49)
- 6-piece Chicken McNuggets — $3.69 (meal $6.89)
- 4-piece Chicken McNuggets — $2.49 (no meal)
- 20-piece Chicken McNuggets — $8.99 (no meal)
- McChicken — $1.89 (no meal)

### Breakfast
- Egg McMuffin — $4.49 (meal $6.49)
- Sausage McMuffin — $2.29 (meal $4.99)
- Sausage McMuffin with Egg — $4.79 (meal $6.79)
- Bacon, Egg & Cheese Biscuit — $4.89 (meal $6.89)
- Sausage Burrito — $2.49
- Hotcakes — $3.99 (meal $5.99)
- Hash Browns — $1.89

### Drinks
- Coca-Cola, Diet Coke, Sprite, Dr Pepper, Fanta Orange, Hi-C Orange Lavaburst, Sweet Tea, Unsweetened Iced Tea — S:$1.39 / M:$1.79 / L:$2.09
- Lemonade — S:$1.79 / M:$2.29 / L:$2.69
- Hot Coffee — S:$1.49 / M:$1.89 / L:$2.19
- Iced Coffee — S:$2.49 / M:$3.29 / L:$3.79
- Dasani Water — $1.39
- Milk — $1.59, Chocolate Milk — $1.79

### Sauces
BBQ, Sweet & Sour, Honey Mustard, Hot Mustard, Ranch, Tangy BBQ, Spicy Buffalo

### Desserts
- McFlurry (OREO / M&M's) — regular $4.89, snack $3.69
- Hot Fudge Sundae / Caramel Sundae — $2.89
- Vanilla Cone — $1.89
- Chocolate Chip Cookie — $1.29
- Baked Apple Pie — $1.69

---

## 4. Generation Requirements

### 4.1 Quantity Targets

| Behavior | Min Examples | Notes |
|----------|-------------|-------|
| `take_order` | 600+ | Every menu item × 8-15 phrasing variants |
| `take_order_breakfast` | 200+ | Every breakfast item × 8-10 variants |
| `meal_upgrade` | 150+ | Including contextual "yes", "sure", "do it", "yeah the meal" |
| `drink_selection` | 200+ | Every drink × multiple phrasings + colloquial |
| `order_complete` | 100+ | Many ways to say "that's all" |
| `order_modify` | 150+ | Remove, change, quantity change, "scratch that" |
| `greet` | 80+ | Diverse greetings including informal |
| `sauce_selection` | 100+ | Every sauce × multiple phrasings |
| `customize` | 150+ | Add/remove ingredient combos |
| `price_inquiry` | 80+ | Every major item |
| `menu_inquiry` | 80+ | Category and specific item questions |
| `complaint` | 60+ | All complaint types |
| `payment` | 60+ | All payment methods |
| `size_selection` | 60+ | Small/medium/large variants |
| `happy_meal_options` | 60+ | Various Happy Meal requests |
| `order_confirmed` | 50+ | "Yes that's right", "looks good", etc. |
| `recommend` | 50+ | "What's good?", category-specific |
| `value_recommendation` | 40+ | Budget-focused |
| `allergen_inquiry` | 40+ | Per-allergen questions |
| `allergen_alert` | 40+ | Allergy declarations |
| `dietary_inquiry` | 40+ | Diet-specific questions |
| `nutrition_inquiry` | 40+ | Calorie/macro questions |
| `add_on_suggestion` | 40+ | Accepting add-on offers |
| `meal_substitution` | 40+ | Side/drink swaps |
| `machine_down` | 30+ | Ice cream/shake requests |
| `time_check` | 30+ | Wait time, hours, breakfast questions |

### 4.2 Phrasing Diversity Requirements

For EACH menu item, generate variants covering:

1. **Formal**: "May I please have a Big Mac?"
2. **Casual**: "Lemme get a Big Mac"
3. **Terse**: "Big Mac"
4. **Slang**: "Hit me with a Big Mac"
5. **Indirect**: "I think I'll go with the Big Mac"
6. **With quantity**: "Two Big Macs please"
7. **With combo**: "Big Mac combo" / "Big Mac meal"
8. **Colloquial name**: "the number one" (for Big Mac)
9. **Abbreviated**: "QP" for Quarter Pounder, "nuggets" for McNuggets
10. **Speech recognition errors**: "big mack", "quarter pounder cheese", "mc chicken", "file a fish", "mc flurry"

### 4.3 Context-Dependent Examples

These are critical. Include the `context` field with the prior crew message:

```jsonl
{"input": "yes", "behavior": "meal_upgrade", "target_data": {"item": "Big Mac", "meal_price": 8.99}, "context": "Big Mac is $5.69. Want to make that a combo for $8.99?"}
{"input": "no thanks", "behavior": "order_complete", "target_data": {}, "context": "Anything else today?"}
{"input": "yeah", "behavior": "order_confirmed", "target_data": {}, "context": "OK so I have a Big Mac combo. Your total is $8.99. Does that sound right?"}
{"input": "card", "behavior": "payment", "target_data": {"method": "card"}, "context": "Will that be cash, card, or mobile pay?"}
{"input": "Coke", "behavior": "drink_selection", "target_data": {"drink": "Coca-Cola"}, "context": "What drink would you like with that?"}
```

Generate **at least 300 context-dependent examples** covering all context scenarios.

### 4.4 Edge Cases to Cover

1. **Multi-item in one utterance**: "Big Mac and a large fries" → `take_order` (Big Mac)
2. **Corrections mid-sentence**: "Actually no, make that a Quarter Pounder"
3. **Quantity + item**: "Three cheeseburgers", "Two Big Mac meals"
4. **Numbered combos**: "Number 1 through number 10"
5. **Partial names**: "the chicken sandwich", "fish", "nuggets", "double quarter"
6. **Negations after combo offer**: "No just the sandwich" → `take_order` (decline combo)
7. **Ambiguous "yes/no"**: Must have `context` field
8. **Adding to existing order**: "Oh and also a McFlurry"
9. **Changing mind**: "Wait, actually cancel that", "Scratch the last thing"
10. **Asking about current order**: "What do I have so far?" → `order_modify` with action `readback`
11. **Total inquiry**: "What's my total?" → `price_inquiry` with `{"query": "order_total"}`
12. **Mumbled/unclear**: "uh yeah the uh Big Mac thing" → `take_order`
13. **Kids ordering**: "My kid wants a Happy Meal with nuggets"
14. **Large group orders**: "OK first person wants a Big Mac, second person wants..."
15. **Dietary + order**: "What's gluten free? I'll take that"
16. **Rush/impatience**: "Just give me a number 1 and a Coke, that's it"
17. **Repeat request**: "Can you repeat that?" / "What did you say?"
18. **Custom combos**: "Big Mac with no pickles, extra sauce, make it a meal with a Coke"
19. **Sauce with nuggets**: "10 piece with BBQ and ranch"
20. **Upsize**: "Can I make the fries large?" / "Large everything"

### 4.5 Speech Recognition Error Patterns

Real speech-to-text produces these systematic errors. Include variants:

| Spoken | Recognized as |
|--------|--------------|
| Big Mac | big mack, big mac, bigmac |
| Quarter Pounder | quarter pounder, corner pounder, quarter pound |
| McDouble | mc double, mick double, make double |
| McNuggets | mc nuggets, mcnuggets, mic nuggets |
| Filet-O-Fish | fillet of fish, filet o fish, file a fish, fish fillet |
| McCrispy | mc crispy, mick crispy, the crispy |
| McFlurry | mc flurry, mcflurry, make flurry |
| Egg McMuffin | egg mcmuffin, egg mc muffin, mcmuffin |
| Dr Pepper | doctor pepper, dr. pepper |
| Hi-C | hi c, high c, hi see |
| Frappé | frappe, frappuccino, frappy |

---

## 5. Behavior Distribution Target

The final dataset should have approximately this distribution:

```
take_order:           ~25% (largest — it's the primary function)
drink_selection:       ~8%
meal_upgrade:          ~6%
take_order_breakfast:  ~7%
order_complete:        ~5%
customize:             ~5%
order_modify:          ~5%
sauce_selection:       ~4%
greet:                 ~3%
price_inquiry:         ~3%
menu_inquiry:          ~3%
payment:               ~3%
size_selection:        ~3%
happy_meal_options:    ~3%
order_confirmed:       ~2%
recommend:             ~2%
complaint:             ~2%
add_on_suggestion:     ~2%
value_recommendation:  ~2%
allergen_inquiry:      ~2%
allergen_alert:        ~1.5%
dietary_inquiry:       ~1.5%
nutrition_inquiry:     ~1.5%
meal_substitution:     ~1.5%
machine_down:          ~1%
time_check:            ~1%
```

---

## 6. Quality Rules

1. **Every `target_data.item` MUST match an exact name from the knowledge base** (Section 3)
2. **Every `target_data.price` MUST match the exact price from the knowledge base**
3. **No duplicate `input` strings** — every utterance must be unique
4. **Behaviors must be unambiguous** — if an input could be two behaviors, pick the most likely one in a drive-thru context
5. **`input` strings should be lowercase-tolerant** — mix cases naturally as speech recognition would produce
6. **No HTML, no emojis, no special formatting** in `input` strings
7. **Keep `input` strings realistic** — 1-20 words, as a real customer would speak
8. **Include filler words**: "um", "uh", "like", "so" occasionally for realism
