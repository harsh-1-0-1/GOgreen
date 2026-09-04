# 🎯 Flexible Variant Groups Migration Plan

## Executive Summary

You're absolutely right — Ugaoo's system is **flexible, not fixed**. Instead of hardcoded `colors`, `pot_types`, `sizes`, we need **variant groups** where:
- Admin creates groups per-product
- Each group has a custom label ("Select Size", "Select Packet Size", "Select Colour")
- Options are free-text with individual prices
- No category-specific logic needed

---

## Current vs New Structure

### ❌ Current System (Fixed Keys)
```json
{
  "colors": [...],
  "pot_types": [...],
  "sizes": [...],
  "image_map": {},
  "stock": {}
}
```

**Problems:**
- Keys hardcoded to plant products only
- Seeds/pots/tools forced into wrong terminology
- Admin can't customize labels per product

### ✅ New System (Flexible Groups)
```json
{
  "variant_groups": [
    {
      "id": "vg_1",
      "label": "Select Size",
      "key": "size",
      "options": [
        { "id": "opt_1", "name": "4 Inch", "price": 1499, "sku_suffix": "4in" }
      ]
    }
  ],
  "combinations": [
    {
      "option_ids": ["opt_1", "opt_3"],
      "price": 1649,
      "stock": 20,
      "images": ["key1.jpg", "key2.jpg"]
    }
  ]
}
```

**Advantages:**
- Admin controls all labels
- Works for ANY product type
- No frontend category logic
- Cleaner UX (absolute prices instead of base+delta)

---

## Database Schema Changes

### Option 1: Keep JSON Column (Recommended)
**No migration needed!** The `variants` column is already JSON — just change the structure.

**Pros:**
- Zero downtime
- Backward compatible (read old format, save new format)
- Flexible schema evolution

**Cons:**
- Can't query specific variant options in SQL (already true today)

### Option 2: Normalize Tables
Create `product_variant_groups`, `variant_options`, `variant_combinations` tables.

**Pros:**
- Queryable, relational integrity

**Cons:**
- Complex migration, more joins, overkill for 101 products

**✅ Recommendation: Stick with JSON column**

---

## New JSON Structure (Detailed)

```json
{
  "variant_groups": [
    {
      "id": "vg_size",              // unique within product
      "label": "Select Size",        // shown to customer
      "key": "size",                 // internal, for SKU generation
      "required": true,              // must customer pick one?
      "options": [
        {
          "id": "opt_small",
          "name": "Small (6-10\")",  //

 customer-facing
          "price": 499,              // absolute price, not delta
          "sku_suffix": "SM"         // for inventory codes
        }
      ]
    }
  ],
  "combinations": [
    {
      "option_ids": ["opt_small", "opt_ceramic"],  // combo key
      "price": 649,                 // total price for this combo
      "stock": 15,
      "images": ["rel/key1.jpg"]    // relative keys, resolved by serializer
    }
  ],
  "default_image": "rel/default.jpg"   // fallback if combo has no images
}
```


---

## Migration Strategy

### Phase 1: Backend Data Migration Script

**File:** `/backend/migrate_variants_to_groups.py`

**Logic:**
1. Read all products with `variants != null`
2. For each product:
   - If has `colors` → Create group "Select Pot Colour"
   - If has `pot_types` → Create group "Select Pot Material"
   - If has `sizes` → Create group "Select Size" (or "Select Packet Size" for seeds category)
   - Convert `image_map` keys (e.g. `"terracotta__plastic__small"`) to combination records
   - Convert stock map same way
3. Write new structure back to DB
4. Keep old structure temporarily for rollback

**Pseudo-code:**
```python
for product in products_with_variants:
    old = product.variants
    new = {"variant_groups": [], "combinations": []}
    
    # Build groups
    if old.get("colors"):
        new["variant_groups"].append({
            "id": "vg_color",
            "label": "Select Pot Colour",
            "key": "color",
            "options": [
                {"id": f"color_{c['slug']}", "name": c["name"], "price": product.price}
                for c in old["colors"]
            ]
        })
    
    # Build combinations from old image_map/stock keys
    old_stock = old.get("stock", {})
    old_images = old.get("image_map", {})
    
    for combo_key, stock_qty in old_stock.items():
        # e.g. "terracotta__plastic__small" → ["color_terracotta", "pot_plastic", "size_small"]
        option_ids = parse_combo_key(combo_key)
        new["combinations"].append({
            "option_ids": option_ids,
            "price": calculate_price(product, combo_key),
            "stock": stock_qty,
            "images": old_images.get(combo_key, [])
        })
    
    product.variants = new
    db.commit()
```


### Phase 2: Update TypeScript Types

**File:** `/frontend/src/types/index.ts`

