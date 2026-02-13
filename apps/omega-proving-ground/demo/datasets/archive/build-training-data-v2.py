#!/usr/bin/env python3
"""Build comprehensive McDonald's behavioral training data for OMEGA v2. ~3000+ examples."""
import json
from pathlib import Path
from collections import Counter

OUT = Path(__file__).parent / "mcdonalds-behavioral-training.jsonl"
examples, seen = [], set()

def ex(text, behavior, td=None, ctx=None):
    key = text.lower().strip()
    if key in seen: return
    seen.add(key)
    o = {"input": text, "behavior": behavior, "target_action": behavior,
         "target_data": td or {}, "expected_response_contains": []}
    if ctx: o["context"] = ctx
    examples.append(o)

# === MENU DATA ===
BURGERS = [("Big Mac",5.69,8.99),("Quarter Pounder with Cheese",5.99,9.29),
    ("Double Quarter Pounder with Cheese",7.49,10.79),("McDouble",2.79,5.99),
    ("Double Cheeseburger",3.39,6.59),("Hamburger",1.89,5.09),("Cheeseburger",2.29,5.49)]
CHICKEN = [("McCrispy",5.49,8.79),("Filet-O-Fish",4.79,7.99),
    ("10-piece Chicken McNuggets",5.29,8.49),("6-piece Chicken McNuggets",3.69,6.89),
    ("4-piece Chicken McNuggets",2.49,None),("20-piece Chicken McNuggets",8.99,None),("McChicken",1.89,None)]
BREAKFAST = [("Egg McMuffin",4.49,6.49),("Sausage McMuffin",2.29,4.99),
    ("Sausage McMuffin with Egg",4.79,6.79),("Bacon, Egg & Cheese Biscuit",4.89,6.89),
    ("Sausage Burrito",2.49,None),("Hotcakes",3.99,5.99),("Hash Browns",1.89,None)]
DESSERTS = [("McFlurry with OREO Cookies",4.89),("McFlurry with M&M'S Candies",4.89),
    ("Hot Fudge Sundae",2.89),("Caramel Sundae",2.89),("Vanilla Cone",1.89),
    ("Chocolate Chip Cookie",1.29),("Baked Apple Pie",1.69)]
MCCAFE = [("Caramel Frappé",4.79),("Mocha Frappé",4.79),("Caramel Macchiato",4.39),("Mocha Latte",4.39)]
DRINKS = {"Coca-Cola":1.79,"Diet Coke":1.79,"Sprite":1.79,"Dr Pepper":1.79,"Fanta Orange":1.79,
    "Hi-C Orange Lavaburst":1.79,"Sweet Tea":1.79,"Unsweetened Iced Tea":1.79,"Lemonade":2.29,
    "Hot Coffee (Premium Roast)":1.89,"Iced Coffee":3.29,"Dasani Water":1.39,"Milk (1% Low Fat)":1.59,"Chocolate Milk":1.79}
SAUCES = ["BBQ","Sweet & Sour","Honey Mustard","Hot Mustard","Ranch","Tangy BBQ","Spicy Buffalo"]
COMBO_NUMS = {1:"Big Mac",2:"Quarter Pounder with Cheese",3:"Double Quarter Pounder with Cheese",
    4:"McCrispy",5:"Filet-O-Fish",6:"10-piece Chicken McNuggets",7:"McDouble",
    8:"Cheeseburger",9:"6-piece Chicken McNuggets",10:"McChicken"}
ALIASES = {"Big Mac":["big mac","big mack","bigmac"],"Quarter Pounder with Cheese":["quarter pounder","QP","quarter pounder cheese"],
    "Double Quarter Pounder with Cheese":["double quarter pounder","double QP","double quarter"],
    "McDouble":["mcdouble","mc double"],"McChicken":["mcchicken","mc chicken"],
    "McCrispy":["mccrispy","mc crispy","crispy chicken sandwich","chicken sandwich"],
    "Filet-O-Fish":["filet o fish","fish sandwich","file a fish","the fish"],
    "10-piece Chicken McNuggets":["10 piece","10 piece nuggets","nuggets","mcnuggets"],
    "6-piece Chicken McNuggets":["6 piece","6 piece nuggets","six piece"],
    "4-piece Chicken McNuggets":["4 piece","four piece nuggets"],
    "20-piece Chicken McNuggets":["20 piece","twenty piece nuggets"],
    "Egg McMuffin":["egg mcmuffin","egg mc muffin","mcmuffin"],
    "Sausage McMuffin":["sausage mcmuffin","sausage mc muffin"],
    "Hotcakes":["hotcakes","pancakes"],"Hash Browns":["hash brown","hashbrown"],
    "McFlurry with OREO Cookies":["oreo mcflurry","mcflurry","mc flurry"],
    "McFlurry with M&M'S Candies":["m&m mcflurry","mnm mcflurry"],
    "Hot Fudge Sundae":["sundae","fudge sundae"],"Vanilla Cone":["vanilla cone","ice cream cone","cone"],
    "Baked Apple Pie":["apple pie","pie"],"Chocolate Chip Cookie":["cookie"],
    "Caramel Frappé":["caramel frappe","frappe","frappuccino"],"Mocha Frappé":["mocha frappe"],
    "Caramel Macchiato":["macchiato"],"Mocha Latte":["latte","a latte"]}
DRINK_ALIASES = {"Coca-Cola":["coke","a Coke"],"Diet Coke":["diet coke","a diet coke"],
    "Sprite":["sprite"],"Dr Pepper":["dr pepper","doctor pepper"],"Fanta Orange":["fanta","orange fanta"],
    "Hi-C Orange Lavaburst":["hi-c","hi c","high c"],"Sweet Tea":["sweet tea"],
    "Unsweetened Iced Tea":["unsweet tea","unsweetened tea"],"Lemonade":["lemonade"],
    "Hot Coffee (Premium Roast)":["coffee","a coffee","hot coffee"],"Iced Coffee":["iced coffee"],
    "Dasani Water":["water","just water"],"Milk (1% Low Fat)":["milk"],"Chocolate Milk":["chocolate milk"]}

