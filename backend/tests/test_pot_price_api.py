"""API-level tests for the §5.5a price-grid gate.

The gate is the safety net for the one path that can overcharge a customer, so it has to be
proven at the HTTP boundary — a unit test on the helper would not show that the API actually
returns 422, and that the admin UI has a status code to key off.
"""

import itertools

import pytest

from app.db.models import Product as ProductModel
from tests.conftest import _seed_category, test_session_factory

pytestmark = pytest.mark.asyncio

PROD_URL = "/api/v1/products"

GROUPS = [
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
        ],
    },
]

GRID = {"opt_small__opt_grow": 200.0, "opt_small__opt_krish": 300.0,
        "opt_medium__opt_grow": 300.0, "opt_medium__opt_krish": 350.0}


def _variants(groups=None, pot_price=None):
    groups = groups or GROUPS
    per_group = [[o["id"] for o in g["options"]] for g in groups]
    stock = {"__".join(combo): 10 for combo in itertools.product(*per_group)}
    v = {"variant_groups": groups, "stock_map": stock}
    if pot_price is not None:
        v["pot_price"] = pot_price
    return v


async def _seed(client, admin_token, variants, name="Priced Plant"):
    cat = await _seed_category(client, admin_token, "Plants")
    async with test_session_factory() as db:
        from app.db.models import Product
        p = Product(name=name, slug="priced-plant", description="d", price=199.0,
                    stock_qty=10, category_id=cat["id"], images=[], tags=[],
                    variants=variants, is_active=True)
        db.add(p)
        await db.commit()
        await db.refresh(p)
        return p.id


def _auth(t):
    return {"Authorization": f"Bearer {t}"}


async def test_gate_returns_422_when_a_grid_group_has_its_own_price(client, admin_token):
    groups = [dict(g) for g in GROUPS]
    groups[1] = {**groups[1], "options": [{**o, "price": 50.0} for o in groups[1]["options"]]}
    pid = await _seed(client, admin_token, _variants(groups))

    resp = await client.put(
        f"{PROD_URL}/{pid}",
        json={"variants": _variants(groups, {"group_ids": ["vg_size", "vg_pot"], "map": GRID})},
        headers=_auth(admin_token),
    )
    assert resp.status_code == 422, resp.text
    # The message must name the group and amount so the merchant knows what to fix.
    assert "Select Planter" in resp.json()["detail"]


async def test_gate_returns_422_for_undeclared_priced_group(client, admin_token):
    groups = [dict(g) for g in GROUPS]
    groups.insert(0, {
        "id": "vg_colour", "label": "Color", "required": True,
        "options": [{"id": "opt_black", "name": "Black", "price": 50.0, "stock": 10}],
    })
    pid = await _seed(client, admin_token, _variants(groups))

    resp = await client.put(
        f"{PROD_URL}/{pid}",
        json={"variants": _variants(groups, {"group_ids": ["vg_size", "vg_pot"], "map": GRID})},
        headers=_auth(admin_token),
    )
    assert resp.status_code == 422, resp.text
    assert "Color" in resp.json()["detail"]


