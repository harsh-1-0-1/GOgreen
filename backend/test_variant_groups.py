#!/usr/bin/env python3
"""Test script for Phase 1: Backend variant groups implementation.

Tests:
1. Schema validation (groups, options, IDs, prices)
2. Price calculation (sum of selected options)
3. Stock validation
4. Zero groups (simple product)
5. Order denormalization
"""

import asyncio
import sys
from pydantic import ValidationError

# Test 1: Schema Validation
def test_schema_validation():
    """Test Pydantic schema validation for variant groups."""
    from app.schemas.product import VariantOption, VariantGroup, ProductVariantsNew, validate_variant_structure
    
    print("=" * 80)
    print("TEST 1: Schema Validation")
    print("=" * 80)
    
    # Test valid option
    try:
        option = VariantOption(name="4 Inch", price=1499, stock=20)
        assert option.name == "4 Inch"
        assert option.price == 1499
        assert option.stock == 20
        assert option.id.startswith("opt_")
        print("✓ Valid option created successfully")
    except Exception as e:
        print(f"✗ Failed to create valid option: {e}")
        return False
    
    # Test invalid option (negative price)
    try:
        invalid_option = VariantOption(name="Test", price=-100, stock=10)
        print("✗ Negative price should have been rejected")
        return False
    except ValidationError:
        print("✓ Negative price correctly rejected")
    
    # Test invalid option (empty name)
    try:
        invalid_option = VariantOption(name="", price=100, stock=10)
        print("✗ Empty name should have been rejected")
        return False
    except ValidationError:
        print("✓ Empty name correctly rejected")
    
    # Test valid group
    try:
        group = VariantGroup(
            label="Select Size",
            options=[
                VariantOption(name="Small", price=499, stock=10),
                VariantOption(name="Large", price=799, stock=5),
            ]
        )
        assert group.label == "Select Size"
        assert len(group.options) == 2
        assert group.id.startswith("vg_")
        print("✓ Valid group created successfully")
    except Exception as e:
        print(f"✗ Failed to create valid group: {e}")
        return False
    
    # Test invalid group (empty label)
    try:
        invalid_group = VariantGroup(
            label="",
            options=[VariantOption(name="Test", price=100, stock=10)]
        )
        print("✗ Empty label should have been rejected")
        return False
    except ValidationError:
        print("✓ Empty label correctly rejected")
    
    # Test invalid group (no options)
    try:
        invalid_group = VariantGroup(label="Test", options=[])
        print("✗ Empty options should have been rejected")
        return False
    except ValidationError:
        print("✓ Empty options correctly rejected")
    
    # Test full variants structure
    try:
        variants = ProductVariantsNew(
            variant_groups=[
                VariantGroup(
                    label="Select Size",
                    options=[
                        VariantOption(name="4 Inch", price=1499, stock=20),
                        VariantOption(name="5 Inch", price=1699, stock=15),
                    ]
                ),
                VariantGroup(
                    label="Select Pot Colour",
                    options=[
                        VariantOption(name="Terracotta", price=0, stock=10),
                        VariantOption(name="Sage Green", price=0, stock=12),
                    ]
                ),
            ],
            default_image="default.jpg"
        )
        assert len(variants.variant_groups) == 2
        print("✓ Full variants structure validated successfully")
    except Exception as e:
        print(f"✗ Failed to validate full structure: {e}")
        return False
    
    # Test duplicate group IDs
    try:
        group_id = "vg_duplicate"
        invalid_variants = ProductVariantsNew(
            variant_groups=[
                VariantGroup(id=group_id, label="Group 1", options=[VariantOption(name="A", price=100, stock=10)]),
                VariantGroup(id=group_id, label="Group 2", options=[VariantOption(name="B", price=200, stock=10)]),
            ]
        )
        print("✗ Duplicate group IDs should have been rejected")
        return False
    except ValidationError:
        print("✓ Duplicate group IDs correctly rejected")
    
    # Test duplicate option IDs across groups
    try:
        opt_id = "opt_duplicate"
        invalid_variants = ProductVariantsNew(
            variant_groups=[
                VariantGroup(label="Group 1", options=[VariantOption(id=opt_id, name="A", price=100, stock=10)]),
                VariantGroup(label="Group 2", options=[VariantOption(id=opt_id, name="B", price=200, stock=10)]),
            ]
        )
        print("✗ Duplicate option IDs should have been rejected")
        return False
    except ValidationError:
        print("✓ Duplicate option IDs correctly rejected")
    
    print("\nTest 1: PASSED ✓\n")
    return True