TMPLS = ["can I get a {0}","I'll have a {0} please","let me get a {0}","one {0}","{0} please",
    "I want a {0}","give me a {0}","I'd like a {0}","could I get a {0}","I'll take a {0}",
    "I'll do the {0}","get me a {0}","lemme get a {0}"]
CASUAL = ["yeah lemme get a {0}","uh I'll have the {0}","um can I get a {0}","yeah a {0}","the {0}"]

# === GREETINGS (80+) ===
for g in ["hi","hello","hey","hey there","good morning","good afternoon","good evening","yo",
    "yo what's up","what's up","hey, can I order?","hi, is this where I order?","hello there",
    "hi how are you","hey how you doing","howdy","sup","hi there","morning","afternoon",
    "hi can I place an order","yo can I order","um hi","uh hello","hey can I get something",
    "hi I'd like to order","hello I want to order","hey I'm ready to order","heya",
    "yeah hi","um yes hi","hey there, ready to order","hi, we're ready","hello, can we order",
    "hey, let me order real quick","hi I know what I want","hello, I'm ready",
    "hi, just need a couple things","hey there, can I get some food","yo, let me get some food",
    "good morning, I'd like to place an order","hi good morning","hey good afternoon",
    "what's good today","alright let me order","ok I'm ready","so yeah I want to order",
    "hi can I start my order","yo I'm starving, let me order","can I order please",
    "I'd like to order","ready to order","yeah I want to place an order","ok let me order",
    "hi yeah I'm ready","hey, just a quick order","hello, small order","hi I need to feed my family",
    "sup, can I order","alright so","ok so","yeah so","hi again","hey hey","hey boss",
    "yo lemme order","hi there can I order please","hey so can I order",
    "yeah uh I want to order please","ayo","hola","good day"]:
    ex(g, "greet")

# === TAKE ORDER (all items) ===
def gen_order(name, price, meal, beh="take_order"):
    td = {"item":name,"price":price}
    if meal: td["meal_price"] = meal
    for t in TMPLS: ex(t.format(name), beh, td)
    for t in CASUAL[:3]: ex(t.format(name), beh, td)
    ex(f"two {name}s", beh, td)
    if meal:
        for t in ["{0} combo","{0} meal","I'll do the {0} combo"]: ex(t.format(name), beh, td)
    for a in ALIASES.get(name, []):
        for t in ["can I get {0}","I want {0}","{0}","{0} please","let me get {0}"]:
            ex(t.format(a), beh, td)

for n,p,m in BURGERS+CHICKEN: gen_order(n,p,m)
for n,p in DESSERTS+MCCAFE: gen_order(n,p,None)
for n,p,m in BREAKFAST: gen_order(n,p,m,"take_order_breakfast")
# Breakfast extras
for txt,td in [("I want the pancakes",{"item":"Hotcakes","price":3.99,"meal_price":5.99}),
    ("an egg mcmuffin please",{"item":"Egg McMuffin","price":4.49,"meal_price":6.49}),
    ("sausage egg mcmuffin",{"item":"Sausage McMuffin with Egg","price":4.79,"meal_price":6.79}),
    ("bacon egg cheese biscuit",{"item":"Bacon, Egg & Cheese Biscuit","price":4.89,"meal_price":6.89}),
    ("a burrito",{"item":"Sausage Burrito","price":2.49}),("just a hash brown",{"item":"Hash Browns","price":1.89}),
    ("two hash browns",{"item":"Hash Browns","price":1.89}),("breakfast burrito",{"item":"Sausage Burrito","price":2.49}),
    ("hotcakes and sausage",{"item":"Hotcakes","price":3.99,"meal_price":5.99}),
    ("bacon egg and cheese",{"item":"Bacon, Egg & Cheese Biscuit","price":4.89,"meal_price":6.89})]:
    ex(txt,"take_order_breakfast",td)
# Fries
for txt,p in [("fries",3.09),("small fries",2.19),("medium fries",3.09),("large fries",3.79),
    ("large fries please",3.79),("can I get fries",3.09),("a side of fries",3.09),("just fries",3.09)]:
    ex(txt,"take_order",{"item":"French Fries","price":p})
# Combo numbers
for num,name in COMBO_NUMS.items():
    item = next((x for x in BURGERS+CHICKEN if x[0]==name), None)
    if not item: continue
    td = {"item":name,"price":item[1]}
    if item[2]: td["meal_price"] = item[2]
    for t in [f"number {num}",f"I'll take a number {num}",f"the number {num}",f"number {num} please",
        f"give me the number {num}",f"a number {num} combo"]: ex(t,"take_order",td)
# Multi-item / filler / also orders
for txt,td in [("two Big Macs and a large fry",{"item":"Big Mac","price":5.69,"meal_price":8.99}),
    ("three cheeseburgers",{"item":"Cheeseburger","price":2.29,"meal_price":5.49}),
    ("Big Mac combo and a McChicken",{"item":"Big Mac","price":5.69,"meal_price":8.99}),
    ("uh yeah the Big Mac",{"item":"Big Mac","price":5.69,"meal_price":8.99}),
    ("um I think I want the Quarter Pounder",{"item":"Quarter Pounder with Cheese","price":5.99,"meal_price":9.29}),
    ("yeah uh nuggets",{"item":"10-piece Chicken McNuggets","price":5.29,"meal_price":8.49}),
    ("that fish thing",{"item":"Filet-O-Fish","price":4.79,"meal_price":7.99}),
    ("the chicken one",{"item":"McCrispy","price":5.49,"meal_price":8.79}),
    ("oh and also a McFlurry",{"item":"McFlurry with OREO Cookies","price":4.89}),
    ("and add a cookie",{"item":"Chocolate Chip Cookie","price":1.29}),
    ("also an apple pie",{"item":"Baked Apple Pie","price":1.69}),
    ("throw in a McChicken too",{"item":"McChicken","price":1.89}),
    ("can I also get an iced coffee",{"item":"Iced Coffee","price":3.29}),
    ("two McDoubles and a 10 piece",{"item":"McDouble","price":2.79,"meal_price":5.99}),
    ("a McCrispy and a McChicken",{"item":"McCrispy","price":5.49,"meal_price":8.79})]:
    ex(txt,"take_order",td)