Replace:
```typescript
export interface ProductVariants {
  colors: ProductVariantColor[];
  pot_types: ProductVariantPotType[];
  sizes?: ProductVariantSize[];
  image_map: Record<string, string[]>;
  default_image: string;
  stock: Record<string, number>;
}
```

With:
```typescript
export interface VariantGroup {
  id: string;
  label: string;
  key: string;
  required?: boolean;
  options: VariantOption[];
}

export interface VariantOption {
  id: string;
  name: string;
  price: number;
  sku_suffix?: string;
  image_url?: string;  // optional icon for the option itself
}

export interface VariantCombination {
  option_ids: string[];
  price: number;
  stock: number;
  images?: string[];
}

export interface ProductVariants {
  variant_groups: VariantGroup[];
  combinations: VariantCombination[];
  default_image?: string;
}
```

### Phase 3: Update Admin Panel UI

**File:** `/frontend/src/pages/admin/ProductsAdminPage.tsx`

**Current Structure (3 separate sections):**
```typescript
// Colors section
const [colors, setColors] = useState<VariantColorDraft[]>([]);

// Pots section  
const [pots, setPots] = useState<VariantPotDraft[]>([]);

// Sizes section
const [sizes, setSizes] = useState<VariantSizeDraft[]>([]);
```

**New Structure (Dynamic groups):**
```typescript
const [variantGroups, setVariantGroups] = useState<VariantGroupDraft[]>([]);

interface VariantGroupDraft {
  id: string;
  label: string;
  key: string;
  options: VariantOptionDraft[];
}

interface VariantOptionDraft {
  id: string;
  name: string;
  price: number;
  image_key?: string;
  image_url?: string;
}
```


**UI Changes:**

1. **Replace fixed sections** with dynamic "+ Add Variant Type" button
2. **Each group** has:
   - Label input (e.g., "Select Size", "Select Packet Size")
   - "+ Add Option" button
   - Each option: name input, price input, optional image upload
3. **Combinations table** auto-generates from Cartesian product of all groups
4. **Stock & images** managed per combination (same as current)

**Mock UI Flow:**
```
┌─────────────────────────────────────────┐
│ Variant Groups                          │
├─────────────────────────────────────────┤
│ [+ Add Variant Type]                    │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ Group: Select Size              [×] │ │
│ │ ───────────────────────────────────  │ │
│ │ [+ Add Option]                      │ │
│ │                                     │ │
│ │ Option: 4 Inch   Price: ₹1499 [🖼]  │ │
│ │ Option: 5 Inch   Price: ₹1699 [🖼]  │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ Group: Select Pot Colour        [×] │ │
│ │ ───────────────────────────────────  │ │
│ │ Option: Terracotta  Price: ₹0  [🖼]  │ │
│ │ Option: Sage Green  Price: ₹0  [🖼]  │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Stock & Images (Auto-generated combos)  │
├──────────────────┬───────┬──────────────┤
│ 4" × Terracotta  │ Qty:20│ [images...] │
│ 4" × Sage Green  │ Qty:15│ [images...] │
│ 5" × Terracotta  │ Qty:10│ [images...] │
│ 5" × Sage Green  │ Qty:8 │ [images...] │
└──────────────────┴───────┴──────────────┘
```


### Phase 4: Update Frontend Product Page

**File:** `/frontend/src/pages/ProductDetailPage.tsx`

**Old code (hardcoded to colors/pots/sizes):**
```typescript
{product.variants?.colors && (
  <div>
    <label>Select Color:</label>
    {product.variants.colors.map(color => (
      <button key={color.slug}>{color.name}</button>
    ))}
  </div>
)}
```

**New code (loops over groups):**
```typescript
{product.variants?.variant_groups?.map(group => (
  <div key={group.id}>
    <label>{group.label}:</label>
    {group.options.map(option => (
      <button key={option.id}>
        {option.name} - ₹{option.price}
      </button>
    ))}
  </div>
))}
```

**Benefits:**
- Same rendering code for plants, seeds, pots, tools
- No category checks needed
- Admin controls all labels

---

## Implementation Phases

### Phase 1: Data Migration (Backend Only)
**Estimated Time:** 2-3 hours

1. Write `/backend/migrate_variants_to_groups.py`
2. Test on staging database
3. Run on production (includes rollback SQL)
4. Verify all 101 products migrated correctly

**Deliverables:**
- Migration script
- Rollback script
- Test results document


### Phase 2: Frontend Types Update
**Estimated Time:** 1 hour

1. Update `/frontend/src/types/index.ts`
2. Fix TypeScript errors throughout codebase
3. Ensure backwards compatibility (read both formats temporarily)

**Deliverables:**
- Updated type definitions
- Compilation with no errors

### Phase 3: Admin Panel Rebuild
**Estimated Time:** 8-10 hours

1. Replace fixed variant sections with dynamic "+ Add Variant Type"
2. Implement drag-and-drop reordering (optional but nice)
3. Update form submission to send new structure
4. Test creating products with 1, 2, 3+ variant groups

