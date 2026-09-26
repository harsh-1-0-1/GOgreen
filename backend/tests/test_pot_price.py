"""Tests for the component (pot) price grid.

Covers the §5.4 chain, the N-axis resolver, the order-snapshot reconciliation, and the
18 → 6 migration projection including a deliberately seeded conflict.

The migration conflict path is exercised on a fixture rather than on real data, because
Peace lily's 18 values all agree — the conflict branch would otherwise ship untested.
"""

import pytest

from app.utils.pot_price_migration import project_price_map_to_pot_grid
from app.utils.variant_pricing import (
    calculate_variant_price,
    exact_pot_price,
    pot_price_group_ids,
    resolve_pot_price,
)

# Size × pot, with a third colour group that is NOT priced by the grid — the normal
# N-axis case where group_ids is a strict subset of the product's groups.
SIZE_POT_GROUPS = [
    {
        "id": "vg_colour",
        "label": "Color",
        "required": True,
        "options": [
            {"id": "opt_black", "name": "Black", "price": 0.0, "stock": 10},
            {"id": "opt_white", "name": "White", "price": 0.0, "stock": 10},
        ],
    },
    {
        "id": "vg_size",
        "label": "Select Plant Size",
        "required": True,
        "options": [
            {"id": "opt_small", "name": "Small", "price": 0.0, "stock": 10},
            {"id": "opt_medium", "name": "Medium", "price": 0.0, "stock": 10},
        ],
    },
    {
        "id": "vg_pot",
        "label": "Select Planter",
        "required": True,
        "options": [
            {"id": "opt_grow", "name": "Grow pot", "price": 0.0, "stock": 10},
            {"id": "opt_krish", "name": "Krish", "price": 0.0, "stock": 10},
            {"id": "opt_plantoga", "name": "Plantoga", "price": 0.0, "stock": 10},
        ],
    },
]

POT_GRID = {
    "opt_small__opt_grow": 200.0,
    "opt_small__opt_krish": 300.0,
    "opt_small__opt_plantoga": 400.0,
    "opt_medium__opt_grow": 300.0,
    "opt_medium__opt_krish": 350.0,
    "opt_medium__opt_plantoga": 450.0,
}

GRID_AXES = ["vg_size", "vg_pot"]


def _variants(pot_price=None, price_map=None, groups=SIZE_POT_GROUPS):
    import itertools

    stock_map = {}
    for combo in itertools.product(*[[o["id"] for o in g["options"]] for g in groups]):
        stock_map["__".join(combo)] = 10
    v = {"variant_groups": groups, "stock_map": stock_map}
    if price_map is not None:
        v["price_map"] = price_map
    if pot_price is not None:
        v["pot_price"] = pot_price
    return v


def _product(price=199.0, variants=None):
    class P:
        id = 1
        name = "Peace lily"
        original_price = None
        stock_qty = 999
        images = []

    P.price = price
    P.variants = variants if variants is not None else _variants()
    return P()


# ── resolver ────────────────────────────────────────────────────────────────

def test_resolve_exact_when_every_axis_selected():
    r = resolve_pot_price(GRID_AXES, POT_GRID, {"vg_size": "opt_small", "vg_pot": "opt_grow"})
    assert r is not None and r.exact and r.min == 200.0 and r.max == 200.0


def test_resolve_returns_range_when_an_axis_is_unselected():
    # Size unselected → the range across sizes for Grow pot.
    r = resolve_pot_price(GRID_AXES, POT_GRID, {"vg_pot": "opt_grow"})
    assert r is not None and not r.exact
    assert (r.min, r.max) == (200.0, 300.0)


def test_resolve_uniform_grid_is_exact_not_a_zero_width_range():
    # Every cell 300 → one number, never "300–300".
    grid = {f"opt_small__{p}": 300.0 for p in ("opt_grow", "opt_krish")}
    grid.update({f"opt_medium__{p}": 300.0 for p in ("opt_grow", "opt_krish")})
    r = resolve_pot_price(GRID_AXES, grid, {"vg_size": "opt_medium"})
    assert r is not None and r.exact and r.min == 300.0