# === MEAL UPGRADE (150+) ===
upgrade_phrases = ["make that a meal","yeah I'll do the combo","can you make it a meal","combo please",
    "I'll do the meal","yeah make it a combo","sure, the meal sounds good","yes the meal",
    "yes please","yeah","yep","yup","sure","ok","okay","absolutely","definitely",
    "go ahead","do it","sounds good","why not","let's do it","sure why not",
    "yeah the meal","yes combo","the combo","meal please","yeah I'll take the meal",
    "might as well","sure make it a meal","yeah the combo sounds good","upgrade it",
    "add fries and a drink","yes a meal please","sure a combo","yeah I want the meal",
    "yes I'll take the combo","combo for sure","do the combo","yep combo","yeah combo please",
    "yeah that sounds good","let's do the meal","I'll upgrade to the combo",
    "yep make it a meal","go ahead and make that a combo","the meal is fine"]
# Generate upgrade phrases — only 3-5 unique phrases per item, no markers
for item_name,price,meal in BURGERS+CHICKEN[:4]+BREAKFAST[:4]:
    if not meal: continue
    td = {"item":item_name,"meal_price":meal}
    ctx = f"{item_name} is ${price}. Want to make that a combo for ${meal}?"
    ex(f"make that a {item_name} meal","meal_upgrade",td)
    ex(f"{item_name} combo please","meal_upgrade",td)
    ex(f"yeah the {item_name} meal","meal_upgrade",td)
    ex(f"upgrade the {item_name} to a combo","meal_upgrade",td)
    ex(f"I'll do the {item_name} combo","meal_upgrade",td)
# Generic upgrade phrases (context-dependent, no item in text)
for p in upgrade_phrases:
    ex(p,"meal_upgrade",{"item":"Big Mac","meal_price":8.99})
# Decline combo
for p in ["no just the sandwich","nah I'm good","no thanks just the burger","no meal",
    "just the sandwich please","no combo","nah just the single","skip the combo","no I'm fine",
    "just the burger","nope just that","no fries no drink"]:
    ex(p,"take_order",{"item":"Big Mac","price":5.69,"meal_price":8.99},
       ctx="Big Mac is $5.69. Want to make that a combo for $8.99?")

# === DRINK SELECTION (200+) ===
for canonical,aliases in DRINK_ALIASES.items():
    price = DRINKS.get(canonical,1.79)
    for a in aliases:
        for t in ["{0}","I'll have a {0}","a {0} please","can I get a {0}","make it a {0}"]:
            ex(t.format(a),"drink_selection",{"drink":canonical,"size":"medium"})
    for sz in ["small","medium","large"]:
        ex(f"{sz} {aliases[0]}","drink_selection",{"drink":canonical,"size":sz})
# Contextual drink — clean inputs, context in ctx field
drink_ctxs = ["What drink would you like with that?","Combo it is. What to drink?","And what drink with your meal?"]
for can,als in list(DRINK_ALIASES.items())[:8]:
    ex(f"I'll take a {als[0]} for the drink","drink_selection",{"drink":can},drink_ctxs[0])
    ex(f"make it a {als[0]}","drink_selection",{"drink":can},drink_ctxs[1])
    if len(als) > 1:
        ex(f"{als[1]} with the meal","drink_selection",{"drink":can},drink_ctxs[2])
# Extra drink phrases
for txt,td in [("just a coke is fine",{"drink":"Coca-Cola"}),("Coke please",{"drink":"Coca-Cola"}),
    ("I'll take a large Coke",{"drink":"Coca-Cola","size":"large"}),("diet please",{"drink":"Diet Coke"}),
    ("can I get a water instead",{"drink":"Dasani Water"}),("I'll just have water",{"drink":"Dasani Water"}),
    ("iced tea no sugar",{"drink":"Unsweetened Iced Tea"}),("milk for the happy meal",{"drink":"Milk (1% Low Fat)"}),
    ("chocolate milk for the kid",{"drink":"Chocolate Milk"}),("the orange drink",{"drink":"Fanta Orange"})]:
    ex(txt,"drink_selection",td)

# === SAUCE SELECTION (100+) ===
for s in SAUCES:
    for t in ["{0} sauce","I'll take {0}","{0} please","can I get {0}","yeah {0}","the {0}"]:
        ex(t.format(s),"sauce_selection",{"sauce":s})
for txt,td in [("barbecue sauce",{"sauce":"BBQ"}),("sweet and sour",{"sauce":"Sweet & Sour"}),
    ("honey mustard please",{"sauce":"Honey Mustard"}),("ranch please",{"sauce":"Ranch"}),
    ("buffalo sauce",{"sauce":"Spicy Buffalo"}),("no sauce",{"sauce":"none"}),
    ("no sauce thanks",{"sauce":"none"}),("extra BBQ sauce",{"sauce":"BBQ"}),
    ("two BBQ and one ranch",{"sauce":"BBQ, Ranch"}),("BBQ and sweet and sour",{"sauce":"BBQ, Sweet & Sour"}),
    ("just ketchup",{"sauce":"Ketchup"}),("all BBQ",{"sauce":"BBQ"}),("surprise me",{"sauce":"assorted"})]:
    ex(txt,"sauce_selection",td)

# === SIZE SELECTION (60+) ===
for txt,sz in [("medium","medium"),("make it a large","large"),("small please","small"),("large","large"),
    ("large fries and large drink","large"),("can I get that in a large","large"),("supersize it","large"),
    ("go large","large"),("upsize it","large"),("keep it medium","medium"),("regular size","medium"),
    ("the biggest size","large"),("smallest size","small"),("large please","large"),("small is fine","small"),
    ("yeah large","large"),("nah keep it medium","medium"),("upgrade to large","large"),
    ("can you make it a large","large"),("make everything large","large"),("I want the large","large"),
    ("just medium","medium"),("medium is good","medium"),("I'll do large fries and a large drink","large"),
    ("small fries small drink","small"),("large everything","large"),("make the fries large","large")]:
    ex(txt,"size_selection",{"size":sz})

