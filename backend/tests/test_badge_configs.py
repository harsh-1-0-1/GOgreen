"""Badge wording and colour are configured per category, not per product.

The three badges drawn on a product image (bestseller, % OFF, rating) used to be
hardcoded in the components with a colour on each product row. These tests pin
the replacement: one config row per category, sparse so untouched categories keep
the defaults, and admin-only writes.
"""

import pytest
from httpx import AsyncClient

from app.db.models import CategoryBadgeConfig
from tests.conftest import _seed_category, test_session_factory

URL = "/api/v1/badge-configs"

def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def _put_config(client: AsyncClient, token: str, category_id: int, **overrides):
    payload = {
        "bestseller": {"enabled": True, "label": "HOT SELLER", "color": "#B91C1C"},
        "discount": {"enabled": True, "label": "", "color": "#1B4332"},
        "rating": {"enabled": False, "label": "", "color": "#0F172A"},
    }
    for key, value in overrides.items():
        payload[key] = {**payload[key], **value}
    return await client.put(
        f"{URL}/{category_id}", json=payload, headers=auth(token)
    )


async def test_defaults_when_no_category_has_a_config(client: AsyncClient):
    resp = await client.get(URL)
    assert resp.status_code == 200
    body = resp.json()
    assert body["by_category"] == {}
    assert body["defaults"]["bestseller"]["label"] == "BESTSELLER"
    assert body["defaults"]["bestseller"]["color"] == "#F59E0B"
    # Discount and rating keep automatic wording.
    assert body["defaults"]["discount"]["label"] == ""
    assert body["defaults"]["rating"]["label"] == ""


async def test_admin_can_rename_and_recolour_per_category(
    client: AsyncClient, admin_token: str
):
    cat = await _seed_category(client, admin_token, "Succulents")

    resp = await _put_config(client, admin_token, cat["id"])
    assert resp.status_code == 200, resp.text
    assert resp.json()["bestseller"]["label"] == "HOT SELLER"

    listing = await client.get(URL)
    body = listing.json()
    assert str(cat["id"]) in body["by_category"]
    assert body["by_category"][str(cat["id"])]["bestseller"]["color"] == "#B91C1C"
    # Untouched categories still fall back to the store defaults.
    assert body["defaults"]["bestseller"]["label"] == "BESTSELLER"


async def test_config_is_scoped_to_one_category(client: AsyncClient, admin_token: str):
    first = await _seed_category(client, admin_token, "First Category")
    second = await _seed_category(client, admin_token, "Second Category")

    await _put_config(client, admin_token, first["id"], bestseller={"label": "HOT SELLER"})

    body = (await client.get(URL)).json()
    assert body["by_category"][str(first["id"])]["bestseller"]["label"] == "HOT SELLER"
    assert str(second["id"]) not in body["by_category"]


async def test_updating_a_config_replaces_rather_than_duplicates(
    client: AsyncClient, admin_token: str
):
    cat = await _seed_category(client, admin_token, "Plants")

    await _put_config(client, admin_token, cat["id"])
    await _put_config(client, admin_token, cat["id"], bestseller={"label": "TOP PICK"})

    async with test_session_factory() as db:
        rows = (await db.execute(
            __import__("sqlalchemy").select(CategoryBadgeConfig).where(
                CategoryBadgeConfig.category_id == cat["id"]
            )
        )).scalars().all()
    assert len(rows) == 1
    assert rows[0].bestseller_label == "TOP PICK"


async def test_label_is_trimmed_and_colour_validated(client: AsyncClient, admin_token: str):
    cat = await _seed_category(client, admin_token, "Pots")

    resp = await _put_config(client, admin_token, cat["id"], bestseller={"label": "  Hot Seller  "})
    assert resp.status_code == 200
    assert resp.json()["bestseller"]["label"] == "Hot Seller"

    bad = await _put_config(client, admin_token, cat["id"], bestseller={"color": "red"})
    assert bad.status_code == 422


async def test_reset_removes_the_row_so_defaults_return(
    client: AsyncClient, admin_token: str
):
    cat = await _seed_category(client, admin_token, "Seeds")
    await _put_config(client, admin_token, cat["id"])

    reset = await client.delete(f"{URL}/{cat['id']}", headers=auth(admin_token))
    assert reset.status_code == 204

    body = (await client.get(URL)).json()
    assert str(cat["id"]) not in body["by_category"]


