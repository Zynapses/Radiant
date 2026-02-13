#!/usr/bin/env python3
"""
Download McDonald's product images from their CDN and remove backgrounds using rembg.
Outputs transparent PNGs to public/menu-img/ for use in the drive-thru UI.

Usage: python3 apps/omega-lab/scripts/process-menu-images.py
"""

import os
import sys
import requests
from pathlib import Path
from io import BytesIO
from PIL import Image
from rembg import remove

OUTPUT_DIR = Path(__file__).parent.parent / "public" / "menu-img"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

MCD_CDN = "https://s7d1.scene7.com/is/image/mcdonalds/"

# Map: local filename -> list of CDN slugs to try (first success wins)
# Multiple slug variations because McDonald's naming isn't 100% consistent
MENU_IMAGES = {
    # Burgers — t-mcdonalds- prefix works with -1 suffix
    "big-mac":              ["t-mcdonalds-Big-Mac-1"],
    "quarter-pounder":      ["t-mcdonalds-Quarter-Pounder-with-Cheese-1"],
    "double-quarter":       ["t-mcdonalds-Double-Quarter-Pounder-with-Cheese-1"],
    "mcdouble":             ["t-mcdonalds-McDouble-1"],
    "cheeseburger":         ["t-mcdonalds-Cheeseburger-1"],
    "double-cheeseburger":  ["t-mcdonalds-Double-Cheeseburger-1"],
    "mccrispy":             ["mccrispy"],
    "spicy-mccrispy":       ["mccrispy"],  # same image, CDN has no separate spicy variant
    "mcchicken":            ["t-mcdonalds-McChicken-1"],
    "filet-o-fish":         ["t-mcdonalds-Filet-O-Fish-1"],

    # McNuggets — bare lowercase works with -Xpc suffix
    "nuggets-4":            ["t-mcdonalds-Chicken-McNuggets-4pc"],
    "nuggets-6":            ["t-mcdonalds-Chicken-McNuggets-6pc"],
    "nuggets-10":           ["t-mcdonalds-Chicken-McNuggets-10pc"],
    "nuggets-20":           ["t-mcdonalds-Chicken-McNuggets-20pc"],
    "nuggets-40":           ["t-mcdonalds-Chicken-McNuggets-40pc"],

    # Fries — bare lowercase works
    "fries-small":          ["fries-small"],
    "fries-medium":         ["fries-medium"],
    "fries-large":          ["fries-large"],

    # Sides & Sweets
    "apple-pie":            ["hot-apple-pie", "apple-pie"],
    "mcflurry-oreo":        ["t-mcdonalds-mcflurry-oreo"],
    "chocolate-chip-cookie":["t-mcdonalds-Chocolate-Chip-Cookie-1"],

    # Drinks — mixed patterns
    "coca-cola":            ["t-mcdonalds-coca-cola-small"],
    "sprite":               ["t-mcdonalds-Sprite-Small-1"],
    "dr-pepper":            ["t-mcdonalds-Dr-Pepper-Small-1"],
    "sweet-tea":            ["iced-tea"],
    "lemonade":             ["orange-juice"],  # reuse OJ cup as visual placeholder
    "orange-juice":         ["orange-juice"],

    # McCafé — bare lowercase works for most
    "coffee":               ["premium-roast-coffee"],
    "iced-coffee":          ["premium-roast-coffee"],  # reuse coffee cup as visual placeholder
    "frappe-caramel":       ["caramel-frappe"],
    "frappe-mocha":         ["mocha-frappe", "frappe-mocha"],
    "hot-chocolate":        ["hot-chocolate-small", "hot-chocolate"],

    # Happy Meal — only generic happy-meal slug exists
    "happy-meal-nuggets-4": ["happy-meal"],
    "happy-meal-nuggets-6": ["happy-meal"],
    "happy-meal-hamburger":  ["happy-meal"],
}

# Scene7 URL presets to try (some render differently)
PRESETS = [
    "",  # no preset, raw image
    ":1-3-product-tile-desktop",
    ":product-header-mobile",
    ":nutrition-calculator-tile",
]


def try_download(slug: str) -> bytes | None:
    """Try downloading an image with different presets. Returns image bytes or None."""
    for preset in PRESETS:
        url = f"{MCD_CDN}{slug}{preset}?wid=400&hei=400&dpr=off"
        try:
            resp = requests.get(url, timeout=10, headers={
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"
            })
            if resp.status_code == 200 and len(resp.content) > 1000:
                # Verify it's actually an image
                try:
                    img = Image.open(BytesIO(resp.content))
                    img.verify()
                    return resp.content
                except Exception:
                    continue
        except Exception:
            continue
    return None


def process_image(name: str, slugs: list[str]) -> bool:
    """Download and remove background for a menu item. Returns success."""
    out_path = OUTPUT_DIR / f"{name}.png"
    if out_path.exists():
        print(f"  ✓ {name} (cached)")
        return True

    # Try each slug variation
    raw_bytes = None
    used_slug = None
    for slug in slugs:
        raw_bytes = try_download(slug)
        if raw_bytes:
            used_slug = slug
            break

    if not raw_bytes:
        print(f"  ✗ {name} — no working CDN slug found")
        return False

    print(f"  ↓ {name} (from {used_slug})")

    # Remove background with rembg
    try:
        result = remove(raw_bytes)
        img = Image.open(BytesIO(result)).convert("RGBA")

        # Crop to content (remove surrounding transparent space)
        bbox = img.getbbox()
        if bbox:
            img = img.crop(bbox)

        # Resize to consistent size
        img.thumbnail((400, 400), Image.LANCZOS)

        img.save(out_path, "PNG", optimize=True)
        print(f"  ✓ {name} ({out_path.stat().st_size // 1024}KB)")
        return True
    except Exception as e:
        print(f"  ✗ {name} — rembg failed: {e}")
        return False


def main():
    print(f"Processing {len(MENU_IMAGES)} menu items...")
    print(f"Output: {OUTPUT_DIR}\n")

    success = 0
    failed = []

    for name, slugs in MENU_IMAGES.items():
        ok = process_image(name, slugs)
        if ok:
            success += 1
        else:
            failed.append(name)

    print(f"\n{'='*50}")
    print(f"Done: {success}/{len(MENU_IMAGES)} images processed")
    if failed:
        print(f"Failed: {', '.join(failed)}")
    print(f"Output: {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