**Deliverables:**
- Refactored `ProductModal` component
- Working create/edit flows for all product types

### Phase 4: Frontend Product Page Update
**Estimated Time:** 4-6 hours

1. Update product detail page to loop over `variant_groups`
2. Update cart logic to store `option_ids` instead of slug-based keys
3. Update order details to display combinations correctly
4. Test add-to-cart, checkout, order history

**Deliverables:**
- Updated product detail page
- Updated cart/checkout flows
- Order history display fix

### Phase 5: Testing & QA
**Estimated Time:** 4 hours

1. Test all product categories (plants, seeds, pots, tools)
2. Test edge cases (1 group, 3 groups, no groups)
3. Test image fallbacks
4. Test stock calculations

**Total Estimated Time:** 20-24 hours (3 full days)


---

## Key Design Decisions

### 1. Price Storage: Absolute vs Delta?

**Current:** Base price + modifiers (+₹150 for ceramic)  
**Ugaoo:** Absolute prices per option (₹1499, ₹1699)

**✅ Recommendation: Absolute prices**

Why:
- Simpler for admin (no mental math)
- Clearer in UI ("₹1699" vs "₹1499 + ₹200")
- Matches customer expectation from your screenshots

**Implementation:**
- Each option has `price` field
- Combinations inherit from options (sum or explicit)
- Backend calculates totals based on selected option_ids

### 2. Combination Storage: Explicit vs Implicit?

**Option A: Explicit (Store all combos)**
```json
{
  "combinations": [
    {"option_ids": ["opt1", "opt2"], "price": 1649, "stock": 20}
  ]
}
```

**Option B: Implicit (Generate on-the-fly)**
```json
{
  "variant_groups": [...],
  "stock_overrides": {"opt1+opt2": 20}
}
```

**✅ Recommendation: Explicit combinations**

Why:
- Admin can set custom prices for specific combos
- Stock tracking is clearer
- Images per combo easier to manage
- Matches current system's `image_map`/`stock` pattern

### 3. Backward Compatibility?

**✅ Recommendation: Dual-read support for 1 month**

Implementation:
```typescript
function parseVariants(raw: any): ProductVariants {
  if (raw.variant_groups) {
    return raw; // new format
  }
  // Convert old format on-the-fly
  return convertLegacyVariants(raw);
}
```

This allows:
- Gradual migration
- Rollback safety
- Frontend/backend deploy independently


---

## Code Impact Summary

### Files to Modify

| File | Change | Priority |
|------|--------|----------|
| `/frontend/src/types/index.ts` | Replace variant types | HIGH |
| `/frontend/src/pages/admin/ProductsAdminPage.tsx` | Rebuild variant section | HIGH |
| `/frontend/src/pages/ProductDetailPage.tsx` | Loop over groups, update selection | HIGH |
| `/frontend/src/components/cart/*.tsx` | Update selected_options format | HIGH |
| `/backend/app/db/models.py` | No change (JSON column stays) | NONE |
| `/backend/app/schemas/product.py` | Keep `dict` type for variants | NONE |
| `/backend/app/utils/image_upload.py` | Update `resolve_variants_images()` | MEDIUM |

### Files to Create

| File | Purpose |
|------|---------|
| `/backend/migrate_variants_to_groups.py` | One-time data migration |
| `/backend/rollback_variants_migration.py` | Rollback if something goes wrong |

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Broken cart for orders in-flight | HIGH | Deploy backend + frontend together |
| Existing 101 products' images lost | HIGH | Test migration script on copy first |
| Seeds products still have wrong values | MEDIUM | Manual re-entry needed for seeds |
| Admin can't figure out new UI | LOW | Add helper text / templates |

---

## What To Build First

1. **Migration script** (to verify concept on real data)
2. **Types update** (unblocks all other work)
3. **Admin panel variant section** (biggest UI change)
4. **Product page variant picker** (customer-facing)
5. **Cart + order updates** (last, most risk)

---

## Open Questions for You

1. **Price per option or price per combination?**
   - Simple: Each option has a price. If multiple groups selected, last group's price wins?
   - Or: Admin sets price for each exact combination?

2. **Seeds migration:** Do you want to manually update seed products with correct gram sizes, or auto-convert "Small/Medium/Large" → "100g/200g/500g"?

3. **Pots/colors in new plants:** Should we add a preset "Plant starter kit" that pre-fills common groups for the admin to save time?

4. **What does `selected_options` in cart look like now vs new?**  
   Currently: `{"color": "terracotta", "pot_type": "ceramic", "size": "small"}`  
   New: `{"vg_color": "opt_terracotta", "vg_pot": "opt_ceramic"}` or just `["opt_terracotta", "opt_ceramic"]`?

---

Let me know if you want to start implementing Phase 1 (migration script) or Phase 3 (admin panel rebuild) first!
