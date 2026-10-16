# Don't Forget Auto-Variant-Selection Bugfix Design

## Overview

This design addresses a bug in the "Don't Forget to Buy" section where clicking "Add" on products with variants throws an error because no variant option is selected. The fix will automatically select the least-priced variant combination before adding the product to the cart, ensuring a smooth user experience while maintaining all existing functionality for products without variants and other parts of the application.

The fix is targeted and minimal: it adds automatic variant selection logic only in the DoNotForgetBar component's `handleQuickAdd` function, leaving all other cart addition flows unchanged.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug - when a user clicks "Add" on a product with variants from the DoNotForgetBar component
- **Property (P)**: The desired behavior - the system automatically selects the least-priced variant combination and adds it to cart without error
- **Preservation**: All existing cart behaviors (success toasts, drawer opening, error handling, loading states) and other add-to-cart flows that must remain unchanged by the fix
- **DoNotForgetBar**: The component in `frontend/src/components/cart/DoNotForgetBar.tsx` that displays recommended products in a horizontal scrollable strip
- **handleQuickAdd**: The function in DoNotForgetBar that handles the "Add" button click
- **addItem**: The cart store function in `frontend/src/store/cartStore.ts` that adds products to the cart
- **ProductVariants**: The flexible variant system with variant_groups, each containing options with individual prices
- **selected_options**: Parameter passed to addItem - an array of option IDs (string[]) representing the selected variant combination
- **price_map**: Optional per-combination absolute prices keyed by combo_key (option IDs joined by "__")
- **pot_price**: Component price grid over a subset of variant_groups (e.g., pot price across size × pot style) with values that are addends, not totals
- **combo_key**: Selected option IDs joined by "__" in variant_group order - used to look up prices and stock

## Bug Details

### Bug Condition

The bug manifests when a user clicks the "Add" button on a product that has variants (ProductVariants object with variant_groups) in the DoNotForgetBar component. The `handleQuickAdd` function calls `addItem` without the `selected_options` parameter, causing the backend to reject the request with a variant selection error.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { productId: number, product: DoNotForgetProduct }
  OUTPUT: boolean
  
  RETURN input.product.variants !== null
         AND input.product.variants.variant_groups IS array
         AND input.product.variants.variant_groups.length > 0
         AND NOT selectedOptionsProvided(input)
