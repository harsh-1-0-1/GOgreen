"""Utility functions for flexible variant pricing and validation.

CRITICAL: All price calculations MUST use stored variant_groups data.
Never trust client-provided prices - always re-calculate server-side.
"""

from typing import Dict, List, NamedTuple, Optional, Tuple

from app.db.models import Product
from app.schemas.product import COMBO_KEY_SEP

STOCK_MAP_MISSING = "STOCK_MAP_MISSING"


class PotPriceResolution(NamedTuple):
    """A resolved grid cell. `exact` is min == max, so callers render one number."""
    min: float
    max: float
    exact: bool


def resolve_pot_price(
    group_ids: List[str],
    price_map: Optional[Dict[str, float]],
    selected: Dict[str, str],
) -> Optional[PotPriceResolution]:
    """Resolve the component grid to one value or a range.

    N-axis: nothing here knows how many groups there are or what they are called. Scans every
    cell consistent with whatever IS selected, so a partial selection yields the range the
    customer could pay rather than a guess. Returns None when nothing matches — callers MUST
    treat that as "unknown" and fall through, never as zero.

    Mirrors frontend/src/lib/potPrice.ts::resolvePotPrice. The two are hand-written
    implementations of one rule with no shared test, so a divergence means the storefront
    advertises one price and checkout charges another. Change both together.
    """
    if not group_ids or not price_map:
        return None
    active_idx = [i for i, gid in enumerate(group_ids) if selected.get(gid)]
    if not active_idx:
        return None

    lo, hi = float("inf"), float("-inf")
    for key, raw in price_map.items():
        parts = key.split(COMBO_KEY_SEP)
        # Defensive: a full-combo price_map/stock_map key has the wrong length and can never
        # resolve here. Ignoring is correct — those keys mean something else entirely.
        if len(parts) != len(group_ids):
            continue
        if not all(parts[i] == selected[group_ids[i]] for i in active_idx):
            continue
        try:
            n = float(raw)
        except (TypeError, ValueError):
            continue
        lo, hi = min(lo, n), max(hi, n)
    if lo == float("inf"):
        return None
    return PotPriceResolution(min=lo, max=hi, exact=lo == hi)


def exact_pot_price(
    group_ids: List[str],
    price_map: Optional[Dict[str, float]],
    selected: Dict[str, str],
) -> Optional[float]:
    """The grid value as a number, or None when it is not exactly determined.

    Under `additive` a RANGED value must never be charged — silently taking min would
    under-charge the expensive pots — so anything needing a number uses this and handles
    None by falling through.
    """
    r = resolve_pot_price(group_ids, price_map, selected)
    if r is None or not r.exact:
        return None
    return r.min


def pot_price_group_ids(variants: dict) -> List[str]:
    """Axis IDs this product's grid prices, in canonical order. Empty when unconfigured."""
    pp = (variants or {}).get("pot_price")
    if not isinstance(pp, dict):
        return []
    gids = pp.get("group_ids")
    return list(gids) if isinstance(gids, list) and gids else []


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