def test_resolve_returns_none_on_unfilled_cell_and_never_zero():
    # A selection the grid has no row for is UNKNOWN, not free.
    r = resolve_pot_price(
        GRID_AXES, POT_GRID, {"vg_size": "opt_small", "vg_pot": "opt_missing"}
    )
    assert r is None


def test_resolve_ignores_full_combo_keys_from_price_map():
    # A 3-segment price_map/stock_map key must never resolve in the 2-axis grid.
    mixed = dict(POT_GRID)
    mixed["opt_black__opt_small__opt_grow"] = 9999.0
    r = resolve_pot_price(GRID_AXES, mixed, {"vg_size": "opt_small", "vg_pot": "opt_grow"})
    assert r is not None and r.min == 200.0  # the 9999 key is ignored


def test_resolve_is_axis_count_agnostic_three_axis_grid():
    # Same code, three axes — no hardcoded dimension. The grid axes are passed explicitly
    # rather than derived from groups, which is what makes the resolver dimension-agnostic.
    grid = {"opt_small__opt_grow__opt_a": 111.0, "opt_medium__opt_grow__opt_a": 222.0}
    axes = ["vg_size", "vg_pot", "vg_style"]
    assert resolve_pot_price(axes, grid, {"vg_size": "opt_small"}) == (111.0, 111.0, True)
    r = resolve_pot_price(axes, grid, {"vg_pot": "opt_grow"})
    assert (r.min, r.max, r.exact) == (111.0, 222.0, False)


def test_exact_pot_price_refuses_to_charge_a_range():
    # Under additive a ranged value must never be charged.
    assert exact_pot_price(GRID_AXES, POT_GRID, {"vg_pot": "opt_grow"}) is None
    assert exact_pot_price(GRID_AXES, POT_GRID, {"vg_size": "opt_small", "vg_pot": "opt_grow"}) == 200.0


def test_pot_price_group_ids_reads_config_and_tolerates_absence():
    assert pot_price_group_ids({"pot_price": {"group_ids": GRID_AXES}}) == GRID_AXES
    assert pot_price_group_ids({}) == []
    assert pot_price_group_ids({"pot_price": {}}) == []


# ── the §5.4 chain ──────────────────────────────────────────────────────────

def _additive(**kw):
    return {"group_ids": GRID_AXES, "map": POT_GRID, **kw}


def test_additive_total_is_plant_plus_non_grid_deltas_plus_grid():
    p = _product(199.0, _variants(pot_price=_additive()))
    r = calculate_variant_price(
        p, ["opt_black", "opt_small", "opt_grow"], quantity=1, validate_stock=False
    )
    # 199 base + 0 colour delta + 200 pot = 399
    assert r["unit_price"] == pytest.approx(399.0)


def test_price_map_still_wins_over_the_grid():
    # The override is absolute and unconditional — this is why retiring it is inseparable
    # from switching additive on.
    pm = {"opt_black__opt_small__opt_grow": 200.0}
    p = _product(199.0, _variants(pot_price=_additive(), price_map=pm))
    r = calculate_variant_price(
        p, ["opt_black", "opt_small", "opt_grow"], quantity=1, validate_stock=False
    )
    assert r["unit_price"] == pytest.approx(200.0)


def _card_price(base, variants, sel):
    """The number the storefront card puts in front of the customer.

    Mirrors ProductDetailPage.displayPrice: the base price, plus the deltas of groups the
    grid does not price, plus the resolved grid cell. The pot is included only when it
    resolves to a single exact number, exactly as the page does it.
    """
    pp = (variants or {}).get("pot_price")
    gids = (pp or {}).get("group_ids") or []
    priced = set(gids)
    total = float(base)
    for group in variants.get("variant_groups") or []:
        gid = group.get("id")
        if gid in priced:
            continue
        for opt in group.get("options") or []:
            if opt.get("id") in sel:
                total += float(opt.get("price") or 0)
    chosen = set(sel)
    by_group = {
        g["id"]: next(o["id"] for o in g["options"] if o["id"] in chosen)
        for g in variants.get("variant_groups") or []
        if g.get("id") in gids
    }
    exact = exact_pot_price(gids, (pp or {}).get("map") or {}, by_group)
    return total + (exact or 0.0)


