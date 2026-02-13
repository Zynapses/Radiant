#!/usr/bin/env python3
"""Generate supplementary training data to balance the dataset."""
import json, random, itertools
from pathlib import Path

OUTPUT = Path(__file__).parent / "gemini-generated-output.jsonl"
random.seed(42)

def ex(inp, beh, td=None, ctx=None):
    return {"input": inp, "behavior": beh, "target_action": beh,
            "target_data": td or {}, "expected_response_contains": [], "context": ctx}

def vary(templates, fills, n):
    """Generate n unique examples from templates x fills."""
    results = []
    combos = list(itertools.product(templates, fills))
    random.shuffle(combos)
    for t, f in combos[:n]:
        results.append(t.format(**f) if isinstance(f, dict) else t.format(f))
    return results

ALL = []

# === GREET (+40) ===
for s in ["what's good","wassup","hey hey","howdy","hi how are ya","yo can I order",
"sup","hey um yeah I want to order","hi there good evening","good afternoon",
"how's it going","yeah hi I'd like to order please","hi is this the drive thru",
"hello can you hear me","yo anyone there","hi I'm ready","uh yeah hi",
"hey uh can I order","hi I'd like to place an order","good morning I'd like to order",
"hey there how you doing","yeah um hello","ayo","greetings","evening",
"hi can I get some food please","sup can I order real quick","yeah hi what's up",
"hey real quick can I order","hello hello","hiya","hi um yeah","can I order",
"yo lemme order","yes hi good morning","hey um can I get some stuff","afternoon",
"good night can I order","hi yes I want to order","hey yo"]:
    ALL.append(ex(s, "greet"))

# === MEAL_UPGRADE (+90) ===
COMBOS = [("Big Mac",5.69,8.99),("Quarter Pounder with Cheese",5.99,9.29),
("Double Quarter Pounder with Cheese",7.49,10.79),("McDouble",2.79,5.99),
("Double Cheeseburger",3.39,6.59),("Hamburger",1.89,5.09),
("Cheeseburger",2.29,5.49),("McCrispy",5.49,8.79),
("Filet-O-Fish",4.79,7.99),("10-piece Chicken McNuggets",5.29,8.49),
("6-piece Chicken McNuggets",3.69,6.89)]

for p in ["make it a combo","combo that please","yeah make it a meal",
"upgrade to the combo","turn that into a meal","add fries and a drink",
"I'll take the meal version","yeah the combo","combo please","make it the meal",
"let's do the combo","meal deal please","go ahead and combo it",
"I want the meal","can you make that a combo","upgrade it","meal-ify that",
"just do the combo"]:
    i,sp,mp = random.choice(COMBOS)
    ALL.append(ex(p, "meal_upgrade", {"item": i, "meal_price": mp}))

for i,sp,mp in COMBOS:
    ctx = f"That {i} is ${sp:.2f}. Want to make it a combo for ${mp:.2f}?"
    for v in random.sample(["yes","yeah","sure","why not","yeah do it","go ahead",
    "yes please","absolutely","sure thing","yeah let's do that","yep","definitely",
    "ok yes","mmhmm","yeah sure"], 6):
        ALL.append(ex(v, "meal_upgrade", {"item": i, "meal_price": mp}, ctx))

# === CUSTOMIZE (+120) ===
C_ITEMS = ["Big Mac","Quarter Pounder","McDouble","cheeseburger","McCrispy",
"Filet-O-Fish","McChicken","hamburger","Double Quarter Pounder"]
INGS = ["pickles","onions","lettuce","tomato","cheese","mayo","ketchup",
"mustard","special sauce","bacon","jalapeños","salt"]

for _ in range(50):
    it,ing = random.choice(C_ITEMS), random.choice(INGS)
    t = random.choice(["no {i} on my {it}","hold the {i}","remove the {i}",
    "without {i}","{it} no {i}","can I get the {it} without {i}","leave off the {i}",
    "no {i} please","I don't want {i} on that","{it} minus the {i}","skip the {i}",
    "take off the {i}"])
    ALL.append(ex(t.format(i=ing, it=it), "customize", {"modification":"remove","ingredient":ing}))