def build_dense_price_map(
    variant_groups: List[dict],
    overrides: Optional[Dict[str, float]] = None,
) -> Dict[str, float]:
    """Backfill a dense per-combination price_map.

    Walks the cartesian product of options (same iteration as the frontend buildComboRows,
    ignoring the cap) and assigns each combo row price = sum of its options' prices, with
    any supplied override applied per key. Used by the admin save path and tests.
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

    price_by_option = {}
    for group in variant_groups:
        for opt in group.get("options", []):
            price_by_option[opt["id"]] = float(opt.get("price", 0) or 0)

    overrides = overrides or {}
    return {
        key: float(overrides.get(key, sum(price_by_option[opt_id] for opt_id in key.split("__"))))
        for key in keys
    }


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
    selected_by_group_id = {}
    for opt_id in selected_options:
        group_id, group_label, option_data = option_map[opt_id]
        if group_id in selection_by_group:
            raise ValueError(f"Multiple options selected for group '{group_label}'")
        selection_by_group[group_id] = (group_label, option_data)
        selected_by_group_id[group_id] = opt_id
    
    # Per-combination stock requires a full combo key: EVERY group must contribute
    # exactly one selection, required or not. `required` is retained in the schema as
    # documentation of intent; a missing selection is an incomplete-configuration
    # client error (400), never a StockMapMissingError data-integrity failure.
    for group_id, group_data in group_map.items():
        if group_id not in selection_by_group:
            raise ValueError(f"Please select an option for '{group_data['label']}'")
    
    # Deltas split by MEMBERSHIP of the pot grid, not by value. A group the grid prices
    # already has its amount in the matrix, so adding its own `options[].price` on top
    # would double-charge it — the exact defect the §5.5a save gate exists to prevent.
    # Excluding by membership (rather than skipping zero values) means a ₹0 delta in a
    # grid group is still excluded.
    grid_gids = pot_price_group_ids(variants)
    grid_gid_set = set(grid_gids)

    # Per-option deltas from groups the grid does not price. NOTE: deltas are increments on
    # top of `product.price`, never a product total. Summing only deltas was once the final
    # fallback, which silently undercharged every variant product: a ₹249 plant whose only
    # surcharge was ₹150 was charged ₹150, and a product with no surcharges was free. The
    # base price is added explicitly on every branch below.
    non_grid_delta_total = 0.0
    variant_snapshot = []  # For order denormalization
    selected_option_images = []

    for group_id, (group_label, option_data) in selection_by_group.items():
        option_price = float(option_data.get("price", 0))
        option_name = option_data.get("name", "")
        option_images = option_data.get("images", [])

        if group_id not in grid_gid_set:
            non_grid_delta_total += option_price

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

    # Per-combination price: variants.price_map[combo_key] wins when present (admin sets
    # it per row in the combinations table). Otherwise fall back to the summed per-option
    # prices so products that haven't been migrated keep their existing behavior.
    price_map = variants.get("price_map")
    explicit_price = price_map.get(combo_key) if isinstance(price_map, dict) else None

    # The component grid, resolved for this exact selection. None means unknown (partial
    # selection, unfilled cell, or unconfigured) and is NOT zero.
    pot_price_cfg = variants.get("pot_price") if isinstance(variants.get("pot_price"), dict) else {}
    pot_map = pot_price_cfg.get("map") if isinstance(pot_price_cfg.get("map"), dict) else None
    pot_value = exact_pot_price(grid_gids, pot_map, selected_by_group_id)

    # §5.4 chain, in order. price_map is an ABSOLUTE override and wins outright — which is
    # why retiring it is inseparable from switching `additive` on (see VARIANT_PRICE_PLAN §5.8):
    # remove it first and the total falls through to the delta sum; leave it after and it
    # keeps winning, so the grid silently does nothing.
    grid_charged = False

    if explicit_price is not None:
        combo_price = float(explicit_price)
    elif pot_value is not None:
        # Base plant price + deltas from groups the grid does NOT price + the grid cell.
        # A ranged grid value yields None above and is never charged, rather than
        # under-charging by silently taking the minimum.
        combo_price = float(product.price or 0) + non_grid_delta_total + pot_value
        grid_charged = True
    else:
        # No price grid on this product at all, so the base price IS the price. This branch
        # used to bill `total_price` (the bare sum of option deltas), which is not a product
        # total: deltas are increments on top of `product.price`, so the base was silently
        # dropped. A ₹249 plant whose only surcharge was ₹150 was charged ₹150, and a
        # product with no surcharges at all was free. With per-option prices retired in the
        # admin, the delta sum is always ₹0, so this branch is the difference between a
        # product being priced and being given away.
        combo_price = float(product.price or 0) + non_grid_delta_total

    # Order records must reconcile with the amount actually charged, or an internally
    # inconsistent order is impossible to audit later.
    #
    # Two things the per-option deltas alone do not capture:
    #   1. the base plant price — deltas are increments on top of it, and summing only
    #      deltas leaves the snapshot short by exactly `product.price`;
    #   2. the resolved grid cell.
    # Both are appended ONLY when the grid is what decided the price. If `price_map`
    # overrode the total, the grid amount was never billed, and recording it would
    # overstate the order by the full pot price.
    if grid_charged:
        variant_snapshot.insert(0, {
            "label": "Plant",
            "name": getattr(product, "name", None) or "Base price",
            "price": float(product.price or 0),
        })
        if pot_value and pot_value > 0:
            variant_snapshot.append({
                "label": pot_price_cfg.get("label") or "Pot price",
                "name": pot_price_cfg.get("name") or "Component charge",
                "price": pot_value,
            })
    
    # Determine image to display
    resolved_image = (
        (selected_option_images[0] if selected_option_images else None)
        or variants.get("default_image")
        or _get_primary_image(product)
    )
    
    return {
        "unit_price": round(combo_price, 2),
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