@pytest.mark.parametrize("deltas", [False, True], ids=["zero-deltas", "nonzero-deltas"])
@pytest.mark.parametrize("grid", ["absent", "empty", "partial", "complete"],
                         ids=["no-grid", "no-cells", "half-filled", "full-grid"])
def test_the_advertised_price_always_equals_the_charged_price(grid, deltas):
    """The storefront number and the charged number can never disagree.

    This is the whole reason `total_mode: display_only` was deleted. That mode priced the
    card but not the bill, so a ₹300 pot was advertised as "+₹300" on a ₹0 order — a silent
    false-advertising bug, and the one thing a storefront must never do. With a single chain
    there is no second formula to fall out of sync.

    Every grid state matters. A half-filled grid is the interesting one: the pot simply does
    not resolve, so neither the card nor the bill includes it, and the customer sees the
    base price rather than a pot they would be charged more for later.
    """
    base = 199.0
    if grid == "absent":
        pp, gids = None, []
    else:
        gids = GRID_AXES
        cells = {
            "empty": {},
            "partial": {"opt_small__opt_grow": 200.0},
            "complete": dict(POT_GRID),
        }[grid]
        pp = {"group_ids": gids, "map": cells}
    sel = ["opt_black", "opt_small", "opt_grow"]
    variants = _variants(
        groups=_with_option_prices({"opt_small": 150.0}) if deltas else SIZE_POT_GROUPS,
        pot_price=pp,
    )
    charged = calculate_variant_price(
        _product(base, variants), sel, quantity=1, validate_stock=False
    )["unit_price"]
    assert _card_price(base, variants, sel) == pytest.approx(charged), (
        f"card/bill divergence for grid={grid} deltas={deltas}"
    )
    # And the base price is never lost, whatever the grid says.
    assert charged >= base


def test_grid_group_deltas_are_excluded_so_they_cannot_double_charge():
    # Give a grid group a non-zero delta. The §5.5a gate blocks this at save time; this
    # asserts the chain does not double-charge if it ever slips through.
    groups = [dict(g) for g in SIZE_POT_GROUPS]
    groups[1] = {**groups[1], "options": [{**o, "price": 100.0} for o in groups[1]["options"]]}
    p = _product(199.0, _variants(pot_price=_additive(), groups=groups))
    r = calculate_variant_price(
        p, ["opt_black", "opt_small", "opt_grow"], quantity=1, validate_stock=False
    )
    # 199 + 0 + 200 — the size delta of 100 is NOT added on top of the 200 grid cell.
    assert r["unit_price"] == pytest.approx(399.0)


def test_independent_group_deltas_are_added_under_additive():
    groups = [dict(g) for g in SIZE_POT_GROUPS]
    groups[0] = {**groups[0], "options": [{**o, "price": 50.0} for o in groups[0]["options"]]}
    pp = _additive(independent_group_ids=["vg_colour"])
    p = _product(199.0, _variants(pot_price=pp, groups=groups))
    r = calculate_variant_price(
        p, ["opt_black", "opt_small", "opt_grow"], quantity=1, validate_stock=False
    )
    # 199 + 50 colour (outside the grid) + 200 pot
    assert r["unit_price"] == pytest.approx(449.0)