for _ in range(40):
    it,ing = random.choice(C_ITEMS), random.choice(INGS)
    t = random.choice(["extra {i} please","add {i} to my {it}","can I get extra {i}",
    "double the {i}","extra {i} on that","I want more {i}","add some {i}",
    "throw some {i} on there","put extra {i} on the {it}","load up on {i}"])
    ALL.append(ex(t.format(i=ing, it=it), "customize", {"modification":"add","ingredient":ing}))

for _ in range(20):
    it = random.choice(C_ITEMS)
    t = random.choice(["I want it plain","plain please","nothing on it",
    "just meat and cheese","plain {it}","{it} plain","nothing but the patty and bun",
    "I want the {it} with nothing on it","just the basics","no toppings at all",
    "completely plain","hold everything"])
    ALL.append(ex(t.format(it=it), "customize", {"modification":"plain","ingredient":"all"}))

for _ in range(10):
    a,b = random.sample(INGS, 2)
    ALL.append(ex(f"no {a} no {b}", "customize", {"modification":"remove","ingredient":f"{a}, {b}"}))

# === ORDER_MODIFY (+130) ===
MOD_ITEMS = ["Big Mac","McDouble","cheeseburger","nuggets","fries",
"Quarter Pounder","McCrispy","McChicken","Filet-O-Fish","Coke","the drink"]

for _ in range(30):
    it = random.choice(MOD_ITEMS)
    t = random.choice(["actually cancel the {i}","take the {i} off",
    "remove the {i} from my order","I don't want the {i} anymore",
    "get rid of the {i}","scratch the {i}","never mind the {i}",
    "forget the {i}","drop the {i}","I changed my mind on the {i}"])
    ALL.append(ex(t.format(i=it), "order_modify", {"action":"remove","item":it}))

for s in ["scratch that last item","take that back","undo that","wait never mind",
"hold on scratch that","take that off","go back","undo the last one",
"cancel that last one","wait no take that off","nah remove that",
"scratch what I just said","actually no","hold on let me change that",
"wait go back","oops cancel that","no wait undo that","actually forget that",
"can you undo that","take back what I just said"]:
    ALL.append(ex(s, "order_modify", {"action":"remove_last"}))

for s in ["change the McDouble to a Big Mac","swap the cheeseburger for a Quarter Pounder",
"actually make that a McCrispy instead","change my burger to a Big Mac",
"I want a McDouble instead of the cheeseburger","switch the nuggets to a McCrispy",
"can you change the McChicken to a McCrispy","instead of the fish give me a Big Mac"]:
    ALL.append(ex(s, "order_modify", {"action":"change"}))

for s in ["actually make that two Big Macs","I want three of those",
"change it to two cheeseburgers","give me two of those instead",
"actually make it three","bump that to two","double that order",
"I want two of each","change the quantity to three","I need two of those"]:
    ALL.append(ex(s, "order_modify", {"action":"change_qty","qty":2}))

for s in ["what do I have so far","can you read that back","what's on my order",
"read me my order","tell me what I ordered","what's my order look like",
"repeat my order","what do I have","run it back for me",
"let me hear the whole order","what have I ordered so far","list my order"]:
    ALL.append(ex(s, "order_modify", {"action":"readback"}))

for s in ["cancel everything","cancel the whole order","start over",
"I want to start from scratch","clear the whole thing","delete everything",
"wipe it all","forget all of it","I changed my mind about everything",
"let's start over completely"]:
    ALL.append(ex(s, "order_modify", {"action":"cancel_all"}))

# === SAUCE_SELECTION (+90) ===
SAUCES = ["BBQ","Sweet & Sour","Honey Mustard","Hot Mustard","Ranch","Tangy BBQ","Spicy Buffalo"]
for s in SAUCES:
    for t in ["{} sauce please","can I get {}","I'll take {}","give me {}",
    "{} please","yeah {}","the {} sauce","I want {} sauce","um {}","just {}"]:
        ALL.append(ex(t.format(s), "sauce_selection", {"sauce": s}))
    for ctx in ["Any sauce with your nuggets?","What sauce would you like?","Which sauce?"]:
        for v in [s.lower(), f"{s.lower()} please"]:
            ALL.append(ex(v, "sauce_selection", {"sauce": s}, ctx))

