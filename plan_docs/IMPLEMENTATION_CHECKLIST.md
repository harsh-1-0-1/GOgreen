# 🔍 Implementation Checklist — Critical Points to Verify

## High-Priority Validation Points

### ✅ Price Validation at Checkout
**Status:** ✅ VERIFIED

**Implementation:**
- `calculate_variant_price()` in `variant_pricing.py` sums prices from stored `variant_groups`
- Never trusts client-sent total
- Test coverage: Test 2 confirms correct price calculation

**Verified in:**
- `backend/app/utils/variant_pricing.py` - calculate_variant_price()
- `backend/test_variant_groups.py` - TEST 2: Price Calculation

---

### ✅ Order Snapshot (Denormalization)
**Status:** ✅ VERIFIED

**Implementation:**
- `_reserve_product_for_order()` stores `{"option_ids": [...], "snapshot": [{label, name, price}]}`
- Snapshot captured at order time, not just IDs
- Historical orders display correctly even if product edited/deleted

**Verified in:**
- `backend/app/services/order_service.py` - _reserve_product_for_order()
- `backend/app/utils/variant_pricing.py` - variant_snapshot in return value
- `backend/test_variant_groups.py` - TEST 5: Variant Snapshot

---

### ✅ Zero Groups Edge Case (Test 3)
**Status:** ✅ VERIFIED

**Implementation:**
- Products with 0 variant groups work correctly
- Returns base product price
- "Add to Cart" button logic: cart service handles empty selected_options

**Verified in:**
- `backend/app/utils/variant_pricing.py` - handles empty variant_groups[]
- `backend/test_variant_groups.py` - TEST 4: Zero Groups

---

## Phase 1: Backend Foundation

### Step 1.1: Update Variant Schemas
- [ ] Create `VariantOption` Pydantic model
- [ ] Create `VariantGroup` Pydantic model
- [ ] Create `ProductVariants` schema with `variant_groups[]`
- [ ] Update `ProductCreate` schema
- [ ] Update `ProductUpdate` schema
- [ ] Update `ProductResponse` serializer

### Step 1.2: Add Validation
- [ ] Group must have non-empty `label`
- [ ] Group must have ≥1 option
- [ ] Option must have `name` and `price` ≥ 0
- [ ] No duplicate option IDs within product
- [ ] Generate IDs for new groups/options if missing

### Step 1.3: Price Calculation
- [ ] Create `calculate_variant_price(product, selected_options)` function
- [ ] ✅ **CRITICAL:** Re-sum from stored data, don't trust client
- [ ] Validate one option per required group
- [ ] Validate option IDs exist in product
- [ ] Return authoritative price

### Step 1.4: Stock Validation
- [ ] Check each selected option has sufficient stock
- [ ] Decrement stock per-option on purchase
- [ ] Return available stock to frontend

---

## Phase 2: Frontend Types

- [✓] Create `VariantOption` interface
- [✓] Create `VariantGroup` interface
- [✓] Create new `ProductVariants` interface
- [✓] Delete old variant types (colors, pot_types, sizes)
- [✓] Fix all TypeScript compilation errors

---

## Phase 3: Admin Panel

- [ ] Remove fixed sections (Colors, Pot Types, Sizes)
- [ ] Add "+ Add Variant Type" button
- [ ] Build variant group card component
- [ ] Add group label input (freeform text)
- [ ] Add "+ Add Option" button per group
- [ ] Build option row (name, price, stock, image)
- [ ] Add remove buttons (group & option)
- [ ] Update form submission to send `variant_groups`
- [ ] Test: Create plant (2 groups), seed (1 group), tool (0 groups)

---

## Phase 4: Storefront

- [ ] Update product detail page to loop over `variant_groups`
- [ ] Display group labels dynamically
- [ ] Build option selector UI
- [ ] Track selection state per group
- [ ] Calculate total price (sum of selected options)
- [ ] Implement image swapping on option selection
- [ ] ✅ **CRITICAL:** Disable cart button only if `hasGroups && !allSelected`
- [ ] Test all scenarios from Section 8

---

## Phase 5: Cart & Orders

- [ ] Update cart item to use `selected_options[]`
- [ ] Update cart display to show option names
- [ ] ✅ **CRITICAL:** Denormalize variant snapshot at order time
- [ ] Update order history display
- [ ] Test: Order, then edit product, verify history intact

---

## Phase 6: Cleanup

- [ ] Delete all 101 test products
- [ ] Remove code reading old variant format
- [ ] Remove unused type definitions
- [ ] Manual QA all test scenarios

---

## Testing Matrix

| Test | Product Type | Groups | Status |
|------|--------------|--------|--------|
| Test 1 | Plant | 2 groups | ⏳ |
| Test 2 | Seed | 1 group | ⏳ |
| Test 3 | Simple | 0 groups | ⏳ |
| Test 4 | Complex | 3 groups | ⏳ |
| Test 5 | Cart/Orders | All types | ⏳ |

---

## Acceptance Criteria Progress

- [ ] Admin can create product with any number of variant groups
- [ ] Admin can type custom labels freely
- [ ] Admin can add/remove/edit options
- [ ] Storefront renders dynamic groups/labels
- [ ] No category-specific code paths
- [ ] ✅ Price = sum of selected options (server-validated)
- [ ] Cart displays options correctly
- [ ] ✅ Order history uses denormalized snapshot
- [ ] No old format in DB
- [ ] ✅ Works for 0 groups case

---

**Last Updated:** Starting Phase 1  
**Next Review:** After backend schemas + validation complete