def test_unfilled_cell_charges_the_plant_but_not_a_free_pot():
    grid = dict(POT_GRID)
    del grid["opt_small__opt_grow"]
    p = _product(199.0, _variants(pot_price={"group_ids": GRID_AXES, "map": grid}))
    r = calculate_variant_price(
        p, ["opt_black", "opt_small", "opt_grow"], quantity=1, validate_stock=False
    )
    # The critical assertion is the negative one: this must NEVER be ₹0. Every option delta
    # is ₹0, so falling through to the delta sum would hand the customer the plant and a
    # ₹200 pot for nothing. Bill the known parts (₹199 plant) and withhold only the
    # un-priced pot component until the admin fills the cell.
    assert r["unit_price"] == pytest.approx(199.0)
    assert r["unit_price"] > 0
    # A neighbouring filled cell must be unaffected by the hole.
    ok = calculate_variant_price(
        _product(199.0, _variants(pot_price={"group_ids": GRID_AXES, "map": grid})),
        ["opt_black", "opt_small", "opt_krish"], quantity=1, validate_stock=False,
    )
    assert ok["unit_price"] == pytest.approx(499.0)


def test_unconfigured_product_is_charged_its_base_price():
    """A product with no grid must cost something.

    This branch used to bill the bare sum of option deltas, treating the deltas as the whole
    price. That is not what they are — they are increments on top of `product.price` — so a
    ₹199 plant with no surcharges was free, and a ₹249 plant with a ₹150 surcharge was
    charged ₹150. With per-option prices retired in the admin the delta sum is always ₹0, so
    this branch is the difference between a product being priced and being given away.
    """
    p = _product(199.0, _variants())
    r = calculate_variant_price(
        p, ["opt_black", "opt_small", "opt_grow"], quantity=1, validate_stock=False
    )
    assert r["unit_price"] == pytest.approx(199.0)


def test_unconfigured_product_adds_deltas_on_top_of_the_base_price():
    """The regression this fixes, with the exact shape that was undercharging.

    money-plant-golden (base ₹249) was charging ₹150 for "Small + Ceramic" — the base price
    was dropped entirely. Deltas are surcharges, so the total is base + surcharges.
    """
    groups = _with_option_prices({"opt_medium": 150.0})
    v = _variants(groups=groups)
    base = 249.0
    small = calculate_variant_price(
        _product(base, v), ["opt_black", "opt_small", "opt_grow"],
        quantity=1, validate_stock=False,
    )
    medium = calculate_variant_price(
        _product(base, v), ["opt_black", "opt_medium", "opt_grow"],
        quantity=1, validate_stock=False,
    )
    assert small["unit_price"] == pytest.approx(base)           # no surcharge
    assert medium["unit_price"] == pytest.approx(base + 150.0)  # was 150
    # The whole point: the base is never lost, whatever the deltas are.
    assert medium["unit_price"] > 150.0


def test_unconfigured_product_cannot_be_free_even_with_zero_deltas():
    v = _variants()
    for sel in (
        ["opt_black", "opt_small", "opt_grow"],
        ["opt_white", "opt_medium", "opt_plantoga"],
    ):
        r = calculate_variant_price(
            _product(199.0, v), sel, quantity=1, validate_stock=False
        )
        assert r["unit_price"] == pytest.approx(199.0), sel
        assert r["unit_price"] > 0


# ── order snapshot reconciliation ───────────────────────────────────────────

def test_snapshot_reconciles_with_the_charged_total():
    p = _product(199.0, _variants(pot_price=_additive()))
    r = calculate_variant_price(
        p, ["opt_black", "opt_small", "opt_grow"], quantity=1, validate_stock=False
    )
    snap = r["variant_snapshot"]
    # The point of the test: the breakdown an order stores must add up to what was charged.
    # Deltas alone are all ₹0 and the pot alone is ₹200 — neither is the ₹399 bill.
    assert sum(float(e["price"]) for e in snap) == pytest.approx(r["unit_price"])
    assert r["unit_price"] == pytest.approx(399.0)
    assert any(e["price"] == 199.0 for e in snap), "base plant price must be recorded"
    assert any(e["price"] == 200.0 for e in snap), "pot component must be recorded"
    # Base first, so the breakdown reads top-down like a bill.
    assert float(snap[0]["price"]) == pytest.approx(199.0)


def test_snapshot_omits_pot_entry_when_grid_did_not_resolve():
    p = _product(199.0, _variants())
    r = calculate_variant_price(
        p, ["opt_black", "opt_small", "opt_grow"], quantity=1, validate_stock=False
    )
    assert all(float(e["price"]) == 0.0 for e in r["variant_snapshot"])