for s in ["BBQ and ranch","honey mustard and sweet and sour","two BBQ sauces",
"one of each","BBQ and hot mustard","ranch and spicy buffalo",
"sweet and sour and BBQ","all the sauces","surprise me with a sauce"]:
    ALL.append(ex(s, "sauce_selection", {"sauce": "multiple"}))

# === SIZE_SELECTION (+60) ===
for sz in ["small","medium","large"]:
    for t in ["{} please","make it {}","the {} one","I'll go {}","just {}",
    "yeah {}","go with {}","um {}"]:
        ALL.append(ex(t.format(sz), "size_selection", {"size": sz}))
    for ctx in ["What size would you like?","Small, medium, or large?",
    "What size for your combo?"]:
        for v in [sz, f"{sz} please", f"the {sz}"]:
            ALL.append(ex(v, "size_selection", {"size": sz}, ctx))

for s in ["the biggest size","supersize it","large everything","upsize to large",
"regular size","biggest you got","whatever the default is","normal size"]:
    sz = "large" if "big" in s or "super" in s or "upsize" in s else "medium"
    ALL.append(ex(s, "size_selection", {"size": sz}))

# === ORDER_COMPLETE (+100) ===
for s in ["that's all I want","I'm done ordering","nothing else thanks",
"that's everything","no that's it","we're all set","ring me up",
"ring that up","go ahead and total it","that completes my order",
"I think we're good","that should do it","no more items","I'm finished",
"yeah that's it","I'm all set","that'll do it","that's my order",
"no nothing else","we're done","yep that's all","I'm good with that",
"just that","only that","that'll be all","all done","wrap it up",
"yeah we're good","I think that's everything","nope that's it"]:
    ALL.append(ex(s, "order_complete"))

for ctx in ["Anything else today?","Anything else I can get you?",
"What else can I get you?","Would you like anything else?","Is that everything?"]:
    for v in ["no","nope","no thanks","that's it","I'm good","nah we're good",
    "no that's everything","nothing else","all set","no thank you",
    "that's all","we're done","nah","nope that's it","no I'm good"]:
        ALL.append(ex(v, "order_complete", {}, ctx))

# === ORDER_CONFIRMED (+50) ===
readbacks = [
    "OK so I have a Big Mac combo with a Coke. Your total is $8.99. Does that sound right?",
    "That's one Quarter Pounder meal with a Sprite. $9.29 total. Is that correct?",
    "So two Big Macs and a 10-piece McNuggets. Total is $16.67. Sound good?",
    "I have a McCrispy combo and a McDouble. $11.58 total. Is that right?",
    "Your order is a 6-piece nuggets meal with a Fanta. $6.89. Correct?",
]
confirms = ["yes","yep","that's correct","looks good","perfect","you got it",
"that's right","sounds right","yes that's my order","yep you nailed it",
"correct","yeah that's it","sounds good","absolutely","that is correct"]
for ctx in readbacks:
    for v in random.sample(confirms, 10):
        ALL.append(ex(v, "order_confirmed", {}, ctx))

# === PAYMENT (+80) ===
for s in ["I'll pay with card","cash please","Apple Pay","I have a coupon",
"debit card","credit card please","I'll use my app","mobile pay","Google Pay",
"tap to pay","Visa","I'll swipe","chip please","contactless","cash money",
"do you take Apple Pay","Samsung Pay","pay with my phone","here's my card",
"I got cash","paying cash","card please","just card","credit"]:
    method = "card" if any(w in s.lower() for w in ["card","visa","swipe","chip","credit","debit","contactless"]) \
        else "cash" if "cash" in s.lower() \
        else "mobile" if any(w in s.lower() for w in ["apple","google","samsung","phone","tap","mobile"]) \
        else "app" if "app" in s.lower() \
        else "coupon" if "coupon" in s.lower() else "card"
    ALL.append(ex(s, "payment", {"method": method}))

