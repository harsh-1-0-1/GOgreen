"""Project a full-combo `price_map` down to a subset-axis component grid (§5.8 step 1).

Peace lily already stores its pot matrix inside `price_map`: 18 full-combination keys that
repeat the same 6 pot amounts once per colour. This module derives the 6-cell grid from
those 18 values so the merchant never retypes them, and audits the 12 redundant cells on the
way through.

The agreement check is the valuable part. It is the only automated audit of those redundant
cells, and it turns "18 numbers maintained by hand" into "6 numbers, checked for drift".
A disagreement is a live pricing error, so it is reported and NOT resolved here — picking one
of the values automatically would hide it. Resolution is a merchant decision.
"""

import itertools
from typing import Dict, List, Optional, Tuple

from app.schemas.product import COMBO_KEY_SEP


class PotPriceConflictError(ValueError):
    """A grid cell carries different values across the excluded axes.

    Distinct type so the API returns 422: the projection is computable, but answering it
    automatically would mean silently choosing a price the merchant never agreed to.
    """

    def __init__(self, conflicts: Dict[str, List[float]], detail: str = ""):
        self.conflicts = conflicts
        keys = ", ".join(sorted(conflicts)[:5])
        more = f" (+{len(conflicts) - 5} more)" if len(conflicts) > 5 else ""
        super().__init__(
            detail
            or (
                "Cannot build the price grid automatically: these combinations have "
                f"different values for the same selection — {keys}{more}. Choose which "
                "value to keep for each, then save."
            )
        )


def _option_ids(groups: List[dict]) -> Dict[str, List[str]]:
    return {g["id"]: [o["id"] for o in g.get("options", [])] for g in groups if g.get("id")}


def project_price_map_to_pot_grid(
    price_map: Dict[str, float],
    group_ids: List[str],
    variant_groups: List[dict],
) -> Tuple[Dict[str, float], Dict[str, List[float]]]:
    """Derive a subset-axis grid from a full-combo price_map.

    Returns (grid, conflicts). Cells whose values agree across every combination of the
    EXCLUDED axes are projected; cells that disagree appear in `conflicts` and are left out
    of `grid` entirely, so a caller cannot accidentally persist an auto-chosen value.

    Axis order is taken from `variant_groups`, NOT from `group_ids`, because full keys are
    built in product group order. Using the caller's order would look up the wrong keys and
    silently project nothing.
    """
    opts = _option_ids(variant_groups)
    order = [g["id"] for g in variant_groups if g.get("id")]

    grid_axes = [gid for gid in order if gid in group_ids]
    other_axes = [gid for gid in order if gid not in group_ids]
    if not grid_axes:
        return {}, {}

    grid: Dict[str, float] = {}
    conflicts: Dict[str, List[float]] = {}

    for combo in itertools.product(*[opts[gid] for gid in grid_axes]):
        chosen = dict(zip(grid_axes, combo))
        seen: set[float] = set()
        for tail in itertools.product(*[opts[gid] for gid in other_axes]):
            it = iter(tail)
            full_key = COMBO_KEY_SEP.join(
                chosen[gid] if gid in group_ids else next(it) for gid in order
            )
            raw = price_map.get(full_key)
            if raw is None:
                continue
            try:
                seen.add(float(raw))
            except (TypeError, ValueError):
                continue
        if not seen:
            continue
        key = COMBO_KEY_SEP.join(chosen[gid] for gid in grid_axes)
        if len(seen) == 1:
            grid[key] = next(iter(seen))
        else:
            conflicts[key] = sorted(seen)

    return grid, conflicts


def project_or_raise(
    price_map: Optional[Dict[str, float]],
    group_ids: List[str],
    variant_groups: List[dict],
) -> Dict[str, float]:
    """Projection that refuses to guess. Raises PotPriceConflictError on any disagreement."""
    grid, conflicts = project_price_map_to_pot_grid(
        price_map or {}, group_ids, variant_groups
    )
    if conflicts:
        raise PotPriceConflictError(conflicts)
    return grid
