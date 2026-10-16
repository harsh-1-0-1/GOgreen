import sqlite3
import json

conn = sqlite3.connect('gogreen.db')
cursor = conn.cursor()
cursor.execute('SELECT id, name, variants FROM products')
rows = cursor.fetchall()
conn.close()

total = len(rows)
legacy_string_products = []
already_array = 0
no_image_map = 0

for row in rows:
    pid, name, variants_raw = row
    if not variants_raw:
        no_image_map += 1
        continue
    variants = json.loads(variants_raw) if isinstance(variants_raw, str) else variants_raw
    if not isinstance(variants, dict):
        no_image_map += 1
        continue
    image_map = variants.get('image_map') or {}
    if not image_map:
        no_image_map += 1
        continue
    has_legacy = False
    for k, v in image_map.items():
        if isinstance(v, str):
            has_legacy = True
            break
    if has_legacy:
        legacy_string_products.append((pid, name))
    else:
        already_array += 1

print("Total products:              ", total)
print("Already using array format:  ", already_array)
print("Still using legacy string:   ", len(legacy_string_products))
print("No image_map:                ", no_image_map)

if legacy_string_products:
    print()
    print("--- Products still with legacy string image_map ---")
    for pid, name in legacy_string_products[:10]:
        print("  id=%d name=%r" % (pid, name))
