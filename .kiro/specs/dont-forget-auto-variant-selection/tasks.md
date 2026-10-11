# Implementation Plan

## Overview

This task list implements the bugfix for automatic variant selection in the "Don't Forget to Buy" section. The implementation follows the bug condition methodology: first write exploratory tests to surface the bug on unfixed code, then implement the fix with helper functions for price calculation, and finally verify with property-based tests that the fix works and preserves all existing behavior.

## Tasks

- [ ] 1. Write bug condition exploration property test that demonstrates the bug on unfixed code by attempting to add products with variants from DoNotForgetBar without providing selected_options
  - [x] 1.1. Generate products with 1-3 variant groups, each with 2-4 options
  - [~] 1.2. Simulate clicking "Add" button in DoNotForgetBar component  
  - [~] 1.3. Capture backend error response (400/422 status with variant selection required message)
  - [~] 1.4. Confirm selected_options parameter is null/undefined when bug occurs
  - [~] 1.5. Run test on UNFIXED code and surface counterexamples showing the bug
  - [~] 1.6. Document specific error messages and conditions that trigger the bug

- [ ] 2. Implement helper function to build variant combinations (buildComboRows)
  - [~] 2.1. Create function that takes variant_groups array as input
  - [~] 2.2. Return array of objects with { key: string, optionIds: string[] }
  - [~] 2.3. Each entry represents one complete combination across all groups
  - [~] 2.4. Combo key is option IDs joined by "__" in variant_group order
  - [~] 2.5. Handle 1-4 variant groups correctly
  - [~] 2.6. Write unit tests to verify correct cartesian product for various group configurations

- [ ] 3. Implement helper function to calculate combination price (calculateComboPrice)
  - [~] 3.1. Create function that takes product, option IDs array, optionById map, and grid axes as input
  - [~] 3.2. Return total price as a number
  - [~] 3.3. Check price_map first - if combo_key exists in price_map, return that absolute price
  - [~] 3.4. Implement fallback calculation: base price + non-grid option deltas + pot_price grid cell (if applicable)
  - [~] 3.5. Correctly exclude grid group option deltas from summation when pot_price grid exists
  - [~] 3.6. Use exactPotPrice and gridGroupIds from @/lib/potPrice
  - [~] 3.7. Write unit tests to verify correct prices for various product configurations

- [ ] 4. Implement findLeastPricedCombo function
  - [~] 4.1. Create function that takes Product as input
  - [~] 4.2. Return string[] of option IDs for least-priced combination, or null if no variants
  - [~] 4.3. Use buildComboRows to generate all possible combinations
  - [~] 4.4. Use calculateComboPrice to get price for each combination
  - [~] 4.5. Return first combination encountered when multiple have same lowest price (tie-breaking)
  - [~] 4.6. Handle products without variants by returning null
  - [~] 4.7. Handle empty variant_groups array by returning null
  - [~] 4.8. Write unit tests to verify correct least-priced selection
  - [~] 4.9. Write property-based tests to verify selected combination is always valid and truly lowest priced

- [ ] 5. Update handleQuickAdd to use automatic variant selection
  - [~] 5.1. Add imports for exactPotPrice, gridGroupIds, and type imports
  - [~] 5.2. Check if product has variants (variants !== null and variant_groups.length > 0)
  - [~] 5.3. Call findLeastPricedCombo when product has variants
  - [~] 5.4. Keep selectedOptions as null when product has no variants
  - [~] 5.5. Pass selectedOptions as fourth parameter to addItem
  - [~] 5.6. Preserve all existing behavior: success toast, cart drawer opening, error handling, loading state
  - [~] 5.7. Keep variants: null in fullProduct object construction
  - [~] 5.8. Ensure code follows existing code style

- [ ] 6. Write fix checking property tests
  - [~] 6.1. Generate random products with variants (1-4 groups, 2-5 options each)
  - [~] 6.2. Simulate clicking "Add" in DoNotForgetBar on FIXED code
  - [~] 6.3. Verify addItem is called with correct selectedOptions array
  - [~] 6.4. Verify cart contains new item with correct selected_options
  - [~] 6.5. Verify selected combination is the least-priced one
  - [~] 6.6. Handle products with price_map correctly
  - [~] 6.7. Handle products with pot_price grids correctly
  - [~] 6.8. Confirm tests pass on FIXED code demonstrating bug is resolved

- [ ] 7. Write preservation checking property tests
  - [~] 7.1. Generate products WITHOUT variants
  - [~] 7.2. Verify these products still add to cart successfully with null selected_options
  - [~] 7.3. Verify success toast message format is unchanged
  - [~] 7.4. Verify cart drawer opens and page scrolls to top
  - [~] 7.5. Verify error handling works correctly (network errors, stock errors, etc.)
  - [~] 7.6. Verify loading spinner and button disabling work correctly
  - [~] 7.7. Use property-based approach to generate many test cases automatically
  - [~] 7.8. Confirm tests pass on both UNFIXED and FIXED code with identical results for non-variant products

- [ ] 8. Write integration tests for full add-to-cart flow
  - [~] 8.1. Test full flow: click Add on variant product → verify cart item with correct selected_options
  - [~] 8.2. Test full flow: click Add on non-variant product → verify cart item without selected_options
  - [~] 8.3. Test that cart drawer displays auto-selected variant options with proper labels
  - [~] 8.4. Test that ProductDetailPage variant selection UI continues to work independently
  - [~] 8.5. Test that manually selecting variants elsewhere still works correctly
  - [~] 8.6. Make integration tests interact with actual React components and cart store
  - [~] 8.7. Verify API calls are made with correct payloads

## Notes

- Task 1 (bug exploration) is expected to FAIL on unfixed code - this is the success case that confirms the bug exists
- Tasks 2-5 implement the fix in a modular way with helper functions
- Tasks 6-8 verify the fix works and preserves all existing behavior
- Property-based testing is used extensively to catch edge cases and provide strong correctness guarantees
- The fix is minimal and targeted - only DoNotForgetBar component is modified
