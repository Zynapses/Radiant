#!/usr/bin/env node
/**
 * Generate McValue & Extra Value Meals training data for OMEGA
 * Format: Gemini JSONL (input, behavior, target_action, target_data, expected_response_contains, context)
 * 
 * Run: node scripts/generate-mcvalue-training.mjs
 * Output: data/mcvalue-training-supplement.jsonl
 */
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'data', 'mcvalue-training-supplement.jsonl');

// --- Variation helpers ---
const fillers = ['', 'um ', 'uh ', 'like ', 'so ', 'hey ', 'actually ', 'man ', 'dude ', 'listen ', 'yo '];
const endings = ['', ' please', ' thanks', ' bro', ' for me', ' right now', ' instead', ' today'];
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const vary = base => `${pick(fillers)}${base}${pick(endings)}`.trim();

const lines = [];
const emit = obj => lines.push(JSON.stringify(obj));

// ============================================================
// 1. MEAL DEAL ORDERS (take_order)
// ============================================================
const mealDeals = [
  { name: 'McChicken Meal Deal', price: 5, aliases: ['mcchicken meal deal', 'mcchicken deal', 'five dollar mcchicken', '$5 mcchicken meal', 'mcchicken combo deal'] },
  { name: 'McDouble Meal Deal', price: 5, aliases: ['mcdouble meal deal', 'mcdouble deal', 'five dollar mcdouble', '$5 mcdouble meal', 'mcdouble combo deal'] },
  { name: 'Daily Double Meal Deal', price: 6, aliases: ['daily double meal deal', 'daily double deal', 'six dollar daily double', '$6 daily double', 'daily double combo deal'] },
];

for (const deal of mealDeals) {
  const templates = [
    `can i get the ${deal.aliases[0]}`,
    `i want the ${deal.aliases[1]}`,
    `let me get that ${deal.aliases[2]}`,
    `give me the ${deal.aliases[0]}`,
    `i'll take the ${deal.aliases[3]}`,
    `i'd like the ${deal.aliases[4]}`,
    `one ${deal.aliases[0]}`,
    `can i do the ${deal.aliases[1]}`,
    `how about the ${deal.aliases[0]}`,
    `let me try that ${deal.aliases[2]}`,
    `i want that $${deal.price} ${deal.name.split(' ')[0].toLowerCase()} deal`,
    `get me the ${deal.aliases[0]}`,
    `i'll have the ${deal.aliases[0]}`,
    `just the ${deal.aliases[1]}`,
    `i want a ${deal.aliases[0]}`,
  ];
  for (const t of templates) {
    for (let i = 0; i < 3; i++) {
      emit({
        input: vary(t),
        behavior: 'take_order',
        target_action: 'add_to_order',
        target_data: { item: deal.name, meal: true, price: deal.price, mcvalue_offer: 'meal_deal' },
        expected_response_contains: [deal.name],
        context: 'mcvalue_meal_deal'
      });
    }
  }
}

// ============================================================
// 2. BOGO ORDERS - LUNCH & DINNER (take_order)
// ============================================================
const bogoLD = [
  { name: 'Double Cheeseburger', aliases: ['double cheeseburger', 'double cheese'] },
  { name: 'McChicken', aliases: ['mcchicken', 'mc chicken'] },
  { name: '6 Piece McNuggets', aliases: ['6 piece mcnuggets', '6 nuggets', 'six piece nuggets', '6 piece'] },
  { name: 'Small French Fries', aliases: ['small fries', 'small french fries'] },
];

