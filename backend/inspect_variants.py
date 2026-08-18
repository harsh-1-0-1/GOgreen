import sqlite3
import json

conn = sqlite3.connect('gogreen.db')
cursor = conn.cursor()
cursor.execute('SELECT id, name, variants FROM products LIMIT 3')
rows = cursor.fetchall()
conn.close()

for row in rows:
    pid, name, variants_raw = row
    variants = json.loads(variants_raw) if isinstance(variants_raw, str) else variants_raw
    print("=== id=%d name=%s ===" % (pid, name))
    if variants:
        keys = list(variants.keys())
        print("  variant keys:", keys)
        if "image_map" in variants:
            print("  image_map:", json.dumps(variants["image_map"])[:300])
        elif "colors" in variants or "pot_types" in variants:
            print("  HAS colors/pot_types but NO image_map!")
            print("  colors count:", len(variants.get("colors", [])))
            print("  pot_types count:", len(variants.get("pot_types", [])))
            print("  stock:", json.dumps(variants.get("stock", {}))[:200])
    else:
        print("  variants is None/empty")
    print()
