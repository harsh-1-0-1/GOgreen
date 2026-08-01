"""Utility functions for flexible variant pricing and validation.

CRITICAL: All price calculations MUST use stored variant_groups data.
Never trust client-provided prices - always re-calculate server-side.
"""

from typing import Dict, List, Optional, Tuple

from app.db.models import Product


def calculate_variant_price(
    product: Product,
    selected_options: List[str],
    quantity: int = 1,
    *,
    validate_stock: bool = False,
) -> Dict:
    """Calculate price and validate selection for new flexible variant system.
    
    Args:
        product: Product with variants.variant_groups structure
        selected_options: List of option IDs (e.g., ["opt_1", "opt_3"])
        quantity: Quantity to check stock for
        validate_stock: Whether to validate stock availability
    
    Returns:
        Dict with keys: unit_price, selected_options, resolved_image_url, 
        available_stock, variant_snapshot (for order denormalization)
    
    Raises:
        ValueError: If selection is invalid or out of stock
    """
    variants = product.variants or {}
    
    # Check if it's the new flexible format
    if "variant_groups" not in variants:
        # Fallback to old format for backward compatibility during migration
        from app.services.cart_service import resolve_variant_details
        # Convert list to dict for old function
        old_format_options = _convert_to_old_format(selected_options, variants)
        return resolve_variant_details(product, old_format_options, quantity, validate_stock=validate_stock)
    
    variant_groups = variants.get("variant_groups", [])
    
    # No variant groups = simple product, use base price
    if not variant_groups:
        return {
            "unit_price": product.price,
            "selected_options": [],
            "resolved_image_url": _get_primary_image(product),
            "available_stock": product.stock_qty,
            "variant_snapshot": [],
        }
    
    # Build lookup maps
    option_map = {}  # option_id -> (group_id, group_label, option_data)
    group_map = {}   # group_id -> group_data
    
    for group in variant_groups:
        group_id = group.get("id")
        group_label = group.get("label", "")
        required = group.get("required", True)
        group_map[group_id] = {
            "label": group_label,
            "required": required,
            "options": {opt.get("id"): opt for opt in group.get("options", [])}
        }
        
        for option in group.get("options", []):
            option_id = option.get("id")
            option_map[option_id] = (group_id, group_label, option)
    
    # Validate all selected option IDs exist
    for opt_id in selected_options:
        if opt_id not in option_map:
            raise ValueError(f"Invalid option ID: {opt_id}")
    
    # Build selection by group
    selection_by_group = {}
    for opt_id in selected_options:
        group_id, group_label, option_data = option_map[opt_id]
        if group_id in selection_by_group:
            raise ValueError(f"Multiple options selected for group '{group_label}'")
        selection_by_group[group_id] = (group_label, option_data)
    
    # Validate required groups have selections
    for group_id, group_data in group_map.items():
        if group_data["required"] and group_id not in selection_by_group:
            raise ValueError(f"Please select an option for '{group_data['label']}'")
    
    # Calculate total price by summing selected option prices
    total_price = 0.0
    variant_snapshot = []  # For order denormalization
    selected_option_images = []
    min_stock = float('inf')
    
    for group_id, (group_label, option_data) in selection_by_group.items():
        option_price = float(option_data.get("price", 0))
        option_stock = int(option_data.get("stock", 0))
        option_name = option_data.get("name", "")
        option_images = option_data.get("images", [])
        
        total_price += option_price
        min_stock = min(min_stock, option_stock)
        
        # Build snapshot for order denormalization
        variant_snapshot.append({
            "label": group_label,
            "name": option_name,
            "price": option_price,
        })
        
        # Collect images from selected options
        if option_images:
            selected_option_images.extend(option_images)
    
    # Stock validation
    available_stock = int(min_stock) if min_stock != float('inf') else product.stock_qty
    if validate_stock:
        if available_stock <= 0:
            raise ValueError("Selected configuration is out of stock")
        if quantity > available_stock:
            raise ValueError(f"Only {available_stock} in stock for the selected configuration")
    
    # Determine image to display
    resolved_image = (
        (selected_option_images[0] if selected_option_images else None)
        or variants.get("default_image")
        or _get_primary_image(product)
    )
    
    return {
        "unit_price": round(total_price, 2),
        "selected_options": selected_options,
        "resolved_image_url": resolved_image,  # Will be resolved to full URL by serializer
        "available_stock": available_stock,
        "variant_snapshot": variant_snapshot,  # CRITICAL: For order denormalization
    }


def _get_primary_image(product: Product) -> str:
    """Get primary product image or placeholder."""
    return (product.images or [None])[0] or "https://placehold.co/600x600?text=Plant"


def _convert_to_old_format(selected_options: List[str], variants: dict) -> Optional[dict]:
    """Convert new format selection to old format for backward compatibility.
    
    This is temporary during migration period.
    """
    # This would need to map option IDs back to color/pot_type/size slugs
    # For now, return None to force old logic
    return None


def get_variant_snapshot_from_options(
    product: Product,
    selected_options: List[str],
) -> List[Dict]:
    """Extract variant snapshot for order denormalization without price calculation.
    
    Used when creating orders to store {label, name, price} for historical display.
    """
    result = calculate_variant_price(product, selected_options, quantity=1, validate_stock=False)
    return result.get("variant_snapshot", [])