for (const item of bogoLD) {
  const templates = [
    `can i get the buy one add one ${item.aliases[0]}`,
    `i want the bogo ${item.aliases[0]}`,
    `let me do the buy one get one for a dollar on the ${item.aliases[0]}`,
    `i'll take two ${item.aliases[0]} with the add one for a dollar deal`,
    `give me the ${item.aliases[0]} and add one for a buck`,
    `can i do the buy one add one with the ${item.aliases[1] || item.aliases[0]}`,
    `i want a ${item.aliases[0]} and add another one for a dollar`,
    `let me get the ${item.aliases[0]} bogo deal`,
  ];
  for (const t of templates) {
    for (let i = 0; i < 3; i++) {
      emit({
        input: vary(t),
        behavior: 'take_order',
        target_action: 'add_to_order',
        target_data: { item: item.name, mcvalue_offer: 'buy_one_add_one', add_on_price: 1.00, daypart: 'lunch_dinner' },
        expected_response_contains: [item.name, '$1'],
        context: 'mcvalue_bogo_lunch_dinner'
      });
    }
  }
}

// ============================================================
// 3. BOGO ORDERS - BREAKFAST (take_order_breakfast)
// ============================================================
const bogoBrk = [
  { name: 'Sausage Biscuit', aliases: ['sausage biscuit'] },
  { name: 'Sausage McMuffin', aliases: ['sausage mcmuffin', 'sausage muffin'] },
  { name: 'Sausage Burrito', aliases: ['sausage burrito'] },
  { name: 'Hash Browns', aliases: ['hash browns', 'hashbrowns', 'hash brown'] },
];

for (const item of bogoBrk) {
  const templates = [
    `can i get the buy one add one ${item.aliases[0]}`,
    `i want two ${item.aliases[0]} with the dollar deal`,
    `let me do the bogo on the ${item.aliases[0]}`,
    `give me a ${item.aliases[0]} and add one for a dollar`,
    `i'll take the buy one add one ${item.aliases[0]}`,
    `can i do the ${item.aliases[0]} add one for a buck`,
    `let me get two ${item.aliases[0]} with that add one deal`,
    `i want the ${item.aliases[0]} bogo`,
  ];
  for (const t of templates) {
    for (let i = 0; i < 3; i++) {
      emit({
        input: vary(t),
        behavior: 'take_order_breakfast',
        target_action: 'add_to_order',
        target_data: { item: item.name, mcvalue_offer: 'buy_one_add_one', add_on_price: 1.00, daypart: 'breakfast' },
        expected_response_contains: [item.name, '$1'],
        context: 'mcvalue_bogo_breakfast'
      });
    }
  }
}

// ============================================================
// 4. EATS ORDERS (take_order)
// ============================================================
const eatsItems = [
  { name: 'Cheeseburger', aliases: ['cheeseburger', 'cheese burger'] },
  { name: '4 Piece McNuggets', aliases: ['4 piece mcnuggets', '4 nuggets', 'four piece nuggets'] },
  { name: 'McFlurry with OREO Cookies', aliases: ['oreo mcflurry', 'mcflurry oreo', 'oreo flurry'] },
  { name: 'McFlurry with M&M Candies', aliases: ['m&m mcflurry', 'mcflurry m&m', 'mnm mcflurry', 'eminem mcflurry'] },
];

for (const item of eatsItems) {
  const templates = [
    `can i get the ${item.aliases[0]} from the eats menu`,
    `let me get a ${item.aliases[0]}`,
    `i'll take the ${item.aliases[0]} off the value menu`,
    `give me a ${item.aliases[0]} from mcvalue`,
    `i want that ${item.aliases[0]} from the eats section`,
  ];
  for (const t of templates) {
    for (let i = 0; i < 3; i++) {
      emit({
        input: vary(t),
        behavior: 'take_order',
        target_action: 'add_to_order',
        target_data: { item: item.name, mcvalue_section: 'eats' },
        expected_response_contains: [item.name],
        context: 'mcvalue_eats'
      });
    }
  }
}