for ctx in ["Will that be cash, card, or mobile pay?","How would you like to pay?",
"Cash or card?","What's your payment method?"]:
    for v,m in [("card","card"),("cash","cash"),("Apple Pay","mobile"),("the app","app"),
    ("I have a coupon","coupon"),("credit","card"),("debit","card"),("Google Pay","mobile"),
    ("tap","mobile"),("mobile","mobile"),("cash money","cash"),("Visa","card")]:
        ALL.append(ex(v, "payment", {"method": m}, ctx))

# === HAPPY_MEAL_OPTIONS (+85) ===
HM = [("Hamburger Happy Meal",4.99),("4-piece McNuggets Happy Meal",5.29),
("6-piece McNuggets Happy Meal",5.79)]
hm_templates = ["a Happy Meal please","can I get a Happy Meal with {t}",
"my kid wants a Happy Meal","one {n}","nugget Happy Meal for my son",
"two Happy Meals","the kids meal","Happy Meal with {t}",
"my daughter wants the {t} Happy Meal","a {n} please",
"get me a Happy Meal","kids meal with nuggets","Happy Meal with 4 piece nuggets",
"the hamburger Happy Meal","six piece nugget Happy Meal",
"um one Happy Meal","yeah a kids meal","my little one wants a Happy Meal",
"can we add a Happy Meal","one more Happy Meal with nuggets",
"Happy Meal no onions","nuggets Happy Meal","burger Happy Meal",
"I need a Happy Meal for my kid","the nugget one for kids",
"four piece Happy Meal","six piece Happy Meal","hamburger kids meal",
"chicken nuggets Happy Meal","my son wants the burger one"]
for t in hm_templates:
    if "nugget" in t.lower() or "chicken" in t.lower():
        nm,pr = random.choice(HM[1:])
    elif "burger" in t.lower() or "hamburger" in t.lower():
        nm,pr = HM[0]
    else:
        nm,pr = random.choice(HM)
    ALL.append(ex(t.format(t="nuggets",n=nm), "happy_meal_options", {"item":nm,"price":pr}))

for ctx in ["What kind of Happy Meal?","Hamburger or nuggets Happy Meal?"]:
    for v in ["nuggets","hamburger","the nugget one","burger please",
    "4 piece nuggets","6 piece","hamburger please","nuggets please"]:
        nm,pr = (HM[0] if "burger" in v or "hamburger" in v else random.choice(HM[1:]))
        ALL.append(ex(v, "happy_meal_options", {"item":nm,"price":pr}, ctx))

# === MENU_INQUIRY (+50) ===
for s,td in [("what do you have",{}),("what burgers do you have",{"category":"burgers"}),
("what's on the breakfast menu",{"category":"breakfast"}),
("what chicken sandwiches do you make",{"category":"chicken"}),
("what drinks do you have",{"category":"drinks"}),
("do you have salads",{"category":"salads"}),
("what desserts are there",{"category":"desserts"}),
("what's on the dollar menu",{"category":"value_menu"}),
("tell me about the Big Mac",{"item":"Big Mac"}),
("what comes on the Quarter Pounder",{"item":"Quarter Pounder with Cheese"}),
("what are your sides",{"category":"sides"}),
("can you repeat that",{}),("what did you say",{}),
("what's on your menu",{}),("what are the options",{}),
("do you have wraps",{"category":"wraps"}),
("what do you serve for breakfast",{"category":"breakfast"}),
("what kind of nuggets do you have",{"category":"chicken"}),
("what types of coffee do you have",{"category":"drinks"}),
("any new items",{}),("what specials do you have",{}),
("do you still have the McRib",{"item":"McRib"}),
("what comes in the combo",{}),("what's in a Big Mac",{"item":"Big Mac"}),
("do you have fish",{"category":"fish"}),
("what's the difference between McDouble and Double Cheeseburger",{}),
("tell me about your chicken options",{"category":"chicken"}),
("what McCafe drinks do you have",{"category":"mccafe"}),
("what comes with the meal",{}),("any breakfast items left",{"category":"breakfast"}),
("do you guys have mozzarella sticks",{"item":"mozzarella sticks"}),
("what sauces do you have",{"category":"sauces"}),
("is the McRib back",{"item":"McRib"}),
("what's the spiciest thing you have",{}),
("do you have shakes",{"category":"shakes"}),
("what happy meal toys do you have",{"category":"happy_meal"}),
("what kind of fries do you have",{"category":"sides"}),
("any limited time items",{}),("what's new on the menu",{}),
("do you have breakfast sandwiches",{"category":"breakfast"}),
("what's on a McCrispy",{"item":"McCrispy"})]:
    ALL.append(ex(s, "menu_inquiry", td))

