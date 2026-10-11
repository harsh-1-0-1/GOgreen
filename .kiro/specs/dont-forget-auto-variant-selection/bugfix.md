# Bugfix Requirements Document

## Introduction

This document describes the requirements for fixing a bug in the "Don't Forget to Buy" section of the shopping cart. Currently, when users click the "Add" button on a product that has variants (such as different sizes or pot styles), the system throws an error because no variant option is selected. The fix will automatically select the least-priced variant combination when adding such products to the cart, ensuring a smooth user experience.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a user clicks "Add" on a product with variants in the DoNotForgetBar component THEN the system throws a variant selection error from the backend

1.2 WHEN a user clicks "Add" on a product with variants that requires variant options THEN the addItem function is called without the selected_options parameter

1.3 WHEN a product with variants is added without selected_options THEN the backend rejects the request with an error indicating variant selection is required

### Expected Behavior (Correct)

2.1 WHEN a user clicks "Add" on a product with variants in the DoNotForgetBar component THEN the system SHALL automatically select the least-priced variant combination and add it to the cart without error

2.2 WHEN determining the least-priced variant combination THEN the system SHALL consider all variant groups and their options to find the combination with the lowest total price

2.3 WHEN a product with variants has a price_map (per-combination absolute prices) THEN the system SHALL use the price_map to determine the least-priced combination

2.4 WHEN a product with variants does not have a price_map THEN the system SHALL sum the per-option prices from all variant groups to determine the least-priced combination

2.5 WHEN a product with a pot_price grid is added THEN the system SHALL include the pot_price component in the total price calculation for finding the least-priced combination

2.6 WHEN multiple variant combinations have the same lowest price THEN the system SHALL select the first one encountered (by variant group and option order)

2.7 WHEN the least-priced variant combination is determined THEN the system SHALL pass the selected option IDs as a string array to the addItem function's selected_options parameter

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a user clicks "Add" on a product without variants in the DoNotForgetBar component THEN the system SHALL CONTINUE TO add the product to the cart without requiring selected_options

3.2 WHEN a product is added successfully from the DoNotForgetBar THEN the system SHALL CONTINUE TO show a success toast message

3.3 WHEN a product is added successfully from the DoNotForgetBar THEN the system SHALL CONTINUE TO open the cart drawer and scroll to the top of the page

3.4 WHEN an error occurs during the add operation THEN the system SHALL CONTINUE TO display an error toast with the API error detail

3.5 WHEN a product is being added (loading state) THEN the system SHALL CONTINUE TO show a loading spinner on the Add button and disable the button

3.6 WHEN a user adds a product from other parts of the application (not DoNotForgetBar) THEN the system SHALL CONTINUE TO work as it currently does without automatic variant selection