// ============================================================
// 5. EXTRA VALUE MEAL ORDERS - BREAKFAST (take_order_breakfast)
// ============================================================
const evmBreakfast = [
  { name: 'Sausage McMuffin with Egg Meal', aliases: ['sausage mcmuffin with egg meal', 'sausage egg mcmuffin meal'] },
  { name: 'Egg McMuffin Meal', aliases: ['egg mcmuffin meal', 'egg muffin meal'] },
  { name: 'Bacon Egg Cheese Biscuit Meal', aliases: ['bacon egg cheese biscuit meal', 'bec biscuit meal'] },
  { name: 'Sausage Biscuit with Egg Meal', aliases: ['sausage biscuit with egg meal', 'sausage egg biscuit meal'] },
  { name: 'Sausage Egg Cheese McGriddles Meal', aliases: ['sausage egg cheese mcgriddle meal', 'sec mcgriddle meal', 'mcgriddles meal'] },
  { name: 'Bacon Egg Cheese McGriddles Meal', aliases: ['bacon egg cheese mcgriddle meal', 'bec mcgriddle meal'] },
  { name: 'Sausage Burrito Meal', aliases: ['sausage burrito meal', 'burrito meal'] },
  { name: 'Bacon Egg Cheese Bagel Meal', aliases: ['bacon egg cheese bagel meal', 'bec bagel meal'] },
  { name: 'Steak Egg Cheese Bagel Meal', aliases: ['steak egg cheese bagel meal', 'steak bagel meal'] },
];

for (const item of evmBreakfast) {
  const templates = [
    `can i get the ${item.aliases[0]}`,
    `i want the ${item.aliases[0]}`,
    `let me get a ${item.aliases[1] || item.aliases[0]}`,
    `i'll have the ${item.aliases[0]}`,
    `give me a ${item.aliases[0]}`,
    `one ${item.aliases[0]}`,
  ];
  for (const t of templates) {
    for (let i = 0; i < 3; i++) {
      emit({
        input: vary(t),
        behavior: 'take_order_breakfast',
        target_action: 'add_to_order',
        target_data: { item: item.name, meal: true, daypart: 'breakfast', category: 'extra_value' },
        expected_response_contains: [item.name.split(' ')[0]],
        context: 'extra_value_breakfast'
      });
    }
  }
}

// ============================================================
// 6. EXTRA VALUE MEAL ORDERS - LUNCH & DINNER (take_order)
// ============================================================
const evmLunchDinner = [
  { name: 'Big Mac Meal', aliases: ['big mac meal', 'big mac combo'] },
  { name: 'Quarter Pounder Meal', aliases: ['quarter pounder meal', 'qpc meal'] },
  { name: 'Double QPC Meal', aliases: ['double quarter pounder meal', 'double qpc meal'] },
  { name: '10 Piece McNuggets Meal', aliases: ['10 piece nuggets meal', '10 piece mcnuggets meal', 'nuggets meal'] },
  { name: 'McCrispy Meal', aliases: ['mccrispy meal', 'crispy chicken meal'] },
  { name: 'Filet-O-Fish Meal', aliases: ['filet o fish meal', 'fish meal'] },
];

for (const item of evmLunchDinner) {
  const templates = [
    `can i get the ${item.aliases[0]}`,
    `i want a ${item.aliases[0]}`,
    `let me get the ${item.aliases[1] || item.aliases[0]}`,
    `i'll take a ${item.aliases[0]}`,
    `give me the ${item.aliases[0]}`,
    `one ${item.aliases[0]}`,
  ];
  for (const t of templates) {
    for (let i = 0; i < 3; i++) {
      emit({
        input: vary(t),
        behavior: 'take_order',
        target_action: 'add_to_order',
        target_data: { item: item.name, meal: true, category: 'extra_value' },
        expected_response_contains: [item.name.split(' ')[0]],
        context: 'extra_value_lunch_dinner'
      });
    }
  }
}