# ── migration projection (18 → 6) ───────────────────────────────────────────

def test_projection_collapses_18_keys_to_6_when_values_agree():
    pm = {}
    pot = {
        ("opt_small", "opt_grow"): 200, ("opt_small", "opt_krish"): 300,
        ("opt_small", "opt_plantoga"): 400, ("opt_medium", "opt_grow"): 300,
        ("opt_medium", "opt_krish"): 350, ("opt_medium", "opt_plantoga"): 450,
    }
    for colour in ("opt_black", "opt_white", "opt_red"):
        for (size, planter), val in pot.items():
            pm[f"{colour}__{size}__{planter}"] = float(val)
    grid, conflicts = project_price_map_to_pot_grid(pm, GRID_AXES, SIZE_POT_GROUPS)
    assert conflicts == {}
    assert len(grid) == 6
    assert grid["opt_small__opt_grow"] == 200.0
    assert grid["opt_medium__opt_plantoga"] == 450.0


def test_projection_reports_a_seeded_conflict_instead_of_choosing():
    # Deliberately inconsistent colour copies — the branch Peace lily cannot exercise.
    pm = {}
    for colour, bump in (("opt_black", 0), ("opt_white", 10), ("opt_red", 0)):
        pm[f"{colour}__opt_small__opt_grow"] = 200.0 + bump
    grid, conflicts = project_price_map_to_pot_grid(pm, GRID_AXES, SIZE_POT_GROUPS)
    assert "opt_small__opt_grow" in conflicts
    assert conflicts["opt_small__opt_grow"] == [200.0, 210.0]
    # The conflicting cell is NOT written — nothing is auto-decided.
    assert "opt_small__opt_grow" not in grid


# ── §5.5a server-side gate ──────────────────────────────────────────────────

from app.services.product_service import (  # noqa: E402
    PotPriceAmbiguityError,
    _assert_pot_price_unambiguous,
)


def _with_option_prices(prices: dict):
    """Clone the fixture groups, setting per-option deltas by option id.

    Needed for the base-price tests: money-plant's surcharges are per-option and differ
    within a group (Small 0 / Medium 150 / Large 350), which a uniform per-group delta
    cannot express.
    """
    groups = [dict(g) for g in SIZE_POT_GROUPS]
    return [
        {**g, "options": [{**o, "price": float(prices.get(o["id"], o.get("price", 0.0) or 0))}
                          for o in g["options"]]}
        for g in groups
    ]


def _groups_with_prices(pot_group_delta=0.0, colour_delta=0.0):
    groups = [dict(g) for g in SIZE_POT_GROUPS]
    if pot_group_delta:
        groups[2] = {
            **groups[2],
            "options": [{**o, "price": pot_group_delta} for o in groups[2]["options"]],
        }
    if colour_delta:
        groups[0] = {
            **groups[0],
            "options": [{**o, "price": colour_delta} for o in groups[0]["options"]],
        }
    return groups


def test_gate_blocks_non_zero_delta_on_a_grid_group():
    v = {
        "variant_groups": _groups_with_prices(pot_group_delta=50.0),
        "pot_price": {"group_ids": GRID_AXES, "map": POT_GRID},
    }
    with pytest.raises(PotPriceAmbiguityError) as e:
        _assert_pot_price_unambiguous(v)
    # The message must name the group and the amount, so the fix is obvious.
    assert "Select Planter" in str(e.value)
    assert "50" in str(e.value)


def test_gate_blocks_undeclared_priced_group_outside_the_grid():
    v = {
        "variant_groups": _groups_with_prices(colour_delta=50.0),
        "pot_price": {"group_ids": GRID_AXES, "map": POT_GRID},
    }
    with pytest.raises(PotPriceAmbiguityError) as e:
        _assert_pot_price_unambiguous(v)
    assert "Color" in str(e.value)