END FUNCTION
```

### Examples

- **Small Potted Plant with Size and Pot Type variants**: User clicks "Add" on a plant with Size (Small/Medium/Large) and Pot Type (Ceramic/Plastic) options → backend returns error "variant selection required" → expected: auto-select "Small + Plastic" (if least-priced) and add to cart
- **Plant with Color variants**: User clicks "Add" on a plant with Color options (Terracotta/White/Green) → backend returns error → expected: auto-select the least-priced color option and add to cart
- **Plant with price_map**: User clicks "Add" on a plant where Small/Ceramic costs ₹300 but Medium/Ceramic costs ₹350 (defined in price_map) → expected: auto-select Small/Ceramic as the least-priced combination
- **Plant with pot_price grid**: User clicks "Add" on a plant with a pot_price grid where Small + Grow pot = ₹0 additional, but Small + Designer pot = ₹150 additional → expected: auto-select Small + Grow pot as the least-priced combination

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Products without variants must continue to be added directly to cart without selected_options
- Success toast message ("${productName} added!") must continue to appear
- Cart drawer must continue to open and page must scroll to top after successful addition
- Error toast with API error detail must continue to appear when errors occur
- Loading spinner on Add button and button disabling during loading must continue to work
- All other add-to-cart flows (ProductDetailPage, ProductCard, etc.) must continue unchanged with their existing variant selection UI

**Scope:**
All inputs that do NOT involve clicking "Add" on a product with variants in the DoNotForgetBar should be completely unaffected by this fix. This includes:
- Products without variants in DoNotForgetBar (added directly)
- All add-to-cart operations from other components (ProductDetailPage, ProductCard, etc.)
- Cart drawer behaviors (opening, closing, scrolling)
- Toast notifications for success and errors

## Hypothesized Root Cause

Based on the bug description and code analysis, the root cause is clear:

1. **Missing Variant Selection Logic**: The `handleQuickAdd` function in DoNotForgetBar.tsx (line 56-61) constructs a full Product object but always calls `addItem` with only `productId`, `quantity`, and `fullProduct` - the fourth parameter `selectedOptions` is not provided, defaulting to `null`.

2. **Backend Validation**: The backend's cart API endpoint validates that products with variants must have `selected_options` provided, rejecting requests without this parameter.

3. **No Automatic Selection**: Unlike ProductDetailPage which has a comprehensive auto-selection mechanism (lines 700-750 in ProductDetailPage.tsx) that runs when a product loads, the DoNotForgetBar component has no logic to determine which variant combination to select.

4. **Price Calculation Complexity**: The system supports multiple pricing mechanisms (price_map for absolute per-combination prices, pot_price grids for component pricing, per-option price deltas), requiring careful calculation to find the truly least-priced combination.

## Correctness Properties

Property 1: Bug Condition - Auto-Select Least-Priced Variant

_For any_ product with variants where a user clicks "Add" in the DoNotForgetBar component, the fixed handleQuickAdd function SHALL automatically calculate the least-priced variant combination (considering price_map, pot_price grids, and per-option prices) and pass the selected option IDs as a string array to addItem's selected_options parameter, successfully adding the product to cart without error.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7**

Property 2: Preservation - Non-Variant Product Behavior

_For any_ product without variants where a user clicks "Add" in the DoNotForgetBar component, the fixed handleQuickAdd function SHALL produce exactly the same behavior as the original code, calling addItem without selected_options and successfully adding the product to cart.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**

## Fix Implementation

### Changes Required

The fix requires changes only in the DoNotForgetBar component to add automatic least-priced variant selection logic before calling `addItem`.

**File**: `frontend/src/components/cart/DoNotForgetBar.tsx`

**Function**: `handleQuickAdd`

**Specific Changes**:
1. **Import Price Calculation Utilities**: Import the necessary utilities from `@/lib/potPrice` (already used in ProductDetailPage):
   - `exactPotPrice`: Gets the exact pot price from the grid for a specific option combination
   - `gridGroupIds`: Extracts the group IDs that the pot_price grid covers

2. **Add Least-Priced Combo Calculation Function**: Create a helper function `findLeastPricedCombo` that:
   - Takes a Product with variants as input
   - Generates all possible variant combinations (cartesian product of variant_groups)
   - For each combination, calculates the total price using the same logic as ProductDetailPage:
     - If price_map exists and has a value for this combo_key, use that absolute price
     - Otherwise: base price + non-grid option deltas + pot_price grid cell (if applicable)
   - Returns the option IDs array (string[]) for the combination with the lowest price
   - On ties (multiple combos with same lowest price), returns the first one encountered

3. **Modify handleQuickAdd to Use Least-Priced Selection**: Update the function to:
   - Check if the product has variants (variants !== null and variant_groups.length > 0)
   - If yes, call `findLeastPricedCombo(product)` to get the selected_options array
   - If no, keep selected_options as null (existing behavior)
   - Pass the selected_options to `addItem` as the fourth parameter

4. **Build Cartesian Product Helper**: Create a helper function `buildComboRows` (mirroring ProductDetailPage's approach) that:
   - Takes variant_groups as input
   - Returns an array of objects with { key: string, optionIds: string[] }
   - Each entry represents one complete combination across all groups

5. **Calculate Combo Price Helper**: Create a helper function `calculateComboPrice` that:
   - Takes product, combo option IDs, and optionById map as input
   - Returns the total price for that combination
   - Implements the exact pricing chain: price_map → (base + non-grid deltas + grid cell)

### Detailed Implementation Plan

**Step 1**: Add imports at the top of DoNotForgetBar.tsx:
```typescript
import { exactPotPrice, gridGroupIds } from '@/lib/potPrice';
import type { VariantGroup, VariantOption, ProductVariants } from '@/types';
```

**Step 2**: Add helper functions before the component:
```typescript
function buildComboRows(groups: VariantGroup[]): { key: string; optionIds: string[] }[] {
  // Generate cartesian product of all variant options
  // Returns array of all possible combinations
}

function calculateComboPrice(
  product: Product,
  optionIds: string[],
  optionById: Record<string, VariantOption>,
  gridAxes: string[]
): number {
  // Calculate total price for this combination
  // Check price_map first, then fallback to base + deltas + pot_price
}