# === PRICE_INQUIRY (+30 — already at 127) ===
PRICES = {"Big Mac":5.69,"Quarter Pounder with Cheese":5.99,"McDouble":2.79,
"McCrispy":5.49,"Filet-O-Fish":4.79,"10-piece Chicken McNuggets":5.29,
"McChicken":1.89,"Egg McMuffin":4.49,"Cheeseburger":2.29}
for item,price in PRICES.items():
    for t in [f"how much is a {item}",f"what does the {item} cost",f"price on {item}"]:
        ALL.append(ex(t, "price_inquiry", {"item":item,"price":price}))
for s in ["what's my total","how much is that so far","what's the damage",
"total it up","how much do I owe","what's the grand total"]:
    ALL.append(ex(s, "price_inquiry", {"query":"order_total"}))

# === NUTRITION_INQUIRY (+30) ===
for item in ["Big Mac","Quarter Pounder","McNuggets","McCrispy","McChicken",
"Filet-O-Fish","McDouble","fries","Egg McMuffin","cheeseburger"]:
    for t in [f"how many calories in the {item}",f"nutrition info for {item}",
    f"is the {item} healthy"]:
        ALL.append(ex(t, "nutrition_inquiry", {"item":item}))

# === ALLERGEN_INQUIRY (+50) ===
ALLERGENS = ["gluten","dairy","peanuts","nuts","soy","sesame","eggs","wheat","shellfish"]
for item in ["Big Mac","McNuggets","McCrispy","McFlurry","fries","Filet-O-Fish","bun","McChicken"]:
    for alg in random.sample(ALLERGENS, 3):
        t = random.choice([f"does the {item} have {alg}",f"is the {item} {alg} free",
        f"any {alg} in the {item}",f"is there {alg} in the {item}"])
        ALL.append(ex(t, "allergen_inquiry", {"item":item,"allergen":alg}))

# === ALLERGEN_ALERT (+40) ===
for alg in ALLERGENS:
    for t in [f"I have a {alg} allergy",f"I'm allergic to {alg}",
    f"my kid has a {alg} allergy",f"I can't have {alg}",f"severe {alg} allergy"]:
        ALL.append(ex(t, "allergen_alert", {"allergen":alg}))

# === DIETARY_INQUIRY (+45) ===
DIETS = ["gluten-free","vegetarian","vegan","keto","low-calorie","low-carb","dairy-free","halal","kosher"]
for d in DIETS:
    for t in [f"do you have anything {d}",f"what's {d} on the menu",
    f"any {d} options",f"I need something {d}",f"what can I eat if I'm {d}"]:
        ALL.append(ex(t, "dietary_inquiry", {"diet":d}))

# === RECOMMEND (+45) ===
for s,td in [("what do you recommend",{}),("what's popular",{}),
("what should I get",{}),("what's the best burger",{"category":"burgers"}),
("I can't decide",{}),("suggest something",{}),("what's your favorite",{}),
("what's good for kids",{"category":"kids"}),
("recommend a dessert",{"category":"desserts"}),
("what's the best chicken sandwich",{"category":"chicken"}),
("what's the most popular item",{}),("best thing on the menu",{}),
("what's good here",{}),("any suggestions",{}),
("what do most people order",{}),("what's trending",{}),
("if you had to pick one thing",{}),
("what should I try if it's my first time",{}),
("best bang for my buck",{"category":"value"}),
("recommend something filling",{}),("what's the best combo",{}),
("I'm feeling adventurous suggest something",{}),
("pick something for me",{}),("what's the fan favorite",{}),
("best breakfast item",{"category":"breakfast"}),
("recommend something spicy",{"category":"spicy"}),
("what's good and not too heavy",{}),("choose for me",{}),
("what's the signature item",{}),("what do you like best",{}),
("hit me with your best",{}),("what's fire here",{}),
("best meal deal",{}),("top seller",{}),
("what should I feed my kids",{"category":"kids"}),
("what's the most filling",{}),("best late night option",{}),
("surprise me",{}),("dealer's choice",{}),
("what would you order",{}),("best value meal",{}),
("something quick and good",{}),("what's the go-to order",{}),
("most popular breakfast",{"category":"breakfast"}),
("recommend something sweet",{"category":"desserts"})]:
    ALL.append(ex(s, "recommend", td))