async def test_reset_on_untouched_category_is_a_404(client: AsyncClient, admin_token: str):
    cat = await _seed_category(client, admin_token, "Tools")
    resp = await client.delete(f"{URL}/{cat['id']}", headers=auth(admin_token))
    assert resp.status_code == 404


async def test_writes_require_admin(client: AsyncClient, admin_token: str):
    cat = await _seed_category(client, admin_token, "Lights")

    anon_put = await client.put(f"{URL}/{cat['id']}", json={})
    assert anon_put.status_code in (401, 403)

    anon_delete = await client.delete(f"{URL}/{cat['id']}")
    assert anon_delete.status_code in (401, 403)

    single = await client.get(f"{URL}/{cat['id']}")
    assert single.status_code in (401, 403)


async def test_updating_a_missing_category_is_404(client: AsyncClient, admin_token: str):
    resp = await _put_config(client, admin_token, 999999)
    assert resp.status_code == 404


async def test_disabled_badge_is_reported_as_disabled(client: AsyncClient, admin_token: str):
    cat = await _seed_category(client, admin_token, "Bonsai")

    await _put_config(client, admin_token, cat["id"], discount={"enabled": False})
    body = (await client.get(URL)).json()
    assert body["by_category"][str(cat["id"])]["discount"]["enabled"] is False
    # The automatic wording and colour survive a switch-off.
    assert body["by_category"][str(cat["id"])]["discount"]["label"] == ""

async def test_parent_config_is_inherited_by_subcategories(
    client: AsyncClient, admin_token: str
):
    """A config saved on a parent must reach its subcategories.

    Almost no product sits in a top-level category, so without inheritance an
    admin's colour on "Plants" would apply to nothing at all.
    """
    parent = await _seed_category(client, admin_token, "Plants")
    child = await _seed_category(client, admin_token, "Indoor Plants", parent_id=parent["id"])

    await _put_config(client, admin_token, parent["id"], bestseller={"label": "HOT SELLER", "color": "#B91C1C"})

    effective = (await client.get(URL)).json()["effective_by_category"]
    assert effective[str(parent["id"])]["bestseller"]["label"] == "HOT SELLER"
    assert effective[str(child["id"])]["bestseller"]["label"] == "HOT SELLER"
    assert effective[str(child["id"])]["bestseller"]["color"] == "#B91C1C"
    # The child still has no row of its own.
    assert str(child["id"]) not in (await client.get(URL)).json()["by_category"]


async def test_child_config_overrides_the_parent(client: AsyncClient, admin_token: str):
    parent = await _seed_category(client, admin_token, "Pots")
    child = await _seed_category(client, admin_token, "Plastic Pots", parent_id=parent["id"])

    await _put_config(client, admin_token, parent["id"], bestseller={"label": "PARENT"})
    await _put_config(client, admin_token, child["id"], bestseller={"label": "CHILD"})

    effective = (await client.get(URL)).json()["effective_by_category"]
    assert effective[str(child["id"])]["bestseller"]["label"] == "CHILD"
    assert effective[str(parent["id"])]["bestseller"]["label"] == "PARENT"


async def test_inheritance_reaches_grandchildren(client: AsyncClient, admin_token: str):
    root = await _seed_category(client, admin_token, "Root")
    mid = await _seed_category(client, admin_token, "Mid", parent_id=root["id"])
    leaf = await _seed_category(client, admin_token, "Leaf", parent_id=mid["id"])

    await _put_config(client, admin_token, root["id"], discount={"color": "#7C2D12"})

    effective = (await client.get(URL)).json()["effective_by_category"]
    assert effective[str(leaf["id"])]["discount"]["color"] == "#7C2D12"


async def test_clearing_a_child_override_falls_back_to_the_parent(
    client: AsyncClient, admin_token: str
):
    parent = await _seed_category(client, admin_token, "Garden")
    child = await _seed_category(client, admin_token, "Fruit Plants", parent_id=parent["id"])

    await _put_config(client, admin_token, parent["id"], bestseller={"label": "PARENT"})
    await _put_config(client, admin_token, child["id"], bestseller={"label": "CHILD"})
    await client.delete(f"{URL}/{child['id']}", headers=auth(admin_token))

    effective = (await client.get(URL)).json()["effective_by_category"]
    assert effective[str(child["id"])]["bestseller"]["label"] == "PARENT"