def test_gate_passes_when_the_outside_group_is_declared_independent():
    v = {
        "variant_groups": _groups_with_prices(colour_delta=50.0),
        "pot_price": {
            "group_ids": GRID_AXES,
            "map": POT_GRID,
            "independent_group_ids": ["vg_colour"],
        },
    }
    _assert_pot_price_unambiguous(v)  # must not raise


def test_gate_passes_when_every_delta_is_zero():
    # The Peace lily case: all deltas deliberately 0.
    v = {
        "variant_groups": SIZE_POT_GROUPS,
        "pot_price": {"group_ids": GRID_AXES, "map": POT_GRID},
    }
    _assert_pot_price_unambiguous(v)  # must not raise


def test_gate_always_rejects_a_priced_grid_group():
    """The billing conflict is now unconditional — there is no mode that excuses it.

    A priced group inside the grid would be charged twice: once as the grid cell, once as
    its own option delta. Under `display_only` this was skipped, because a cosmetic grid
    moved no total. Deleting the mode made the skip meaningless, so this must always raise.
    """
    v = {
        "variant_groups": _groups_with_prices(pot_group_delta=50.0),
        "pot_price": {"group_ids": GRID_AXES, "map": POT_GRID},
    }
    with pytest.raises(PotPriceAmbiguityError, match="price"):
        _assert_pot_price_unambiguous(v)


def test_gate_ignores_products_with_no_grid():
    _assert_pot_price_unambiguous({"variant_groups": SIZE_POT_GROUPS})  # must not raise
    _assert_pot_price_unambiguous({"pot_price": None})  # must not raise


def test_gate_catches_a_group_added_to_the_grid_without_clearing_its_delta():
    # The re-arm case: a group was independent (declared, priced), then ticked into the
    # grid. Its delta is now ignored but nobody cleared it.
    v = {
        "variant_groups": _groups_with_prices(colour_delta=75.0),
        "pot_price": {
            "group_ids": ["vg_colour", *GRID_AXES],
            "map": POT_GRID,
            "independent_group_ids": ["vg_colour"],
        },
    }
    with pytest.raises(PotPriceAmbiguityError):
        _assert_pot_price_unambiguous(v)


def test_project_or_raise_refuses_to_guess_on_conflict():
    from app.utils.pot_price_migration import PotPriceConflictError, project_or_raise

    pm = {
        "opt_black__opt_small__opt_grow": 200.0,
        "opt_white__opt_small__opt_grow": 210.0,   # disagreement
    }
    with pytest.raises(PotPriceConflictError) as e:
        project_or_raise(pm, GRID_AXES, SIZE_POT_GROUPS)
    # The message must name the offending key so the admin can act on it.
    assert "opt_small__opt_grow" in str(e.value)
    assert e.value.conflicts["opt_small__opt_grow"] == [200.0, 210.0]


def test_project_or_raise_returns_the_grid_when_clean():
    from app.utils.pot_price_migration import project_or_raise

    pm = {
        "opt_black__opt_small__opt_grow": 200.0,
        "opt_white__opt_small__opt_grow": 200.0,
    }
    assert project_or_raise(pm, GRID_AXES, SIZE_POT_GROUPS) == {"opt_small__opt_grow": 200.0}


def test_projection_uses_product_group_order_not_grid_order():
    # group_ids passed in a different order than the product's groups. Full keys are built
    # in PRODUCT order, so the projection must follow that or it looks up nothing.
    pm = {
        "opt_black__opt_small__opt_grow": 200.0,
        "opt_white__opt_small__opt_grow": 200.0,
    }
    grid, conflicts = project_price_map_to_pot_grid(
        pm, ["vg_pot", "vg_size"], SIZE_POT_GROUPS
    )
    assert conflicts == {}
    # Key order follows the product's own group order (size before pot), not the argument.
    assert list(grid) == ["opt_small__opt_grow"]
    assert grid["opt_small__opt_grow"] == 200.0


# ── PDP ↔ checkout parity ───────────────────────────────────────────────────
#
# The storefront and the backend are two hand-written implementations of one rule with no
# shared test. A divergence means the PDP advertises one price and checkout charges another,
# which is the single most expensive class of bug in this feature. This test pins the
# backend's number against the exact expression the storefront uses, so the two cannot drift
# without a failure here.