# === CUSTOMIZE (150+) ===
for txt,td in [("no pickles",{"modification":"remove","ingredient":"pickles"}),
    ("no onions",{"modification":"remove","ingredient":"onions"}),
    ("no onions on that",{"modification":"remove","ingredient":"onions"}),
    ("hold the lettuce",{"modification":"remove","ingredient":"lettuce"}),
    ("extra cheese",{"modification":"add","ingredient":"cheese"}),
    ("add bacon",{"modification":"add","ingredient":"bacon"}),
    ("no mayo",{"modification":"remove","ingredient":"mayo"}),
    ("extra pickles please",{"modification":"add","ingredient":"pickles"}),
    ("no tomato",{"modification":"remove","ingredient":"tomato"}),
    ("can I get that plain",{"modification":"plain"}),
    ("just ketchup and mustard only",{"modification":"only","ingredient":"ketchup, mustard"}),
    ("no mustard no ketchup",{"modification":"remove","ingredient":"mustard, ketchup"}),
    ("add mac sauce",{"modification":"add","ingredient":"Big Mac sauce"}),
    ("no pickles no onions",{"modification":"remove","ingredient":"pickles, onions"}),
    ("extra sauce",{"modification":"add","ingredient":"sauce"}),
    ("light mayo",{"modification":"light","ingredient":"mayo"}),
    ("extra onions",{"modification":"add","ingredient":"onions"}),
    ("add lettuce",{"modification":"add","ingredient":"lettuce"}),
    ("add tomato",{"modification":"add","ingredient":"tomato"}),
    ("without cheese",{"modification":"remove","ingredient":"cheese"}),
    ("no special sauce",{"modification":"remove","ingredient":"special sauce"}),
    ("extra special sauce",{"modification":"add","ingredient":"special sauce"}),
    ("no tartar sauce",{"modification":"remove","ingredient":"tartar sauce"}),
    ("ketchup only",{"modification":"only","ingredient":"ketchup"}),
    ("plain burger",{"modification":"plain"}),("nothing on it",{"modification":"plain"}),
    ("remove the cheese",{"modification":"remove","ingredient":"cheese"}),
    ("without the bun",{"modification":"remove","ingredient":"bun"}),
    ("no bun please",{"modification":"remove","ingredient":"bun"}),
    ("can I add an egg",{"modification":"add","ingredient":"egg"}),
    ("extra ketchup",{"modification":"add","ingredient":"ketchup"}),
    ("well done fries",{"modification":"well_done","ingredient":"fries"}),
    ("no salt on the fries",{"modification":"remove","ingredient":"salt"}),
    ("fresh fries please",{"modification":"fresh"}),
    ("spicy McCrispy",{"modification":"spicy","ingredient":"McCrispy"}),
    ("make it a deluxe",{"modification":"add","ingredient":"deluxe"}),
    ("no lettuce no tomato",{"modification":"remove","ingredient":"lettuce, tomato"}),
    ("double the meat",{"modification":"add","ingredient":"extra patty"}),
    ("can I get it without cheese",{"modification":"remove","ingredient":"cheese"}),
    ("add a tomato slice",{"modification":"add","ingredient":"tomato"}),
    ("lightly salted fries",{"modification":"light","ingredient":"salt"})]:
    ex(txt,"customize",td)

# === ORDER MODIFY (150+) ===
for txt,td in [("actually remove the McChicken",{"action":"remove","item":"McChicken"}),
    ("can you take off the fries",{"action":"remove","item":"French Fries"}),
    ("cancel the Big Mac",{"action":"remove","item":"Big Mac"}),
    ("wait, scratch that last thing",{"action":"remove_last"}),
    ("actually change that to a Quarter Pounder",{"action":"change","item":"Quarter Pounder with Cheese"}),
    ("make that two Big Macs instead of one",{"action":"change_qty","item":"Big Mac","qty":2}),
    ("add another cheeseburger",{"action":"add","item":"Cheeseburger"}),
    ("I changed my mind, no McFlurry",{"action":"remove","item":"McFlurry with OREO Cookies"}),
    ("never mind on the nuggets",{"action":"remove","item":"10-piece Chicken McNuggets"}),
    ("cancel the last item",{"action":"remove_last"}),("remove that",{"action":"remove_last"}),
    ("scratch that",{"action":"remove_last"}),("undo that",{"action":"remove_last"}),
    ("delete that last one",{"action":"remove_last"}),
    ("actually I don't want the McCrispy",{"action":"remove","item":"McCrispy"}),
    ("can I change the Coke to a Sprite",{"action":"change","item":"Sprite"}),
    ("actually make that three McDoubles",{"action":"change_qty","item":"McDouble","qty":3}),
    ("I only want one Big Mac not two",{"action":"change_qty","item":"Big Mac","qty":1}),
    ("remove everything and start over",{"action":"cancel_all"}),
    ("clear the order",{"action":"cancel_all"}),("start over",{"action":"cancel_all"}),
    ("what do I have so far",{"action":"readback"}),("can you read back my order",{"action":"readback"}),
    ("what's on my order",{"action":"readback"}),("tell me what I ordered",{"action":"readback"}),
    ("read that back to me",{"action":"readback"}),("what did I order",{"action":"readback"}),
    ("what's my order so far",{"action":"readback"}),("actually I want to change something",{"action":"readback"}),
    ("hold on let me think",{"action":"readback"}),("take the drink off",{"action":"remove","item":"drink"}),
    ("no wait take off the sundae",{"action":"remove","item":"Hot Fudge Sundae"}),
    ("let me start from scratch",{"action":"cancel_all"}),("list my order",{"action":"readback"})]:
    ex(txt,"order_modify",td)