async def test_uncustomised_branch_falls_back_to_defaults(client: AsyncClient, admin_token: str):
    root = await _seed_category(client, admin_token, "Other Root")
    child = await _seed_category(client, admin_token, "Other Child", parent_id=root["id"])

    effective = (await client.get(URL)).json()["effective_by_category"]
    defaults = (await client.get(URL)).json()["defaults"]
    assert effective[str(child["id"])] == defaults


async def test_write_invalidates_the_cached_map(client: AsyncClient, admin_token: str):
    """A second reader must not be served the map that was cached before a save.

    The storefront polls this endpoint, so a stale cache entry means the new
    colours can take up to the TTL to appear on other devices.
    """
    category = await _seed_category(client, admin_token, "Cached")
    before = (await client.get(URL)).json()
    await _put_config(client, admin_token, category["id"], bestseller={"color": "#111111"})
    after = (await client.get(URL)).json()

    assert before["effective_by_category"][str(category["id"])]["bestseller"]["color"] != "#111111"
    assert after["effective_by_category"][str(category["id"])]["bestseller"]["color"] == "#111111"


async def test_reset_invalidates_the_cached_map(client: AsyncClient, admin_token: str):
    category = await _seed_category(client, admin_token, "Cached Reset")
    await _put_config(client, admin_token, category["id"], bestseller={"label": "TEMP"})
    assert (await client.get(URL)).json()["effective_by_category"][str(category["id"])]["bestseller"]["label"] == "TEMP"

    await client.delete(f"{URL}/{category['id']}", headers=auth(admin_token))
    after = (await client.get(URL)).json()
    assert after["effective_by_category"][str(category["id"])] == after["defaults"]


async def _create_product(
    client: AsyncClient,
    admin_token: str,
    name: str,
    category_id: int,
    price: int = 499,
    extra_category_ids: list[int] | None = None,
    **kwargs,
) -> dict:
    import json

    data: dict[str, str] = {
        "name": name,
        "price": str(price),
        "category_id": str(category_id),
    }
    for k, v in kwargs.items():
        if isinstance(v, (int, float, bool)):
            data[k] = str(v)
        elif isinstance(v, str):
            data[k] = v
    if extra_category_ids is not None:
        data["additional_category_ids"] = json.dumps(extra_category_ids)
    resp = await client.post(
        "/api/v1/products", data=data, headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


async def test_badge_stats_counts_products_correctly(client: AsyncClient, admin_token: str):
    """The admin needs to know if a badge will show on any products."""
    from app.db.models import Product, ProductReview, ReviewStatus
    from tests.conftest import test_session_factory

    plants = await _seed_category(client, admin_token, "Plants")
    indoor = await _seed_category(client, admin_token, "Indoor", parent_id=plants["id"])

    async with test_session_factory() as db:
        p1 = Product(name="P1", slug="p1", price=1000, category_id=indoor["id"], is_bestseller=True, is_active=True)
        p2 = Product(name="P2", slug="p2", price=1000, original_price=1200, category_id=indoor["id"], is_active=True)
        db.add_all([p1, p2])
        await db.commit()
        await db.refresh(p1)
        await db.refresh(p2)

    stats = (await client.get(f"{URL}/{plants['id']}/stats", headers=auth(admin_token))).json()
    assert stats["total"] == 2
    assert stats["bestseller"] == 1
    assert stats["discount"] == 1
    assert stats["rating"] == 0


async def test_badge_stats_respects_parent_inheritance_scope(client: AsyncClient, admin_token: str):
    from app.db.models import Product
    from tests.conftest import test_session_factory

    root = await _seed_category(client, admin_token, "Root")
    mid = await _seed_category(client, admin_token, "Mid", parent_id=root["id"])
    leaf = await _seed_category(client, admin_token, "Leaf", parent_id=mid["id"])

    async with test_session_factory() as db:
        db.add(Product(name="L", slug="l", price=500, category_id=leaf["id"], is_active=True))
        await db.commit()

    stats_root = (await client.get(f"{URL}/{root['id']}/stats", headers=auth(admin_token))).json()
    assert stats_root["total"] == 1
    stats_mid = (await client.get(f"{URL}/{mid['id']}/stats", headers=auth(admin_token))).json()
    assert stats_mid["total"] == 1


async def test_badge_stats_requires_admin(client: AsyncClient):
    r = await client.get(f"{URL}/1/stats")
    assert r.status_code == 401 or r.status_code == 403


async def test_badge_stats_404_if_unknown(client: AsyncClient, admin_token: str):
    r = await client.get(f"{URL}/999999/stats", headers=auth(admin_token))
    assert r.status_code == 404