# Test 2: Price Calculation
def test_price_calculation():
    """Test server-side price calculation from variant groups."""
    from app.db.models import Product
    from app.utils.variant_pricing import calculate_variant_price
    
    print("=" * 80)
    print("TEST 2: Price Calculation")
    print("=" * 80)
    
    # Create mock product with new variant format
    product = Product(
        id=1,
        name="Test Plant",
        price=0,  # Base price not used in new format
        stock_qty=100,
        category_id=1,
        variants={
            "variant_groups": [
                {
                    "id": "vg_size",
                    "label": "Select Size",
                    "options": [
                        {"id": "opt_small", "name": "Small", "price": 499, "stock": 20},
                        {"id": "opt_large", "name": "Large", "price": 799, "stock": 10},
                    ]
                },
                {
                    "id": "vg_color",
                    "label": "Select Pot Colour",
                    "options": [
                        {"id": "opt_terracotta", "name": "Terracotta", "price": 0, "stock": 15},
                        {"id": "opt_green", "name": "Sage Green", "price": 50, "stock": 12},
                    ]
                },
            ]
        }
    )
    
    # Test: Small + Terracotta = 499 + 0 = 499
    try:
        result = calculate_variant_price(product, ["opt_small", "opt_terracotta"])
        assert result["unit_price"] == 499, f"Expected 499, got {result['unit_price']}"
        assert result["available_stock"] == 15  # Min of selected options
        assert len(result["variant_snapshot"]) == 2
        print(f"✓ Price calculation correct: Small + Terracotta = ₹{result['unit_price']}")
    except Exception as e:
        print(f"✗ Price calculation failed: {e}")
        return False
    
    # Test: Large + Sage Green = 799 + 50 = 849
    try:
        result = calculate_variant_price(product, ["opt_large", "opt_green"])
        assert result["unit_price"] == 849, f"Expected 849, got {result['unit_price']}"
        assert result["available_stock"] == 10  # Min of selected options
        print(f"✓ Price calculation correct: Large + Sage Green = ₹{result['unit_price']}")
    except Exception as e:
        print(f"✗ Price calculation failed: {e}")
        return False
    
    # Test: Invalid option ID
    try:
        result = calculate_variant_price(product, ["opt_invalid", "opt_terracotta"])
        print("✗ Invalid option ID should have been rejected")
        return False
    except ValueError as e:
        print(f"✓ Invalid option ID correctly rejected: {e}")
    
    # Test: Missing required group
    try:
        result = calculate_variant_price(product, ["opt_small"])  # Missing color selection
        print("✗ Missing required group should have been rejected")
        return False
    except ValueError as e:
        print(f"✓ Missing required group correctly rejected: {e}")
    
    # Test: Multiple options from same group
    try:
        result = calculate_variant_price(product, ["opt_small", "opt_large", "opt_terracotta"])
        print("✗ Multiple options from same group should have been rejected")
        return False
    except ValueError as e:
        print(f"✓ Multiple options from same group correctly rejected: {e}")
    
    print("\nTest 2: PASSED ✓\n")
    return True


# Test 3: Stock Validation
def test_stock_validation():
    """Test stock validation during price calculation."""
    from app.db.models import Product
    from app.utils.variant_pricing import calculate_variant_price
    
    print("=" * 80)
    print("TEST 3: Stock Validation")
    print("=" * 80)
    
    product = Product(
        id=1,
        name="Test Plant",
        price=0,
        stock_qty=100,
        category_id=1,
        variants={
            "variant_groups": [
                {
                    "id": "vg_size",
                    "label": "Select Size",
                    "options": [
                        {"id": "opt_small", "name": "Small", "price": 499, "stock": 5},
                        {"id": "opt_large", "name": "Large", "price": 799, "stock": 0},
                    ]
                },
            ]
        }
    )
    
    # Test: Available stock
    try:
        result = calculate_variant_price(product, ["opt_small"], quantity=3, validate_stock=True)
        assert result["available_stock"] == 5
        print("✓ Stock available: 3 units of 5 allowed")
    except Exception as e:
        print(f"✗ Stock validation failed: {e}")
        return False
    
    # Test: Insufficient stock
    try:
        result = calculate_variant_price(product, ["opt_small"], quantity=10, validate_stock=True)
        print("✗ Insufficient stock should have been rejected")
        return False
    except ValueError as e:
        print(f"✓ Insufficient stock correctly rejected: {e}")
    
    # Test: Out of stock
    try:
        result = calculate_variant_price(product, ["opt_large"], quantity=1, validate_stock=True)
        print("✗ Out of stock should have been rejected")
        return False
    except ValueError as e:
        print(f"✓ Out of stock correctly rejected: {e}")
    
    print("\nTest 3: PASSED ✓\n")
    return True


