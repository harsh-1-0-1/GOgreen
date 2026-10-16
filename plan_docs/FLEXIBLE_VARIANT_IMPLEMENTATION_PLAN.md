# 🎯 Flexible Variant System — Implementation Plan

**Status:** APPROVED. All decisions locked. Ready to implement.

---

## 0. Decisions (Locked)

| Question | Decision |
|----------|----------|
| **Migration of old data** | **Skip.** Delete all 101 existing products (test data). No migration script needed. |
| **Pricing model** | **Sum of selected option prices** across all groups. (Size ₹499 + Colour ₹0 = ₹499 total) |
| **Stock tracking** | **Per option**, not per combination. Simplified model. |
| **Seeds values** | Admin will **manually enter** correct values (16gm, 100gm, etc.). No auto-conversion. |
| **Backward compatibility** | **None.** Clean cutover since test data is being deleted. |
| **Scope** | Build new system that works for **all product types** with **zero category logic**. |

---

## 1. Goal

Replace fixed `colors`/`pot_types`/`sizes` variant keys with **flexible variant groups**.

**Any product** (plant, seed, pot, tool, fertilizer) can define its own variant types and labels — fully controlled by admin, with **no hardcoded category logic** anywhere.

**Reference behavior:** Ugaoo's product pages where:
- Plants show "SELECT SIZE" → "4 Inch / ₹1499", "5 Inch / ₹1699"
- Seeds show "SELECT PACKET SIZE" → "16 gm / ₹99", "100 gm / ₹195", "250 gm / ₹315"
- Same underlying mechanism, different admin-entered labels

---

## 2. New Data Model

### 2.1 Product Variants Structure (JSON column)

```
variants: {
  variant_groups: [
    {
      id: "vg_1"
      label: "Select Size"
      options: [
        { id: "opt_1", name: "4 Inch", price: 1499, stock: 20, images: ["img1.jpg"] }
        { id: "opt_2", name: "5 Inch", price: 1699, stock: 15, images: ["img2.jpg"] }
      ]
    },
    {
      id: "vg_2"
      label: "Select Pot Colour"
      options: [
        { id: "opt_3", name: "Terracotta", price: 0, stock: 10 }
        { id: "opt_4", name: "Sage Green", price: 0, stock: 12 }
      ]
    }
  ],
  default_image: "default.jpg"
}
```

**Key Points:**
- IDs are generated once and stay stable (used in cart/orders)
- **Price is absolute**, not delta
- **Total price = sum** of one selected option from each group
- **Stock is per option**, not per combination
- **Images per option** (optional) — swaps hero image on selection
- Product can have **0, 1, or many** groups

### 2.2 Cart/Order Selection Format

```
{
  product_id: 123,
  selected_options: ["opt_1", "opt_3"],
  unit_price: 1499
}
```

- `selected_options` = flat array of option IDs (one per group)
- `unit_price` = server-computed (sum of prices), re-validated at checkout

---

## 3. Backend Changes

### 3.1 Database Schema
- **No migration needed** — `variants` column already JSON/JSONB
- Stop writing old `colors/pot_types/sizes/image_map/stock` shape
- Start writing `variant_groups` shape

### 3.2 Model/Schema Updates
- Update Pydantic schemas to model `VariantGroup` and `VariantOption`
- Keep flexible dict-backed if strict typing is painful
- Validation matters on write (admin API), not read

### 3.3 API Endpoints

**Create/Update Product (Admin):**
- Accept `variant_groups` in request body
- Server generates IDs for any missing ones
- **Validation:**
  - Each group must have non-empty `label`
  - Each group must have ≥1 option
  - Each option must have `name` and numeric `price` ≥ 0
  - No duplicate option IDs within product

**Get Product (Storefront):**
- Return `variant_groups` as-is
- Frontend renders directly

**Price Calculation / Add-to-Cart:**
- Given `product_id` + `selected_options[]`
- Look up each option's price from stored `variant_groups`
- Sum them
- Validate one option picked per required group
- Validate stock
- Return authoritative total price

### 3.4 Cleanup
- Delete all 101 test products
- Remove code reading/writing old variant format

---