// ============================================================
// 7. MCVALUE RESTRICTION ENFORCEMENT (order_modify)
// ============================================================
const restrictionTemplates = [
  // Stacking attempts
  { input: 'can i get the mcchicken meal deal AND the mcdouble meal deal', td: { violation: 'multiple_offers', attempted: ['McChicken Meal Deal', 'McDouble Meal Deal'] } },
  { input: 'i want both the meal deal and the buy one add one', td: { violation: 'multiple_offers', attempted: ['meal_deal', 'buy_one_add_one'] } },
  { input: 'give me the five dollar deal and also the bogo', td: { violation: 'multiple_offers', attempted: ['meal_deal', 'buy_one_add_one'] } },
  { input: 'can i use the meal deal and a coupon together', td: { violation: 'offer_plus_coupon', attempted: ['meal_deal', 'coupon'] } },
  { input: 'i have a coupon can i use it with the mcvalue deal', td: { violation: 'offer_plus_coupon', attempted: ['coupon', 'mcvalue'] } },
  { input: 'can i get two meal deals', td: { violation: 'multiple_offers', attempted: ['meal_deal', 'meal_deal'] } },
  { input: 'let me get the mcchicken deal and the daily double deal', td: { violation: 'multiple_offers', attempted: ['McChicken Meal Deal', 'Daily Double Meal Deal'] } },
  { input: 'can i do two bogo deals on different items', td: { violation: 'multiple_offers', attempted: ['buy_one_add_one', 'buy_one_add_one'] } },
  // Upgrade attempts
  { input: 'can i make the meal deal a large', td: { violation: 'meal_deal_upgrade', attempted: ['size_upgrade'] } },
  { input: 'upgrade the five dollar meal to large fries', td: { violation: 'meal_deal_upgrade', attempted: ['size_upgrade'] } },
  { input: 'can i get the meal deal with medium fries instead of small', td: { violation: 'meal_deal_upgrade', attempted: ['size_upgrade'] } },
  { input: 'make my meal deal large', td: { violation: 'meal_deal_upgrade', attempted: ['size_upgrade'] } },
  // Daypart mixing
  { input: 'can i get the bogo hash browns with a bogo mcchicken', td: { violation: 'daypart_mixing', attempted: ['breakfast_bogo', 'lunch_bogo'] } },
  { input: 'let me do the sausage biscuit add one deal and the double cheeseburger add one', td: { violation: 'daypart_mixing', attempted: ['breakfast_bogo', 'lunch_bogo'] } },
  // Rewards stacking
  { input: 'can i use my rewards to pay for the meal deal', td: { violation: 'rewards_plus_mcvalue', attempted: ['rewards_redemption', 'meal_deal'] } },
  { input: 'let me redeem my points and use the bogo deal', td: { violation: 'rewards_plus_mcvalue', attempted: ['rewards_redemption', 'buy_one_add_one'] } },
];

for (const r of restrictionTemplates) {
  for (let i = 0; i < 8; i++) {
    emit({
      input: vary(r.input),
      behavior: 'order_modify',
      target_action: 'mcvalue_restriction',
      target_data: r.td,
      expected_response_contains: ['one', 'offer', 'per order'],
      context: 'mcvalue_restriction'
    });
  }
}

// ============================================================
// 8. MCVALUE INQUIRIES (menu_inquiry, price_inquiry, value_recommendation)
// ============================================================
const menuInquiries = [
  'what do you have on the mcvalue menu',
  'what are the value deals',
  'tell me about the mcvalue',
  'what deals do you have right now',
  'what is on the dollar menu',
  'what can i get for cheap',
  'what are your specials',
  'any deals going on',
  'do you have a value menu',
  'what is the cheapest thing you have',
  'what are the meal deals',
  'tell me about the five dollar meals',
  'what comes with the meal deal',
  'what is the buy one add one',
  'how does the bogo work',
  'what are the eats items',
  'what can i get from mcvalue eats',
  'do you still have the five dollar meal deal',
  'is the mcchicken meal deal still available',
  'what breakfast deals do you have',
  'any breakfast value deals',
  'what is on the breakfast mcvalue',
];