# === MEAL SUBSTITUTION ===
for txt,td in [("can I swap the fries for apple slices",{"from":"French Fries","to":"Apple Slices"}),
    ("apple slices instead of fries",{"from":"French Fries","to":"Apple Slices"}),
    ("sub the fries for apples",{"from":"French Fries","to":"Apple Slices"}),
    ("replace fries with apple slices",{"from":"French Fries","to":"Apple Slices"}),
    ("I want apples not fries",{"from":"French Fries","to":"Apple Slices"}),
    ("no fries, apple slices",{"from":"French Fries","to":"Apple Slices"}),
    ("switch the drink to a shake",{"from":"drink","to":"shake"}),
    ("swap the Coke for a Sprite",{"from":"Coca-Cola","to":"Sprite"}),
    ("can I get onion rings instead of fries",{"from":"French Fries","to":"onion rings"}),
    ("change the fries to a side salad",{"from":"French Fries","to":"side salad"}),
    ("can I substitute the drink",{"from":"drink","to":"other"}),
    ("apples instead please",{"from":"French Fries","to":"Apple Slices"})]:
    ex(txt,"meal_substitution",td)

# === HAPPY MEAL ===
for txt,td in [("can I get a Happy Meal",{"item":"4-piece McNuggets Happy Meal","price":5.29}),
    ("a happy meal for my kid",{"item":"4-piece McNuggets Happy Meal","price":5.29}),
    ("I need a Happy Meal with nuggets",{"item":"4-piece McNuggets Happy Meal","price":5.29}),
    ("hamburger happy meal",{"item":"Hamburger Happy Meal","price":4.99}),
    ("6 piece nugget happy meal",{"item":"6-piece McNuggets Happy Meal","price":5.79}),
    ("happy meal please",{"item":"4-piece McNuggets Happy Meal","price":5.29}),
    ("kids meal",{"item":"4-piece McNuggets Happy Meal","price":5.29}),
    ("a kids meal please",{"item":"4-piece McNuggets Happy Meal","price":5.29}),
    ("Happy Meal with a hamburger",{"item":"Hamburger Happy Meal","price":4.99}),
    ("nuggets happy meal",{"item":"4-piece McNuggets Happy Meal","price":5.29}),
    ("the 4 piece happy meal",{"item":"4-piece McNuggets Happy Meal","price":5.29}),
    ("my son wants a Happy Meal",{"item":"4-piece McNuggets Happy Meal","price":5.29}),
    ("my daughter wants the nuggets Happy Meal",{"item":"6-piece McNuggets Happy Meal","price":5.79}),
    ("happy meal with the 6 piece",{"item":"6-piece McNuggets Happy Meal","price":5.79}),
    ("can I get two happy meals",{"item":"4-piece McNuggets Happy Meal","price":5.29}),
    ("one Happy Meal",{"item":"4-piece McNuggets Happy Meal","price":5.29}),
    ("throw in a Happy Meal for my kid",{"item":"4-piece McNuggets Happy Meal","price":5.29}),
    ("the hamburger Happy Meal please",{"item":"Hamburger Happy Meal","price":4.99}),
    ("nuggets happy meal and a sprite",{"item":"4-piece McNuggets Happy Meal","price":5.29}),
    ("happy meal with chocolate milk",{"item":"4-piece McNuggets Happy Meal","price":5.29})]:
    ex(txt,"happy_meal_options",td)

# === ORDER COMPLETE (100+) ===
done = ["that's it","that's all","that'll be all","nothing else","nope that's everything",
    "I'm good","we're done","yep that's it for me","that's all I need","that'll do it",
    "I'm all set","nothing more","no that's it","no that's all","nope we're good",
    "that's everything","yeah that's all","all done","I'm done","we're all set",
    "that's the whole order","nothing else thanks","that completes my order","I'm finished",
    "yep all set","that should do it","nah that's it","nope nothing else","that's all for me",
    "that's it for today","all good","yeah that's it","that's all for now","that's my order",
    "yep that's the order","I'm good thanks","nothing else for me","done","all set",
    "that'll work","yeah that's everything","just that","only that","that's all I want",
    "no I'm done","nope all good","that wraps it up"]
for p in done: ex(p,"order_complete")
# Contextual done — clean inputs
ae_ctxs = ["Anything else today?","Will that be everything?","Anything else I can get you?"]
ex("no that's all I need","order_complete",{},ae_ctxs[0])
ex("nope we're all good","order_complete",{},ae_ctxs[0])
ex("no thank you that's it","order_complete",{},ae_ctxs[1])
ex("yep that's everything for us","order_complete",{},ae_ctxs[1])
ex("no I think we're all set","order_complete",{},ae_ctxs[2])
ex("nothing else thank you so much","order_complete",{},ae_ctxs[2])
ex("no that covers it","order_complete",{},ae_ctxs[0])
ex("nah we're good thanks","order_complete",{},ae_ctxs[1])
ex("no sir that's everything","order_complete",{},ae_ctxs[2])
ex("no ma'am that'll do it","order_complete",{},ae_ctxs[0])

# === ORDER CONFIRMED (50+) ===
confirms = ["yes that's right","yep looks good","that's correct","yeah","sounds right","yes",
    "yep","that's right","looks good","perfect","all good","that sounds good","yes perfect",
    "correct","yes ma'am","yes sir","yeah that's right","exactly","yes please",
    "looks right to me","that's my order","confirmed","yup that's right","right on",
    "you got it","absolutely","bingo","sounds good to me","that's it exactly"]
for p in confirms: ex(p,"order_confirmed")
ctx_c = "OK so I have a Big Mac combo with a Coke. Your total is $8.99. Does that sound right?"
ex("yes that sounds perfect","order_confirmed",{},ctx_c)
ex("yep that's exactly right","order_confirmed",{},ctx_c)
ex("looks perfect to me","order_confirmed",{},ctx_c)
ex("that's all correct","order_confirmed",{},ctx_c)
ex("yes ma'am that's right","order_confirmed",{},ctx_c)
ex("yeah you got it","order_confirmed",{},ctx_c)
ex("perfect that's my order","order_confirmed",{},ctx_c)
ex("all correct thank you","order_confirmed",{},ctx_c)