## 4. Frontend Changes

### 4.1 Types (`types/index.ts`)

**New interfaces:**
- `VariantOption` → id, name, price, stock, images?
- `VariantGroup` → id, label, required?, options[]
- `ProductVariants` → variant_groups[], default_image?

**Delete:**
- Old `ProductVariants` with colors/pot_types/sizes/image_map/stock

### 4.2 Admin Panel (`pages/admin/ProductsAdminPage.tsx`)

**Replace three fixed sections with dynamic section:**

**UI Structure:**
```
┌──────────────────────────────────────┐
│ Product Variants                     │
├──────────────────────────────────────┤
│ [+ Add Variant Type]                 │
│                                      │
│ ┌──────────────────────────────────┐ │
│ │ Label: [Select Size______] [×]   │ │
│ │ ────────────────────────────────  │ │
│ │ [+ Add Option]                   │ │
│ │                                  │ │
│ │ Name: [4 Inch]  Price: [1499]   │ │
│ │ Stock: [20]  Image: [🖼 Upload]  │ │
│ │                                  │ │
│ │ Name: [5 Inch]  Price: [1699]   │ │
│ │ Stock: [15]  Image: [🖼 Upload]  │ │
│ └──────────────────────────────────┘ │
│                                      │
│ ┌──────────────────────────────────┐ │
│ │ Label: [Select Pot Colour_] [×]  │ │
│ │ [+ Add Option]                   │ │
│ └──────────────────────────────────┘ │
└──────────────────────────────────────┘
```

**Features:**
- "+ Add Variant Type" → adds empty group
- Text input for `label` (no dropdown, no presets)
- "+ Add Option" → adds blank option row
- Each option: name, price, stock, optional image
- "×" to remove group/option
- Works identically for all product categories
- Zero groups = valid (simple product)

### 4.3 Product Detail Page (`pages/ProductDetailPage.tsx`)

**Rendering:**
- Loop over `variant_groups` array
- Display group `label` as heading
- Render option buttons with name + price
- Track selection state: `{groupId: optionId}`
- Calculate total price = sum of selected options' prices
- Swap main image if option has `images[]`
- Disable "Add to Cart" until one option selected per required group

**No category-specific code** — renders whatever admin configured

### 4.4 Cart / Checkout / Orders

**Cart Item:**
- Store `selected_options: string[]` (option IDs)
- Remove old `{color, pot_type, size}` object format

**Display:**
- Look up option names from product's `variant_groups`
- Show: "Select Size: 4 Inch, Select Pot Colour: Terracotta"

**Order History:**
- Store `selected_options` IDs
- Also denormalize `{label, name, price}` snapshot at order time
- Historical orders display correctly even if admin edits variants later

---

## 5. What NOT to Build (Out of Scope)

❌ No migration script for 101 test products — delete them  
❌ No per-combination pricing/stock table — per-option only  
❌ No auto-conversion of seed size values — manual entry  
❌ No backward-compatibility for old format — clean cutover  
❌ No preset variant templates — all freeform entry

---

## 6. Build Order

### Phase 1: Backend Foundation
1. Update `variants` model/schema for new structure
2. Add validation to admin API endpoints
3. Implement price calculation logic (sum of options)
4. Test: Create product via API with 2 groups, verify storage

### Phase 2: Frontend Types
5. Update TypeScript interfaces
6. Remove old variant types
7. Fix compilation errors

### Phase 3: Admin Panel
8. Build dynamic variant groups UI
9. Replace fixed sections (colors/pots/sizes)
10. Add group/option CRUD functionality
11. Test: Create plant with 2 groups, seed with 1 group

### Phase 4: Storefront
12. Update product detail page variant picker
13. Implement dynamic price calculation
14. Implement image swapping on option selection
15. Test: Select options, verify price updates

### Phase 5: Cart & Orders
16. Update cart to use `selected_options[]`
17. Update cart display to show option names
18. Update order history display
19. Test: Add to cart, checkout, view order history

### Phase 6: Cleanup
20. Delete all 101 test products
21. Remove code reading old variant format
22. Manual QA: 0 groups, 1 group, 3 groups scenarios