# === VALUE_RECOMMENDATION (+60) ===
for s in ["what's the best deal","what's cheap and good","I'm on a budget",
"what's the cheapest thing","dollar menu items","under 5 dollars",
"best bang for my buck","cheapest meal","any deals going on",
"what's on sale","coupons available","what's the value menu",
"cheapest burger","affordable options","I don't have much money",
"something cheap please","what can I get for 5 bucks",
"budget friendly meal","any specials today","what's the most affordable combo",
"economy meal","two for one deals","what's the least expensive",
"best price for food","I'm broke what can I get","cheap eats",
"most food for least money","any combos on sale",
"give me the cheapest combo","what's good and cheap",
"deal of the day","anything under 3 dollars","value picks",
"least expensive burger","saving money what should I get",
"something filling but cheap","cheapest chicken option",
"best deal on nuggets","what's the cheapest meal you got",
"anything on special","can I get something for under 4 dollars",
"feed me for 5 dollars","what deals do you have",
"got any promotions","value menu options","economy picks",
"best deal for a family","cheap family meal","value combos",
"save me some money","what's the best deal on burgers",
"frugal options","I want something affordable",
"cheap breakfast option","budget breakfast","affordable lunch",
"something inexpensive","low cost meal","discount meals",
"saving money today","penny pincher special","thrifty option"]:
    ALL.append(ex(s, "value_recommendation"))

# === ADD_ON_SUGGESTION (+60) ===
ADDONS = [("Chocolate Chip Cookie",1.29),("Baked Apple Pie",1.69),
("Hot Fudge Sundae",2.89),("Caramel Sundae",2.89),("Vanilla Cone",1.89),
("McFlurry with OREO Cookies",4.89)]
for nm,pr in ADDONS:
    for t in [f"sure throw in a {nm}",f"yeah add a {nm}",
    f"I'll take a {nm} too",f"add the {nm}",f"one {nm} please"]:
        ALL.append(ex(t, "add_on_suggestion", {"item":nm,"price":pr}))

for ctx in ["Would you like to add a dessert?","Want a cookie or pie with that?",
"We have apple pies for $1.69, want one?"]:
    for v in ["sure","yeah the apple pie","throw in a cookie","yeah why not",
    "I'll take a pie","yes please","sure add a cookie","yeah one apple pie",
    "yes one cookie","okay sure"]:
        nm,pr = ("Baked Apple Pie",1.69) if "pie" in v else ("Chocolate Chip Cookie",1.29)
        ALL.append(ex(v, "add_on_suggestion", {"item":nm,"price":pr}, ctx))

# === MEAL_SUBSTITUTION (+40) ===
SUBS = [("French Fries","Side Salad"),("French Fries","Apple Slices"),
("Coca-Cola","Sprite"),("Coca-Cola","Sweet Tea"),("Coca-Cola","Dr Pepper"),
("French Fries","Fruit Bag"),("Sprite","Diet Coke"),("Coca-Cola","Lemonade"),
("Coca-Cola","Water"),("French Fries","Yogurt")]
for fr,to in SUBS:
    for t in [f"can I swap the {fr} for a {to}",f"{to} instead of {fr}",
    f"substitute the {fr} with {to}",f"replace the {fr} with {to}"]:
        ALL.append(ex(t, "meal_substitution", {"from":fr,"to":to}))