# === PAYMENT (60+) ===
for txt,td in [("I'll pay with card",{"method":"card"}),("cash",{"method":"cash"}),
    ("can I pay with Apple Pay",{"method":"mobile"}),("I have the app",{"method":"app"}),
    ("debit please",{"method":"card"}),("do you take credit cards",{"method":"card"}),
    ("I have a coupon",{"method":"coupon"}),("card please",{"method":"card"}),
    ("credit card",{"method":"card"}),("debit card",{"method":"card"}),
    ("cash please",{"method":"cash"}),("I'll pay cash",{"method":"cash"}),
    ("Apple Pay",{"method":"mobile"}),("Google Pay",{"method":"mobile"}),
    ("tap to pay",{"method":"mobile"}),("mobile pay",{"method":"mobile"}),
    ("I'm paying with the app",{"method":"app"}),("McDonald's app",{"method":"app"}),
    ("with card",{"method":"card"}),("visa",{"method":"card"}),
    ("I have exact change",{"method":"cash"}),("contactless",{"method":"mobile"}),
    ("I'll tap",{"method":"mobile"}),("here's my card",{"method":"card"})]:
    ex(txt,"payment",td)

# === PRICE INQUIRY (80+) ===
price_tmpls = ["how much is the {0}","what does a {0} cost","how much for a {0}",
    "what's the price of the {0}","how much is a {0}","what's a {0} cost","price on the {0}"]
for n,p,m in [(x[0],x[1],x[2]) for x in BURGERS+CHICKEN[:6]+BREAKFAST[:4]]:
    td = {"item":n,"price":p}
    if m: td["meal_price"] = m
    for t in price_tmpls: ex(t.format(n),"price_inquiry",td)
for txt in ["what's my total","how much is that so far","what's the total","how much do I owe",
    "what's the damage","what am I at","total please","how much is everything"]:
    ex(txt,"price_inquiry",{"query":"order_total"})

# === MENU INQUIRY (80+) ===
for txt,td in [("what do you have",{}),("what's on the menu",{}),
    ("what burgers do you have",{"category":"burgers"}),
    ("what kind of chicken sandwiches do you have",{"category":"chicken"}),
    ("what's on the breakfast menu",{"category":"breakfast"}),
    ("what desserts do you have",{"category":"desserts"}),
    ("what drinks do you have",{"category":"drinks"}),("what's good here",{}),
    ("what comes in the meal",{"category":"meals"}),("do you have milkshakes",{"category":"drinks"}),
    ("what sauces do you have",{"category":"sauces"}),("any specials today",{}),
    ("what's on the dollar menu",{"category":"value_menu"}),
    ("do you still have the McRib",{"item":"McRib"}),
    ("tell me about the Big Mac",{"item":"Big Mac"}),("what's in a Big Mac",{"item":"Big Mac"}),
    ("do you have salads",{"category":"salads"}),("what's on the value menu",{"category":"value_menu"}),
    ("do you serve breakfast all day",{"category":"breakfast"}),
    ("what McCafe drinks do you have",{"category":"mccafe"}),
    ("what are your combo options",{"category":"combos"}),("what's new on the menu",{}),
    ("any limited time items",{}),("what are your sides",{"category":"sides"}),
    ("what Happy Meals do you have",{"category":"happy_meal"}),
    ("do you have a kids menu",{"category":"happy_meal"}),
    ("what flavors of McFlurry",{"category":"desserts"}),
    ("can you tell me about the McCrispy",{"item":"McCrispy"}),
    ("what comes on the Quarter Pounder",{"item":"Quarter Pounder with Cheese"}),
    ("what are the nugget sizes",{"item":"Chicken McNuggets"}),
    ("do you have fish",{"item":"Filet-O-Fish"}),("do you have anything spicy",{"category":"chicken"}),
    ("can you repeat that",{}),("what did you say",{}),("say that again",{}),
    ("I didn't catch that",{}),("come again",{})]:
    ex(txt,"menu_inquiry",td)

# === NUTRITION / ALLERGEN / DIETARY ===
for txt,td in [("how many calories in a Big Mac",{"item":"Big Mac"}),
    ("what's the healthiest thing you have",{}),
    ("how much protein in the nuggets",{"item":"10-piece Chicken McNuggets"}),
    ("how many calories is the Quarter Pounder",{"item":"Quarter Pounder with Cheese"}),
    ("calorie count on the McCrispy",{"item":"McCrispy"}),
    ("nutritional info for the Big Mac",{"item":"Big Mac"}),
    ("how many calories in a Happy Meal",{"item":"Happy Meal"}),
    ("what's the lowest calorie sandwich",{}),
    ("how much sugar in the McFlurry",{"item":"McFlurry with OREO Cookies"}),
    ("is the McChicken healthy",{"item":"McChicken"})]:
    ex(txt,"nutrition_inquiry",td)

for txt,td in [("does the Big Mac have gluten",{"item":"Big Mac","allergen":"gluten"}),
    ("is there dairy in the McFlurry",{"item":"McFlurry","allergen":"dairy"}),
    ("are the fries gluten free",{"item":"French Fries","allergen":"gluten"}),
    ("does the fish have wheat",{"item":"Filet-O-Fish","allergen":"wheat"}),
    ("is there soy in the nuggets",{"item":"10-piece Chicken McNuggets","allergen":"soy"}),
    ("does the bun have sesame",{"item":"Big Mac","allergen":"sesame"}),
    ("is the McCrispy dairy free",{"item":"McCrispy","allergen":"dairy"}),
    ("what contains peanuts",{"allergen":"peanuts"}),
    ("is the apple pie gluten free",{"item":"Baked Apple Pie","allergen":"gluten"}),
    ("what's safe for a nut allergy",{"allergen":"nuts"})]:
    ex(txt,"allergen_inquiry",td)

for txt,td in [("my kid has a nut allergy",{"allergen":"nuts"}),
    ("I have a peanut allergy",{"allergen":"peanuts"}),
    ("I'm allergic to shellfish",{"allergen":"shellfish"}),
    ("I'm lactose intolerant",{"allergen":"dairy"}),
    ("I have a gluten allergy",{"allergen":"gluten"}),
    ("I can't have dairy",{"allergen":"dairy"}),
    ("I have celiac disease",{"allergen":"gluten"}),
    ("my son is allergic to eggs",{"allergen":"eggs"}),
    ("I have a soy allergy",{"allergen":"soy"}),
    ("wheat allergy",{"allergen":"wheat"}),
    ("I'm allergic to fish",{"allergen":"fish"}),
    ("no sesame for me",{"allergen":"sesame"}),
    ("severe peanut allergy",{"allergen":"peanuts"})]:
    ex(txt,"allergen_alert",td)