# Test 4: Zero Groups (Simple Product)
def test_zero_groups():
    """Test products with no variant groups (simple products)."""
    from app.db.models import Product
    from app.utils.variant_pricing import calculate_variant_price
    
    print("=" * 80)
    print("TEST 4: Zero Groups (Simple Product)")
    print("=" * 80)
    
    # Product with no variants
    product = Product(
        id=1,
        name="Simple Product",
        price=599,
        stock_qty=50,
        category_id=1,
        variants=None
    )
    
    try:
        result = calculate_variant_price(product, [])
        assert result["unit_price"] == 599
        assert result["available_stock"] == 50
        # For old format (no variant_groups), returns None for selected_options
        assert result["selected_options"] in ([], None)
        assert "variant_snapshot" not in result or result["variant_snapshot"] == []
        print("✓ Simple product (no variants) handled correctly")
    except Exception as e:
        print(f"✗ Simple product failed: {e}")
        return False
    
    # Product with empty variant_groups array
    product2 = Product(
        id=2,
        name="Product with empty groups",
        price=699,
        stock_qty=30,
        category_id=1,
        variants={"variant_groups": []}
    )
    
    try:
        result = calculate_variant_price(product2, [])
        assert result["unit_price"] == 699
        assert result["available_stock"] == 30
        print("✓ Product with empty variant_groups handled correctly")
    except Exception as e:
        print(f"✗ Empty variant_groups failed: {e}")
        return False
    
    print("\nTest 4: PASSED ✓\n")
    return True


# Test 5: Variant Snapshot for Orders
def test_variant_snapshot():
    """Test variant snapshot generation for order denormalization."""
    from app.db.models import Product
    from app.utils.variant_pricing import calculate_variant_price
    
    print("=" * 80)
    print("TEST 5: Variant Snapshot for Orders")
    print("=" * 80)
    
    product = Product(
        id=1,
        name="Test Plant",
        price=0,
        stock_qty=100,
        category_id=1,
        variants={
            "variant_groups": [
                {
                    "id": "vg_size",
                    "label": "Select Size",
                    "options": [
                        {"id": "opt_4in", "name": "4 Inch", "price": 1499, "stock": 20},
                    ]
                },
                {
                    "id": "vg_color",
                    "label": "Select Pot Colour",
                    "options": [
                        {"id": "opt_terra", "name": "Terracotta", "price": 0, "stock": 15},
                    ]
                },
            ]
        }
    )
    
    try:
        result = calculate_variant_price(product, ["opt_4in", "opt_terra"])
        snapshot = result["variant_snapshot"]
        
        assert len(snapshot) == 2, f"Expected 2 snapshot entries, got {len(snapshot)}"
        
        # Check first entry
        assert snapshot[0]["label"] == "Select Size"
        assert snapshot[0]["name"] == "4 Inch"
        assert snapshot[0]["price"] == 1499
        
        # Check second entry
        assert snapshot[1]["label"] == "Select Pot Colour"
        assert snapshot[1]["name"] == "Terracotta"
        assert snapshot[1]["price"] == 0
        
        print("✓ Variant snapshot structure correct:")
        for entry in snapshot:
            print(f"  - {entry['label']}: {entry['name']} (₹{entry['price']})")
        
        print("✓ Snapshot can be stored in order for historical display")
        
    except Exception as e:
        print(f"✗ Variant snapshot failed: {e}")
        return False
    
    print("\nTest 5: PASSED ✓\n")
    return True


def main():
    """Run all Phase 1 tests."""
    print("\n")
    print("╔" + "=" * 78 + "╗")
    print("║" + " " * 20 + "PHASE 1: BACKEND FOUNDATION TESTS" + " " * 25 + "║")
    print("╚" + "=" * 78 + "╝")
    print()
    
    tests = [
        ("Schema Validation", test_schema_validation),
        ("Price Calculation", test_price_calculation),
        ("Stock Validation", test_stock_validation),
        ("Zero Groups", test_zero_groups),
        ("Variant Snapshot", test_variant_snapshot),
    ]
    
    results = []
    for test_name, test_func in tests:
        try:
            passed = test_func()
            results.append((test_name, passed))
        except Exception as e:
            print(f"\n✗ {test_name} crashed: {e}\n")
            results.append((test_name, False))
    
    # Summary
    print("=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    passed_count = sum(1 for _, passed in results if passed)
    total_count = len(results)
    
    for test_name, passed in results:
        status = "✓ PASSED" if passed else "✗ FAILED"
        print(f"{test_name:.<50} {status}")
    
    print("-" * 80)
    print(f"Total: {passed_count}/{total_count} tests passed")
    print("=" * 80)
    
    if passed_count == total_count:
        print("\n🎉 ALL TESTS PASSED! Phase 1 backend implementation is complete.\n")
        return 0
    else:
        print(f"\n⚠️  {total_count - passed_count} test(s) failed. Please review and fix.\n")
        return 1


if __name__ == "__main__":
    sys.exit(main())