# === COMPLAINT (+50) ===
COMP = [("my order is wrong","wrong_order"),("this isn't what I ordered","wrong_order"),
("my food is cold","cold_food"),("I've been waiting 20 minutes","long_wait"),
("I'm missing items","missing_items"),("this burger is raw","quality"),
("can I speak to a manager","escalation"),("I want a refund","refund"),
("there's hair in my food","foreign_object"),("the fries are stale","quality"),
("you gave me the wrong drink","wrong_order"),("my Big Mac has no meat","missing_items"),
("this is disgusting","quality"),("the food is terrible","quality"),
("I've been waiting forever","long_wait"),("nobody's at the window","long_wait"),
("my nuggets are missing","missing_items"),("you forgot my fries","missing_items"),
("this doesn't taste right","quality"),("my drink is flat","quality"),
("there's something in my burger","foreign_object"),("I need to talk to someone","escalation"),
("this is unacceptable","escalation"),("the bun is stale","quality"),
("wrong sauce","wrong_order"),("I ordered a Big Mac not a McDouble","wrong_order"),
("the shake tastes weird","quality"),("my order has been wrong three times","escalation"),
("I want my money back","refund"),("can I get this replaced","wrong_order"),
("there's a bug in my food","foreign_object"),("how long until my food","long_wait"),
("this is burnt","quality"),("you messed up my order again","wrong_order"),
("missing the toy in the Happy Meal","missing_items"),
("the coffee is lukewarm","cold_food"),("my fries are cold","cold_food"),
("the ice cream is melted","quality"),("you charged me wrong","refund"),
("I got someone else's order","wrong_order"),("this is way too salty","quality"),
("the chicken is undercooked","quality"),("I specifically said no pickles","wrong_order"),
("half my order is missing","missing_items"),("the app charged me but no food","refund"),
("extremely long wait","long_wait"),("where's my food","long_wait"),
("this isn't fresh","quality"),("the sandwich is falling apart","quality"),
("I found plastic in my food","foreign_object"),("your service is horrible","escalation")]
for s,tp in COMP:
    ALL.append(ex(s, "complaint", {"type":tp}))

# === MACHINE_DOWN (+25) ===
for s,it in [("is the ice cream machine working","ice cream"),
("can I get a milkshake","shake"),("is the McFlurry machine down again","McFlurry"),
("chocolate shake please","shake"),("vanilla shake","shake"),
("do you have ice cream","ice cream"),("strawberry milkshake","shake"),
("is your shake machine broken","shake"),("I want a McFlurry","McFlurry"),
("soft serve cone","ice cream"),("ice cream cone please","ice cream"),
("the machine working today","ice cream"),("y'all got milkshakes","shake"),
("oreo McFlurry please","McFlurry"),("can I get a vanilla cone","ice cream"),
("chocolate milkshake","shake"),("is the frozen stuff available","ice cream"),
("McFlurry with M&Ms","McFlurry"),("any frozen treats","ice cream"),
("shamrock shake","shake"),("caramel shake","shake"),
("I heard the machine is broken","ice cream"),
("banana milkshake","shake"),("do the shakes work","shake"),
("frozen lemonade","ice cream")]:
    ALL.append(ex(s, "machine_down", {"item":it}))

# === TIME_CHECK (+15) ===
for s,q in [("how long is the wait","wait_time"),
("what time do you close","hours"),("are you still serving breakfast","breakfast_hours"),
("when does breakfast end","breakfast_hours"),("how late are you open","hours"),
("how much longer for my food","wait_time"),("when does lunch start","hours"),
("what are your hours","hours"),("you guys open 24 hours","hours"),
("is the lobby open","hours"),("how long will my order take","wait_time"),
("am I too late for breakfast","breakfast_hours"),
("when do you start serving breakfast","breakfast_hours"),
("what time does breakfast start","breakfast_hours"),
("estimated wait time","wait_time")]:
    ALL.append(ex(s, "time_check", {"query":q}))

# === DEDUPLICATE ===
seen = set()
unique = []
for e in ALL:
    key = e["input"].lower().strip()
    if key not in seen:
        seen.add(key)
        unique.append(e)

# === WRITE ===
random.shuffle(unique)
with open(OUTPUT, 'w') as f:
    for e in unique:
        f.write(json.dumps(e) + '\n')

from collections import Counter
c = Counter(e["behavior"] for e in unique)
print(f"Generated {len(unique)} unique examples across {len(c)} behaviors:")
for b, n in c.most_common():
    print(f"  {b}: {n}")