for txt,td in [("do you have anything gluten free",{"diet":"gluten-free"}),
    ("what's vegetarian on the menu",{"diet":"vegetarian"}),
    ("do you have vegan options",{"diet":"vegan"}),
    ("what's low calorie",{"diet":"low-calorie"}),
    ("any keto options",{"diet":"keto"}),
    ("what can I get that's dairy free",{"diet":"dairy-free"}),
    ("I'm on a low carb diet",{"diet":"low-carb"}),
    ("what's the healthiest option",{"diet":"healthy"}),
    ("I need something high protein",{"diet":"high-protein"}),
    ("anything without bread",{"diet":"gluten-free"}),
    ("low sodium options",{"diet":"low-sodium"})]:
    ex(txt,"dietary_inquiry",td)

# === RECOMMEND / VALUE ===
for txt,td in [("what do you recommend",{}),("what's popular",{}),("what should I get",{}),
    ("what's the best burger",{"category":"burgers"}),("what's good for kids",{"category":"kids"}),
    ("I can't decide",{}),("what's your best seller",{}),("what would you get",{}),
    ("help me choose",{}),("any suggestions",{}),("surprise me",{}),
    ("what's the best chicken sandwich",{"category":"chicken"}),
    ("recommend a dessert",{"category":"desserts"}),("something filling",{}),("something quick",{})]:
    ex(txt,"recommend",td)

for txt in ["what's the best deal","what's cheap and good","what's on special","I'm on a budget",
    "what's the cheapest thing","best bang for my buck","dollar menu items",
    "cheapest meal","under 5 dollars","what can I get for 3 bucks","best value meal"]:
    ex(txt,"value_recommendation")

# === ADD-ON SUGGESTION ===
for txt,td in [("sure throw in a cookie",{"item":"Chocolate Chip Cookie","price":1.29}),
    ("yeah add an apple pie",{"item":"Baked Apple Pie","price":1.69}),
    ("why not, add a sundae too",{"item":"Hot Fudge Sundae","price":2.89}),
    ("sure I'll take a drink too",{}),
    ("yeah add a McFlurry",{"item":"McFlurry with OREO Cookies","price":4.89}),
    ("oh and a vanilla cone",{"item":"Vanilla Cone","price":1.89}),
    ("sure add a pie",{"item":"Baked Apple Pie","price":1.69}),
    ("add on a 4 piece nuggets",{"item":"4-piece Chicken McNuggets","price":2.49}),
    ("might as well add a cone",{"item":"Vanilla Cone","price":1.89}),
    ("yeah get me a cookie too",{"item":"Chocolate Chip Cookie","price":1.29})]:
    ex(txt,"add_on_suggestion",td)

# === COMPLAINT ===
for txt,td in [("my order is wrong",{"type":"wrong_order"}),
    ("this isn't what I ordered",{"type":"wrong_order"}),
    ("my food is cold",{"type":"cold_food"}),("there's hair in my food",{"type":"foreign_object"}),
    ("I've been waiting 20 minutes",{"type":"long_wait"}),
    ("the drive through is too slow",{"type":"long_wait"}),
    ("I'm missing items in my bag",{"type":"missing_items"}),
    ("you forgot my sauce",{"type":"missing_items"}),
    ("this burger is raw",{"type":"quality"}),("can I speak to a manager",{"type":"escalation"}),
    ("I want a refund",{"type":"refund"}),("the fries are stale",{"type":"quality"}),
    ("my drink is wrong",{"type":"wrong_order"}),("there's no cheese on this",{"type":"wrong_order"}),
    ("I got the wrong burger",{"type":"wrong_order"}),("my nuggets are cold",{"type":"cold_food"}),
    ("I asked for no pickles",{"type":"wrong_order"}),("where's my fries",{"type":"missing_items"}),
    ("you gave me the wrong drink",{"type":"wrong_order"}),("this is taking forever",{"type":"long_wait"})]:
    ex(txt,"complaint",td)

# === MACHINE DOWN ===
for txt,td in [("is the ice cream machine working",{"item":"ice cream"}),
    ("can I get a shake",{"item":"shake"}),("is the McFlurry machine down again",{"item":"McFlurry"}),
    ("I want a vanilla shake",{"item":"shake"}),("chocolate shake please",{"item":"shake"}),
    ("is the shake machine working",{"item":"shake"}),("do you have ice cream",{"item":"ice cream"}),
    ("can I get a milkshake",{"item":"shake"}),("are milkshakes available",{"item":"shake"}),
    ("strawberry shake",{"item":"shake"})]:
    ex(txt,"machine_down",td)

# === TIME CHECK ===
for txt,td in [("how long is the wait",{"query":"wait_time"}),
    ("how long will my order take",{"query":"wait_time"}),
    ("is it gonna be a long wait",{"query":"wait_time"}),
    ("are you still serving breakfast",{"query":"breakfast_hours"}),
    ("what time do you close",{"query":"hours"}),
    ("when does breakfast end",{"query":"breakfast_hours"}),
    ("how late are you open",{"query":"hours"}),
    ("what are your hours",{"query":"hours"}),
    ("is breakfast still available",{"query":"breakfast_hours"}),
    ("did I miss breakfast",{"query":"breakfast_hours"}),
    ("how much longer for my food",{"query":"wait_time"}),
    ("when does lunch start",{"query":"hours"}),
    ("are you open 24 hours",{"query":"hours"})]:
    ex(txt,"time_check",td)

# === DISAMBIGUATION EXAMPLES ===
# These target the top confusion patterns identified by evaluation.

# --- size_selection (NOT drink_selection) ---
for txt in ["make the fries and drink large","I want the large size","large size please",
    "medium size is fine","can I get that supersized","go with the large option",
    "upsize my meal","I'll take the bigger size","regular size is good",
    "small size for me","make everything the large size","can you upsize that",
    "the large option please","I want it large sized","medium sized please",
    "give me the small size","biggest size you have","make my combo large",
    "large meal please","supersize my order","upsize the meal",
    "I want large fries and a large drink","make the whole thing large"]:
    ex(txt,"size_selection",{"size":"large"})

