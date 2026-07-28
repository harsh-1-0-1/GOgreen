# Flexible Variant System — What Changed

## Old System → New System

### Data Shape (stored in `products.variants` JSON column)

**Before:**
```json
{
  "colors": [{ "name": "Terracotta", "hex": "#C4622D", "slug": "terracotta" }],
  "pot_types": [{ "name": "Ceramic", "slug": "ceramic", "price_modifier": 150 }],
  "sizes": [{ "name": "Small", "slug": "small", "price_modifier": 0 }],
  "image_map": { "terracotta__ceramic__small": ["img.jpg"] },
  "stock": { "terracotta__ceramic__small": 10 },
  "default_image": "default.jpg"
}
```

**After:**
```json
{
  "variant_groups": [
    {
      "id": "vg_abc123",
      "label": "Select Size",
      "options": [
        { "id": "opt_abc123", "name": "4 Inch", "price": 1499, "stock": 20, "images": ["img.jpg"] }
      ]
    }
  ],
  "default_image": "default.jpg"
}
```

**Key differences:**
- Admin types the label freely — `"Select Size"`, `"Select Packet Size"`, anything
- `price` is absolute per option (not a base + delta)
- `stock` is per option (not per full combination)
- `images` is per option (not per combination key)
- Any number of groups: 0 (simple product), 1 (seeds), 2–3 (plants)

---

### Cart / Order: `selected_options` field

**Before:** `{ "color": "terracotta", "pot_type": "ceramic", "size": "small" }`

**After:** `["opt_abc123", "opt_def456"]` — flat array of option IDs

**In orders**, the field also carries a denormalized snapshot so history never breaks:
```json
{
  "option_ids": ["opt_abc123"],
  "snapshot": [{ "label": "Select Size", "name": "4 Inch", "price": 1499 }]
}
```

---

## Files Changed

### Backend

| File | What changed |
|------|-------------|
| `app/schemas/product.py` | Added `VariantOption`, `VariantGroup`, `ProductVariantsNew` Pydantic models. `ProductCreate`/`ProductUpdate` validate new structure on write. |
| `app/utils/variant_pricing.py` | **New file.** Server-side price calc — sums option prices from stored `variant_groups`, never trusts client. Returns `variant_snapshot` for order denormalization. |
| `app/utils/image_upload.py` | `resolve_variants_images()` now resolves `variant_groups[].options[].images[]` in addition to old fields. |
| `app/services/cart_service.py` | `resolve_variant_details()` detects `variant_groups` and delegates to new pricing. `add_item()` accepts `list[str]` (option IDs) or old `dict`. |
| `app/services/order_service.py` | `_reserve_product_for_order()` decrements per-option stock. Stores `{option_ids, snapshot}` in `selected_options` at purchase time. |
| `seed.py` | Old `_make_variants/_make_variants_with_sizes/_make_size_only_variants` replaced with 6 new helpers: `_make_variants`, `_make_variants_with_sizes`, `_make_size_only_variants`, `_make_seed_variants`, `_make_pot_variants`, `_make_care_variants`. |

### Frontend

| File | What changed |
|------|-------------|
| `src/types/index.ts` | Old `ProductVariants` (colors/pot_types/sizes/image_map/stock) replaced with `VariantGroup`, `VariantOption`, `ProductVariants`. `SelectedOptions` union type handles all formats. `ProductVariantsOld` kept as deprecated alias. |
| `src/lib/variantDisplay.ts` | **New file.** `formatSelectedOptions()` / `resolveSelectedOptions()` — renders variant selections in cart/orders for all 3 formats (new IDs, snapshot, old dict). |
| `src/lib/directCheckout.ts` | `selected_options` type updated to accept `string[]` or old dict. |
| `src/store/cartStore.ts` | `addItem()` accepts `string[] \| Record<string,string> \| null`. |
| `src/pages/ProductDetailPage.tsx` | `selectedColor/selectedPot/selectedSize` state replaced with `selectedOptions: Record<groupId, optionId>`. Variant picker loops over `variant_groups`. Price = sum of selected option prices. Image swap from `option.images[]`. Add to Cart disabled only when `hasGroups && !allSelected` (zero groups = always enabled). |
| `src/pages/admin/ProductsAdminPage.tsx` | Fixed Colors/Pot Types/Sizes sections replaced with dynamic "+ Add Variant Type" UI. Each group has a freeform label and option rows (name, price, stock, image). No category logic. |
| `src/pages/CartPage.tsx` | `optionSummary()` uses `variantDisplay.ts`. |
| `src/pages/CheckoutPage.tsx` | `optionSummary()` uses `variantDisplay.ts`. |
| `src/pages/OrderDetailPage.tsx` | Selected options display uses `variantDisplay.ts`. |
| `src/pages/admin/OrdersAdminPage.tsx` | Selected options display uses `variantDisplay.ts`. |
| `src/components/cart/CartDrawer.tsx` | `optionSummary()` uses `variantDisplay.ts`. |
| `src/components/product/ProductCard.tsx` | `hasVariants` check updated to `variant_groups.length > 0`. |
| `src/components/cart/RecommendationBar.tsx` | Same `hasVariants` fix. |
| `src/components/home/*.tsx` (5 files) | Same `hasVariants` fix. |

---

## What Was NOT Changed

- Database schema — `variants` is already a JSON column, no migration needed
- The 101 existing test products — still in DB with old format (frontend handles gracefully when `variant_groups` is absent)
- All non-variant product fields — unchanged
- Auth, orders, payments, reviews, banners, blog — untouched

---

## To Reset Test Data

When ready to replace the 101 old-format products with clean seed data:
```bash
cd backend
uv run python seed.py
```
This truncates all products/categories/users and re-seeds using the new variant format.
