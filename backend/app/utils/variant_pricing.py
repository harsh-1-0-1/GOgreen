"""Utility functions for flexible variant pricing and validation.

CRITICAL: All price calculations MUST use stored variant_groups data.
Never trust client-provided prices - always re-calculate server-side.
"""

from typing import Dict, List, Optional

from app.db.models import Product

STOCK_MAP_MISSING = "STOCK_MAP_MISSING"


class StockMapMissingError(ValueError):
    """Raised when a variant_groups product lacks a usable stock_map entry.

    Missing stock_map data is a bug (stale data / key mismatch / migration not run),
    not a condition to quietly work around. The API layer maps this to a 500 with the
    distinct STOCK_MAP_MISSING code so it is greppable and testable.
    """

    error_code = STOCK_MAP_MISSING


def build_combo_key(variant_groups: List[dict], selected_option_ids: List[str]) -> Optional[str]:
    """Build the canonical combo key: option IDs joined by '__' in variant_groups order.

    Mirrors the frontend buildComboRows ordering (ProductsAdminPage.tsx) so reservation,
    stock_map lookup, and image_map lookup all agree. Returns None when a group does not
    contribute exactly one selected option (e.g. partial selection).
    """
    if not variant_groups:
        return None
    parts = []
    for group in variant_groups:
        sel = [o for o in group.get("options", []) if o.get("id") in selected_option_ids]
        if len(sel) != 1:
            return None
        parts.append(sel[0]["id"])
    return "__".join(parts)


def build_dense_stock_map(variant_groups: List[dict]) -> Dict[str, int]:
    """Backfill a dense per-combination stock_map from per-option stocks.

    Walks the cartesian product of options (same iteration as the frontend buildComboRows,
    ignoring the cap) and assigns each combo row stock = min of the option stocks it
    references — reproducing the pre-migration per-option availability as the starting
    point. Used by the one-off migration, seed data, and tests.
    """
    keys = [""]
    for group in variant_groups:
        options = group.get("options", [])
        keys = [
            (f"{k}__{opt['id']}" if k else opt["id"])
            for k in keys
            for opt in options
        ]
        if not options:
            return {}

    stock_by_option = {}
    for group in variant_groups:
        for opt in group.get("options", []):
            stock_by_option[opt["id"]] = int(opt.get("stock", 0))

    return {
        key: min(stock_by_option[opt_id] for opt_id in key.split("__"))
        for key in keys
    }


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
    
    # Per-combination stock requires a full combo key: EVERY group must contribute
    # exactly one selection, required or not. `required` is retained in the schema as
    # documentation of intent; a missing selection is an incomplete-configuration
    # client error (400), never a StockMapMissingError data-integrity failure.
    for group_id, group_data in group_map.items():
        if group_id not in selection_by_group:
            raise ValueError(f"Please select an option for '{group_data['label']}'")
    
    # Calculate total price by summing selected option prices
    total_price = 0.0
    variant_snapshot = []  # For order denormalization
    selected_option_images = []
    
    for group_id, (group_label, option_data) in selection_by_group.items():
        option_price = float(option_data.get("price", 0))
        option_name = option_data.get("name", "")
        option_images = option_data.get("images", [])
        
        total_price += option_price
        
        # Build snapshot for order denormalization
        variant_snapshot.append({
            "label": group_label,
            "name": option_name,
            "price": option_price,
        })
        
        # Collect images from selected options
        if option_images:
            selected_option_images.extend(option_images)
    
    # Canonical combo key for per-combination stock lookup.
    # Every variant_groups product must carry a dense stock_map (migration is a
    # mandatory pre-deploy step). No fallback: a missing map/key is a bug and fails
    # loudly so it surfaces in logs instead of silently overselling.
    combo_key = build_combo_key(variant_groups, selected_options)
    stock_map = variants.get("stock_map")
    if not isinstance(stock_map, dict) or combo_key is None or combo_key not in stock_map:
        raise StockMapMissingError(
            f"Stock map missing for product '{product.name}' (id={product.id}, combo_key={combo_key!r})"
        )
    
    available_stock = int(stock_map.get(combo_key, 0) or 0)
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
        "combo_key": combo_key,  # Canonical key for reservation / image lookup
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