# --- menu_inquiry (NOT price_inquiry) ---
for txt in ["what items do you have","what's available right now","what's on your menu today",
    "can you tell me what you serve","what kinds of burgers are there",
    "do you have any chicken options","what sandwiches do you make",
    "list your menu items","what food do you have","what's available",
    "what options do you have for lunch","tell me about your menu",
    "what all do you serve","describe your chicken sandwiches",
    "what kind of meals do you offer","what are the choices",
    "I want to know what you have","what food options are there",
    "what's on the board","read me the menu","what items are available",
    "do you have breakfast items","what can I choose from"]:
    ex(txt,"menu_inquiry",{})

# --- order_confirmed (NOT order_complete) — confirming a readback ---
for txt in ["yes that order is correct","yep you read that right",
    "that's exactly what I want","the order is right","you got my order right",
    "that readback is correct","yes the order sounds right",
    "yep that matches what I ordered","correct order","that's the right order",
    "yes you have it right","the total sounds right","that order is perfect",
    "yes everything on there is right","you got it all right",
    "that's what I wanted","the order looks good","yep nailed it"]:
    ex(txt,"order_confirmed",{})

# --- order_complete (NOT order_confirmed) — done ordering ---
for txt in ["I don't want anything else","no more food","I'm done ordering",
    "that's all the food I want","stop taking my order","nothing more to add",
    "I'm not ordering anything else","no additional items","my order is complete",
    "I've ordered everything I want","I don't need anything else",
    "we don't need anything more","that's the end of my order",
    "please close my order","ring that up","ring me up",
    "that's our whole order","we're finished ordering","go ahead and ring that up"]:
    ex(txt,"order_complete",{})

# --- meal_upgrade (NOT take_order) — upgrade existing item ---
for txt in ["upgrade that to a meal","turn that into a combo","make my order a meal",
    "can you convert that to a combo","I'll add fries and drink to that",
    "yeah turn it into a meal deal","combo that up","meal-ify that",
    "add the combo to that","yeah make that a full meal","combo upgrade please",
    "I want to upgrade to the meal version","can I get the meal instead",
    "add fries and a drink to make it a combo","yes the meal deal",
    "I'll take the combo version","meal deal please","upgrade to combo"]:
    ex(txt,"meal_upgrade",{"item":"Big Mac","meal_price":8.99})

# --- customize (NOT take_order) — modifying an existing item ---
for txt in ["take off the pickles","remove the onions from that",
    "I don't want any lettuce on it","hold the mayo on my burger",
    "put extra cheese on that","can you add bacon to my sandwich",
    "I want that without tomatoes","take the pickles off my burger",
    "make my burger plain","I need that customized","modify my sandwich",
    "change the toppings on my burger","no condiments on that",
    "put the sauce on the side","I want my fries with no salt",
    "add extra sauce to my order","no pickles on the Big Mac",
    "hold the special sauce","remove cheese from my Quarter Pounder",
    "extra pickles on my McDouble","no onions on my McChicken"]:
    ex(txt,"customize",{"modification":"custom"})

# --- order_modify (NOT take_order) — changing/removing items ---
for txt in ["take that off my order","remove the last thing I said",
    "I want to change something on my order","cancel that item",
    "delete the McChicken from my order","I need to modify my order",
    "remove one of the Big Macs","change my order please",
    "get rid of the fries I ordered","swap out the last item",
    "I don't want that anymore","take back the nuggets",
    "can you undo my last item","go back on that last thing",
    "erase the cheeseburger from my order","drop the sundae"]:
    ex(txt,"order_modify",{"action":"modify"})

# --- nutrition_inquiry (NOT price_inquiry) — health/nutrition focused ---
for txt in ["what's the calorie count on that","how healthy is the Big Mac",
    "what are the nutrition facts","is that high in calories",
    "how much fat is in the fries","what's the sodium content",
    "is there a lot of sugar in that","how many grams of protein",
    "what's the carb count","is the McChicken nutritious",
    "how fattening is the Quarter Pounder","give me the nutrition info",
    "what's the calorie breakdown","how unhealthy is that"]:
    ex(txt,"nutrition_inquiry",{})

# --- recommend (NOT price_inquiry) — asking for suggestions ---
for txt in ["what's your recommendation","suggest something for me",
    "what's the most popular thing here","what do people usually get",
    "I need a suggestion","recommend something good",
    "what's tasty here","what's your favorite item",
    "what should I try","pick something for me",
    "what's the go-to order","what do you suggest I get"]:
    ex(txt,"recommend",{})

# --- time_check (NOT price_inquiry) — asking about time/hours ---
for txt in ["what time is it","when do you stop serving food",
    "how long until my food is ready","when does the restaurant close",
    "what are your operating hours","is breakfast over yet",
    "how many minutes for my order","when do you start lunch",
    "what time does breakfast start","how long is the drive thru wait",
    "estimated wait time","when is breakfast cutoff"]:
    ex(txt,"time_check",{"query":"hours"})

# --- allergen_inquiry (NOT price_inquiry) — allergen focused ---
for txt in ["does that contain any allergens","what allergens are in that",
    "is that safe for someone with allergies","any common allergens in the nuggets",
    "does the bun contain allergens","what's the allergen info",
    "is that made with peanut oil","does this have any nuts in it",
    "allergen information please","what allergens should I know about",
    "is the McCrispy safe for allergies","any dairy in the fries"]:
    ex(txt,"allergen_inquiry",{})

# === WRITE OUTPUT ===
with open(OUT, 'w') as f:
    for e in examples:
        f.write(json.dumps(e) + '\n')

behaviors = Counter(e['behavior'] for e in examples)
items = set()
for e in examples:
    if 'item' in e['target_data'] and e['target_data']['item']:
        items.add(e['target_data']['item'])

print(f"Generated {len(examples)} training examples")
print(f"Behaviors: {len(behaviors)}")
for b, c in behaviors.most_common():
    print(f"  {b}: {c}")
print(f"\nUnique items: {len(items)}")
print(f"Output: {OUT}")