for (const q of menuInquiries) {
  for (let i = 0; i < 4; i++) {
    const isMealDeal = q.includes('meal deal') || q.includes('five dollar') || q.includes('$5');
    const isPrice = q.includes('cheap') || q.includes('dollar') || q.includes('price');
    const isBreakfast = q.includes('breakfast');
    emit({
      input: vary(q),
      behavior: isPrice ? 'price_inquiry' : 'menu_inquiry',
      target_action: isPrice ? 'price_lookup' : 'menu_lookup',
      target_data: {
        category: 'mcvalue',
        section: isMealDeal ? 'meal_deals' : isBreakfast ? 'breakfast' : 'all',
      },
      expected_response_contains: ['McValue'],
      context: isBreakfast ? 'mcvalue_breakfast_inquiry' : 'mcvalue_inquiry'
    });
  }
}

// Value recommendations
const valueRecs = [
  'what is the best deal you have',
  'i am on a budget what should i get',
  'what is the most food for the money',
  'i only have five dollars what can i get',
  'cheapest meal you have',
  'what do you recommend for a good deal',
  'i want a lot of food for not a lot of money',
  'what is the best bang for my buck',
  'im broke what should i order',
  'what is the best value here',
  'hook me up with the cheapest meal',
  'i need to eat cheap today',
];

for (const q of valueRecs) {
  for (let i = 0; i < 4; i++) {
    emit({
      input: vary(q),
      behavior: 'value_recommendation',
      target_action: 'recommend_value',
      target_data: { category: 'mcvalue', suggest: ['Meal Deal', 'Buy One Add One', 'Eats'] },
      expected_response_contains: ['McValue', 'deal'],
      context: 'mcvalue_recommendation'
    });
  }
}

// ============================================================
// 9. EATS + OFFER COMBO (valid stacking - Eats is NOT an offer)
// ============================================================
const validStacking = [
  'can i get the meal deal and also a cheeseburger from eats',
  'i want the five dollar mcchicken deal plus a 4 piece nuggets',
  'let me do the bogo mcchicken and add an oreo mcflurry',
  'give me the mcdouble deal and throw in a cheeseburger',
  'meal deal and a mcflurry on the side',
  'i want the bogo double cheeseburger and also a 4 piece from eats',
  'can i add a cheeseburger to my meal deal',
  'get me the daily double deal plus an eats cheeseburger',
];

for (const q of validStacking) {
  for (let i = 0; i < 4; i++) {
    emit({
      input: vary(q),
      behavior: 'take_order',
      target_action: 'add_to_order',
      target_data: { mcvalue_offer: 'meal_deal_or_bogo', eats_addon: true, valid_combo: true },
      expected_response_contains: [],
      context: 'mcvalue_eats_combo_valid'
    });
  }
}

// ============================================================
// 10. TIME / AVAILABILITY CHECKS (time_check)
// ============================================================
const timeChecks = [
  'are the breakfast deals still available',
  'can i still get the sausage biscuit bogo',
  'is it too late for the breakfast mcvalue',
  'when do the lunch deals start',
  'are the meal deals available now',
  'can i get the breakfast bogo after 10:30',
  'do you have the bogo at this time',
  'when does the mcvalue breakfast end',
  'is the five dollar deal an all day thing',
  'can i get the daily double deal for breakfast',
];

for (const q of timeChecks) {
  for (let i = 0; i < 4; i++) {
    emit({
      input: vary(q),
      behavior: 'time_check',
      target_action: 'check_availability',
      target_data: {
        category: 'mcvalue',
        daypart: q.includes('breakfast') || q.includes('sausage') || q.includes('10:30') ? 'breakfast' : 'lunch_dinner'
      },
      expected_response_contains: [],
      context: 'mcvalue_time_check'
    });
  }
}

// --- Shuffle and write ---
for (let i = lines.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [lines[i], lines[j]] = [lines[j], lines[i]];
}

writeFileSync(OUT, lines.join('\n') + '\n');
console.log(`✅ Generated ${lines.length} training examples → ${OUT}`);

// Stats
const stats = {};
for (const line of lines) {
  const obj = JSON.parse(line);
  const ctx = obj.context || 'unknown';
  stats[ctx] = (stats[ctx] || 0) + 1;
}
console.log('\n📊 Breakdown by context:');
for (const [k, v] of Object.entries(stats).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k}: ${v}`);
}