---

## 7. Acceptance Criteria

- [ ] Admin can create product with any number of variant groups
- [ ] Admin can type custom labels freely (no dropdowns/presets)
- [ ] Admin can add/remove/edit options (name, price, stock, image)
- [ ] Storefront renders whatever groups/labels admin configured
- [ ] No category-specific code paths anywhere
- [ ] Price shown = sum of selected options' prices
- [ ] Cart displays selected option names correctly
- [ ] Order history displays options even if product edited later
- [ ] No products in DB use old `colors/pot_types/sizes` format
- [ ] Works for plants, seeds, pots, tools without any category logic

---

## 8. Testing Scenarios

### Test 1: Plant Product (2 Groups)
- Create product with "Select Size" + "Select Pot Colour"
- Add options: 4 Inch (₹1499), 5 Inch (₹1699)
- Add options: Terracotta (₹0), Sage Green (₹0)
- Verify: Selecting "5 Inch + Terracotta" = ₹1699 total

### Test 2: Seed Product (1 Group)
- Create product with "Select Packet Size"
- Add options: 16 gm (₹99), 100 gm (₹195), 250 gm (₹315)
- Verify: Selecting "100 gm" = ₹195 total

### Test 3: Simple Product (0 Groups)
- Create product with no variant groups
- Verify: Uses base product price, no option selection UI

### Test 4: Complex Product (3 Groups)
- Create with "Size" + "Color" + "Material"
- Add options to each
- Verify: Total = sum of all 3 selected options

### Test 5: Cart & Orders
- Add products from Tests 1-4 to cart
- Checkout and create order
- Edit product variants after order
- Verify: Order history still shows correct original selections

---

## 9. File Impact Summary

### Backend Files to Modify
- `/backend/app/db/models.py` — No change (JSON column stays)
- `/backend/app/schemas/product.py` — Update variant schemas
- `/backend/app/api/v1/products.py` — Update validation, price calc
- `/backend/app/services/product.py` — Update CRUD logic
- `/backend/app/utils/image_upload.py` — Update image resolution for new format

### Frontend Files to Modify
- `/frontend/src/types/index.ts` — Replace variant types
- `/frontend/src/pages/admin/ProductsAdminPage.tsx` — Rebuild variant section
- `/frontend/src/pages/ProductDetailPage.tsx` — Update variant picker
- `/frontend/src/components/product/VariantSelector.tsx` — New component (optional)
- `/frontend/src/components/cart/*.tsx` — Update selection display
- `/frontend/src/pages/OrderHistoryPage.tsx` — Update order display

### Files to Create
- (None — all changes in existing files)

### Files to Delete/Clean
- Code sections reading old `colors/pot_types/sizes` keys
- All 101 test products from database

---

## 10. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking existing carts | HIGH | Deploy backend + frontend together, clear test data first |
| Admin confused by new UI | MEDIUM | Add helper text, placeholder examples, tooltips |
| Price calculation bugs | HIGH | Unit tests for price sum logic, validation at checkout |
| Historical orders broken | MEDIUM | Denormalize option snapshots at order time |
| Image resolution errors | LOW | Test with/without option images, verify fallback |

---

## 11. Timeline Estimate

| Phase | Tasks | Time |
|-------|-------|------|
| Phase 1 | Backend schemas + validation | 3-4 hours |
| Phase 2 | Frontend types | 1 hour |
| Phase 3 | Admin panel rebuild | 8-10 hours |
| Phase 4 | Storefront updates | 4-6 hours |
| Phase 5 | Cart & orders | 4-5 hours |
| Phase 6 | Cleanup & QA | 3-4 hours |
| **TOTAL** | | **23-30 hours** |

**Estimated:** 3-4 full working days

---

## 12. Success Metrics

After implementation:

✅ **Zero hardcoded variant logic** — No if/else by category  
✅ **Admin flexibility** — Can create any variant structure  
✅ **Customer clarity** — Labels match product type  
✅ **Clean codebase** — Old format completely removed  
✅ **Production ready** — Works for all future products  

---

**Next Step:** Hand this document to the implementation agent and start with Phase 1 (Backend Foundation).