def _frontend_display_price(product_price, price_map, combo_key, all_deltas, non_grid_deltas,
                            grid_axes, grid_map, selected):
    """Verbatim port of the ProductDetailPage.tsx chain (displayPrice).

    One chain, four cases: a legacy `price_map` override, a resolved grid cell, a grid whose
    cell for THIS combination is still blank, and no grid at all. The last three all bill
    `base + non_grid`, so they are written as one expression deliberately — if the storefront
    ever grows a second total formula again, this mirror is what has to be updated with it.
    """
    has_selection = bool(selected)
    combo_price = price_map.get(combo_key) if price_map and combo_key else None
    # exact_potPrice() — a ranged value is not charged, so this returns None unless exact.
    r = resolve_pot_price(grid_axes, grid_map, selected)
    pot = r.min if (r is not None and r.exact) else None
    if not has_selection:
        return product_price
    if combo_price is not None:
        return float(combo_price)
    return product_price + non_grid_deltas + (pot or 0.0)


def _assert_parity(variants, selected_ids, product_price=199.0):
    p = _product(product_price, variants)
    backend = calculate_variant_price(p, selected_ids, quantity=1, validate_stock=False)
    combo_key = "__".join(selected_ids)
    price_by_id = {o["id"]: float(o.get("price", 0) or 0)
                   for g in variants["variant_groups"] for o in g["options"]}
    selected = {g["id"]: oid for g in variants["variant_groups"]
                for oid in selected_ids if oid in {o["id"] for o in g["options"]}}
    axes = pot_price_group_ids(variants)
    all_deltas = sum(price_by_id.get(o, 0.0) for o in selected_ids)
    non_grid = sum(price_by_id[o] for gid, o in selected.items() if gid not in axes)
    expected = _frontend_display_price(
        product_price,
        variants.get("price_map"),
        combo_key,
        all_deltas,
        non_grid,
        axes,
        (variants.get("pot_price") or {}).get("map"),
        selected,
    )
    assert backend["unit_price"] == pytest.approx(expected), (
        f"PDP would show {expected} but checkout charges {backend['unit_price']}"
    )
    return backend["unit_price"]


@pytest.mark.parametrize("size,planter,expected", [
    ("opt_small", "opt_grow", 399.0),
    ("opt_small", "opt_krish", 499.0),
    ("opt_small", "opt_plantoga", 599.0),
    ("opt_medium", "opt_grow", 499.0),
    ("opt_medium", "opt_krish", 549.0),
    ("opt_medium", "opt_plantoga", 649.0),
])
def test_parity_across_every_grid_cell(size, planter, expected):
    v = _variants(pot_price={"group_ids": GRID_AXES, "map": POT_GRID})
    for colour in ("opt_black", "opt_white"):
        assert _assert_parity(v, [colour, size, planter]) == pytest.approx(expected)


def test_parity_holds_when_price_map_is_populated():
    # The override branch — the two implementations must agree here too, since this is the
    # state Peace lily is actually in right now.
    pm = {"opt_black__opt_small__opt_grow": 200.0}
    v = _variants(pot_price={"group_ids": GRID_AXES, "map": POT_GRID}, price_map=pm)
    assert _assert_parity(v, ["opt_black", "opt_small", "opt_grow"]) == pytest.approx(200.0)


def test_parity_holds_for_a_product_with_no_grid():
    assert _assert_parity(_variants(), ["opt_black", "opt_small", "opt_grow"]) == pytest.approx(199.0)


def test_parity_holds_with_independent_group_deltas():
    groups = _groups_with_prices(colour_delta=50.0)
    v = _variants(pot_price={"group_ids": GRID_AXES, "map": POT_GRID,
                             "independent_group_ids": ["vg_colour"]}, groups=groups)
    assert _assert_parity(v, ["opt_black", "opt_small", "opt_grow"]) == pytest.approx(449.0)