function findLeastPricedCombo(product: Product): string[] | null {
  // Main logic to find least-priced variant combination
  // Returns array of option IDs or null if no variants
}
```

**Step 3**: Modify handleQuickAdd to call the helper:
```typescript
async function handleQuickAdd(...) {
  // ... existing code ...
  
  // NEW: Auto-select least-priced variant if product has variants
  const selectedOptions = product.variants?.variant_groups?.length
    ? findLeastPricedCombo(fullProduct)
    : null;
  
  await addItem(productId, 1, fullProduct, selectedOptions);
  
  // ... rest of existing code ...
}
```

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm the root cause analysis.

**Test Plan**: Write tests that simulate clicking "Add" on products with variants in the DoNotForgetBar component. Run these tests on the UNFIXED code to observe failures and verify the backend error occurs.

**Test Cases**:
1. **Product with Size and Pot Type Variants**: Simulate clicking "Add" on a product with two variant groups (Size: Small/Medium/Large, Pot Type: Ceramic/Plastic) - will fail on unfixed code with backend error
2. **Product with Single Variant Group**: Simulate clicking "Add" on a product with one variant group (Color: Red/Blue/Green) - will fail on unfixed code
3. **Product with price_map**: Simulate clicking "Add" on a product with explicit price_map entries - will fail on unfixed code
4. **Product with pot_price Grid**: Simulate clicking "Add" on a product with a pot_price grid - will fail on unfixed code

**Expected Counterexamples**:
- Backend returns 400/422 error with message indicating variant selection is required
- Toast error displays: "Failed to add: variant selection required" (or similar)
- Possible causes: selected_options parameter is null/undefined when product has variants

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds (products with variants), the fixed function produces the expected behavior (auto-selects least-priced combination and adds successfully).

**Pseudocode:**
```
FOR ALL product WHERE isBugCondition(product) DO
  result := handleQuickAdd_fixed(product)
  ASSERT result.success = true
  ASSERT result.selectedOptions IS array of option IDs
  ASSERT result.selectedOptions represents least-priced combination
  ASSERT cart contains new item with correct selectedOptions
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold (products without variants, other add-to-cart flows), the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT handleQuickAdd_original(input) = handleQuickAdd_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain (different product types, price configurations)
- It catches edge cases that manual unit tests might miss (e.g., products with empty variant_groups array, null variants)
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for products without variants and other cart operations, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Product Without Variants Preservation**: Observe that products without variants add successfully on unfixed code, then verify this continues to work after fix with identical API calls
2. **Success Toast Preservation**: Verify success toast appears with correct message format after fix
3. **Cart Drawer Opening Preservation**: Verify cart drawer opens and page scrolls to top after fix
4. **Error Handling Preservation**: Verify error toasts display correctly for network errors, out-of-stock errors, etc.
5. **Loading State Preservation**: Verify loading spinner and button disabling work correctly during add operation

### Unit Tests

- Test `buildComboRows` generates correct cartesian product for 1, 2, and 3 variant groups
- Test `calculateComboPrice` correctly applies price_map when present
- Test `calculateComboPrice` correctly falls back to base + deltas + pot_price when price_map absent
- Test `calculateComboPrice` correctly excludes grid group deltas from summation
- Test `findLeastPricedCombo` returns correct option IDs for simple two-variant case
- Test `findLeastPricedCombo` handles ties (multiple combos with same price) by returning first
- Test `findLeastPricedCombo` returns null for products without variants
- Test `handleQuickAdd` calls addItem with null selectedOptions for non-variant products
- Test `handleQuickAdd` calls addItem with correct selectedOptions array for variant products

### Property-Based Tests

- Generate random product configurations with 1-4 variant groups, each with 2-5 options, verify findLeastPricedCombo always returns a valid combination
- Generate random price_map configurations, verify selected combination is truly the lowest priced
- Generate random pot_price grids, verify pot prices are correctly included in total calculation
- Generate random product mixes (with and without variants), verify preservation of non-variant product behavior across many scenarios
- Generate random error scenarios (network failures, backend errors), verify error handling is preserved

### Integration Tests

- Test full flow: click Add on variant product in DoNotForgetBar → verify cart contains item with correct selected_options
- Test full flow: click Add on non-variant product in DoNotForgetBar → verify cart contains item without selected_options
- Test that ProductDetailPage variant selection UI continues to work independently
- Test that manually selecting variants in ProductDetailPage and adding to cart still works correctly
- Test that cart drawer displays the auto-selected variant options correctly with proper labels