async def test_gate_allows_a_declared_independent_group(client, admin_token):
    groups = [dict(g) for g in GROUPS]
    groups.insert(0, {
        "id": "vg_colour", "label": "Color", "required": True,
        "options": [{"id": "opt_black", "name": "Black", "price": 50.0, "stock": 10}],
    })
    pp = {"group_ids": ["vg_size", "vg_pot"], "map": GRID,
          "independent_group_ids": ["vg_colour"]}
    pid = await _seed(client, admin_token, _variants(groups))

    resp = await client.put(
        f"{PROD_URL}/{pid}",
        json={"variants": _variants(groups, pp)},
        headers=_auth(admin_token),
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["variants"]["pot_price"]["independent_group_ids"] == ["vg_colour"]


async def test_a_clean_grid_saves_and_round_trips(client, admin_token):
    pp = {"group_ids": ["vg_size", "vg_pot"], "map": GRID}
    pid = await _seed(client, admin_token, _variants())

    resp = await client.put(
        f"{PROD_URL}/{pid}",
        json={"variants": _variants(GROUPS, pp)},
        headers=_auth(admin_token),
    )
    assert resp.status_code == 200, resp.text
    saved = resp.json()["variants"]["pot_price"]
    assert saved["group_ids"] == ["vg_size", "vg_pot"]
    assert saved["map"]["opt_small__opt_grow"] == 200.0
    # No mode key: the grid is always the charge, and there is nothing to default.
    assert "total_mode" not in saved


async def test_gate_rejects_a_priced_grid_group(client, admin_token):
    """A priced group inside the grid would be billed twice, so it is always a 422.

    There used to be an exemption for `total_mode: display_only`, where a cosmetic grid
    moved no total. The mode is gone, so the exemption is gone with it.
    """
    groups = [dict(g) for g in GROUPS]
    groups[1] = {**groups[1], "options": [{**o, "price": 50.0} for o in groups[1]["options"]]}
    pid = await _seed(client, admin_token, _variants(groups))
    resp = await client.put(
        f"{PROD_URL}/{pid}",
        json={"variants": _variants(groups, {"group_ids": ["vg_size", "vg_pot"], "map": GRID})},
        headers=_auth(admin_token),
    )
    assert resp.status_code == 422, resp.text


async def test_negative_cell_price_is_rejected(client, admin_token):
    bad = dict(GRID)
    bad["opt_small__opt_grow"] = -5.0
    pid = await _seed(client, admin_token, _variants())

    resp = await client.put(
        f"{PROD_URL}/{pid}",
        json={"variants": _variants(GROUPS, {"group_ids": ["vg_size", "vg_pot"], "map": bad})},
        headers=_auth(admin_token),
    )
    assert resp.status_code in (400, 422), resp.text


# ---- Structural integrity of the grid itself (§5.5a) --------------------

async def test_rejects_a_grid_key_with_the_wrong_number_of_segments(client, admin_token):
    # A `price_map` key pasted into `pot_price.map`. It can never resolve, so every affected
    # cell would bill as unpriced — silently.
    bad = {"opt_small__opt_grow__opt_black": 200.0}
    pid = await _seed(client, admin_token, _variants())
    resp = await client.put(
        f"{PROD_URL}/{pid}",
        json={"variants": _variants(GROUPS, {"group_ids": ["vg_size", "vg_pot"], "map": bad})},
        headers=_auth(admin_token),
    )
    assert resp.status_code in (400, 422), resp.text


async def test_rejects_an_overlapping_independent_group(client, admin_token):
    # Declaring a grid group "independent" would both exclude its delta and add it back.
    pp = {"group_ids": ["vg_size", "vg_pot"], "map": GRID,
          "independent_group_ids": ["vg_size"]}
    pid = await _seed(client, admin_token, _variants())
    resp = await client.put(
        f"{PROD_URL}/{pid}",
        json={"variants": _variants(GROUPS, pp)},
        headers=_auth(admin_token),
    )
    assert resp.status_code in (400, 422), resp.text


async def test_rejects_a_grid_pointing_at_a_group_that_does_not_exist(client, admin_token):
    pp = {"group_ids": ["vg_size", "vg_gone"], "map": GRID}
    pid = await _seed(client, admin_token, _variants())
    resp = await client.put(
        f"{PROD_URL}/{pid}",
        json={"variants": _variants(GROUPS, pp)},
        headers=_auth(admin_token),
    )
    assert resp.status_code == 422, resp.text
    assert "vg_gone" in resp.json()["detail"]


async def test_rejects_axes_out_of_product_order(client, admin_token):
    # Groups are stored size → pot, so the grid must be declared the same way. A reversed
    # declaration would build keys in an order the resolver never looks up.
    pp = {"group_ids": ["vg_pot", "vg_size"],
          "map": {"opt_grow__opt_small": 200.0, "opt_krish__opt_small": 300.0,
                  "opt_grow__opt_medium": 300.0, "opt_krish__opt_medium": 350.0}}
    pid = await _seed(client, admin_token, _variants())
    resp = await client.put(
        f"{PROD_URL}/{pid}",
        json={"variants": _variants(GROUPS, pp)},
        headers=_auth(admin_token),
    )
    assert resp.status_code == 422, resp.text
    assert "order" in resp.json()["detail"].lower()


async def test_pricing_still_correct_after_an_atomic_migration_save(client, admin_token):
    """The §5.8 sequence: turn the grid on AND clear price_map in one request.

    A price_map left behind keeps winning the resolver, so the card would advertise the grid
    price while the bill charged the old override. This is the single request that has to
    carry both changes.
    """
    from app.utils.variant_pricing import calculate_variant_price

    pp = {"group_ids": ["vg_size", "vg_pot"], "map": GRID}
    pid = await _seed(client, admin_token, _variants())

    resp = await client.put(
        f"{PROD_URL}/{pid}",
        json={"variants": {**_variants(GROUPS, pp), "price_map": None}},
        headers=_auth(admin_token),
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["variants"]["price_map"] in (None, {})

    async with test_session_factory() as db:
        stored = await db.get(ProductModel, pid)
        # The override is gone, so the grid is finally the thing deciding the total.
        assert not stored.variants.get("price_map")
        price = calculate_variant_price(
            stored, ["opt_small", "opt_grow"], quantity=1, validate_stock=False
        )
    assert price["unit_price"] == pytest.approx(199.0 + 200.0)
    # ...and the stored breakdown adds up to it.
    assert sum(float(e["price"]) for e in price["variant_snapshot"]) == pytest.approx(399.0)


# ---- §5.8 migration projection endpoint ----------------------------------

PEACE_GROUPS = [
    {"id": "vg_colour", "label": "Color", "required": True, "options": [
        {"id": f"opt_{c}", "name": c.title(), "price": 0.0, "stock": 10}
        for c in ("black", "white", "red")]},
    {"id": "vg_size", "label": "Select Plant Size", "required": True, "options": [
        {"id": "opt_small", "name": "Small", "price": 0.0, "stock": 10},
        {"id": "opt_medium", "name": "Medium", "price": 0.0, "stock": 10}]},
    {"id": "vg_pot", "label": "Select Planter", "required": True, "options": [
        {"id": "opt_grow", "name": "Grow", "price": 0.0, "stock": 10},
        {"id": "opt_krish", "name": "Krish", "price": 0.0, "stock": 10},
        {"id": "opt_plantoga", "name": "Plantoga", "price": 0.0, "stock": 10}]},
]

# Six distinct values, each repeated across the three colours — exactly the shape that makes
# a manual 18 → 6 migration worth automating.
PEACE_PM = {
    f"opt_{c}__{s}__{p}": v
    for c in ("black", "white", "red")
    for s, p, v in (
        ("opt_small", "opt_grow", 200.0),
        ("opt_small", "opt_krish", 300.0),
        ("opt_small", "opt_plantoga", 400.0),
        ("opt_medium", "opt_grow", 300.0),
        ("opt_medium", "opt_krish", 350.0),
        ("opt_medium", "opt_plantoga", 450.0),
    )
}


async def test_projection_collapses_the_18_key_table_to_6_cells(client, admin_token):
    cat = await _seed_category(client, admin_token, "Plants")
    async with test_session_factory() as db:
        p = ProductModel(name="Peace Lily", slug="peace-lily", description="d", price=199.0,
                         stock_qty=10, category_id=cat["id"], images=[], tags=[],
                         variants={"variant_groups": PEACE_GROUPS,
                                   "stock_map": {}, "price_map": PEACE_PM},
                         is_active=True)
        db.add(p)
        await db.commit()
        await db.refresh(p)
        pid = p.id

    resp = await client.post(
        f"{PROD_URL}/{pid}/pot-price/projection",
        json={"group_ids": ["vg_size", "vg_pot"]},
        headers=_auth(admin_token),
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["conflicts"] == {}
    assert data["map"] == {
        "opt_small__opt_grow": 200.0,
        "opt_small__opt_krish": 300.0,
        "opt_small__opt_plantoga": 400.0,
        "opt_medium__opt_grow": 300.0,
        "opt_medium__opt_krish": 350.0,
        "opt_medium__opt_plantoga": 450.0,
    }
    # 18 stored prices collapse to 6 authored cells, and 12 keys are now redundant.
    assert len(PEACE_PM) == 18 and len(data["map"]) == 6


async def test_projection_422s_on_disagreement_and_suggests_nothing(client, admin_token):
    # One colour disagrees for Small/Grow. The endpoint must refuse, not pick a side.
    bad = {**PEACE_PM, "opt_red__opt_small__opt_grow": 999.0}
    cat = await _seed_category(client, admin_token, "Plants")
    async with test_session_factory() as db:
        p = ProductModel(name="Peace Lily", slug="peace-lily-2", description="d", price=199.0,
                         stock_qty=10, category_id=cat["id"], images=[], tags=[],
                         variants={"variant_groups": PEACE_GROUPS,
                                   "stock_map": {}, "price_map": bad},
                         is_active=True)
        db.add(p)
        await db.commit()
        await db.refresh(p)
        pid = p.id

    resp = await client.post(
        f"{PROD_URL}/{pid}/pot-price/projection",
        json={"group_ids": ["vg_size", "vg_pot"]},
        headers=_auth(admin_token),
    )
    assert resp.status_code == 422, resp.text
    detail = resp.json()["detail"]
    conflicts = detail["conflicts"]
    assert len(conflicts) == 1
    assert conflicts[0]["key"] == "opt_small__opt_grow"
    assert sorted(conflicts[0]["values"]) == [200.0, 999.0]


async def test_projection_rejects_an_unknown_axis(client, admin_token):
    cat = await _seed_category(client, admin_token, "Plants")
    async with test_session_factory() as db:
        p = ProductModel(name="Peace Lily", slug="peace-lily-3", description="d", price=199.0,
                         stock_qty=10, category_id=cat["id"], images=[], tags=[],
                         variants={"variant_groups": PEACE_GROUPS,
                                   "stock_map": {}, "price_map": PEACE_PM},
                         is_active=True)
        db.add(p)
        await db.commit()
        await db.refresh(p)
        pid = p.id

    resp = await client.post(
        f"{PROD_URL}/{pid}/pot-price/projection",
        json={"group_ids": ["vg_size", "vg_nope"]},
        headers=_auth(admin_token),
    )
    assert resp.status_code == 422, resp.text


async def test_projection_requires_admin(client):
    resp = await client.post(
        "/api/v1/products/1/pot-price/projection", json={"group_ids": ["vg_size"]}
    )
    assert resp.status_code in (401, 403), resp.text


# ---- Structural checks -------------------------------------------------
#
# A grid pointing at a deleted group, or with its axes out of product order, saves without
# any money moving but resolves to nothing on the storefront — the pot silently shows no
# price. These are gated because that failure is invisible, not because money is at risk.

async def test_unknown_axis_is_rejected(client, admin_token):
    pp = {"group_ids": ["vg_size", "vg_gone"], "map": GRID}
    pid = await _seed(client, admin_token, _variants())
    resp = await client.put(
        f"{PROD_URL}/{pid}",
        json={"variants": _variants(GROUPS, pp)},
        headers=_auth(admin_token),
    )
    assert resp.status_code == 422, resp.text
    assert "vg_gone" in resp.json()["detail"]


async def test_out_of_order_axes_are_rejected(client, admin_token):
    pp = {"group_ids": ["vg_pot", "vg_size"], "map": GRID}
    pid = await _seed(client, admin_token, _variants())
    resp = await client.put(
        f"{PROD_URL}/{pid}",
        json={"variants": _variants(GROUPS, pp)},
        headers=_auth(admin_token),
    )
    assert resp.status_code == 422, resp.text
    assert "order" in resp.json()["detail"].lower()



