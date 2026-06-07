import pytest
from httpx import AsyncClient

from tests.conftest import (
    _register_and_make_admin,
    _seed_category,
    _register_user,
    _seed_product_and_category,
    test_session_factory,
)

pytestmark = pytest.mark.asyncio


VARIANTS = {
    "colors": [
        {"name": "Terracotta", "hex": "#C4622D", "slug": "terracotta"},
        {"name": "Sage Green", "hex": "#7A9E7E", "slug": "sage-green"},
    ],
    "pot_types": [
        {"name": "Plastic", "slug": "plastic", "price_modifier": 0},
        {"name": "Ceramic", "slug": "ceramic", "price_modifier": 150},
    ],
    "image_map": {
        "terracotta__plastic": "https://example.com/terracotta-plastic.jpg",
        "sage-green__ceramic": "https://example.com/sage-ceramic.jpg",
    },
    "default_image": "https://example.com/default.jpg",
    "stock": {
        "terracotta__plastic": 4,
        "terracotta__ceramic": 0,
        "sage-green__plastic": 2,
        "sage-green__ceramic": 3,
    },
}


async def _seed_variant_product(client: AsyncClient, admin_token: str) -> dict:
    cat = await _seed_category(client, admin_token, "Variant Plants")
    from app.db.models import Product
    async with test_session_factory() as db:
        p = Product(
            name="Variant Pothos", slug="variant-pothos", description="Configurable",
            price=200.0, original_price=None, stock_qty=sum(VARIANTS["stock"].values()),
            category_id=cat["id"], images=["https://example.com/base.jpg"],
            tags=["indoor"], variants=VARIANTS, is_active=True,
        )
        db.add(p)
        await db.commit()
        await db.refresh(p)
        return {"id": p.id, "stock_qty": p.stock_qty}


async def test_guest_cart_add_and_get(client: AsyncClient):
    admin = await _register_and_make_admin(client)
    product = await _seed_product_and_category(client, admin, stock=10)

    resp = await client.post("/api/v1/cart/items", json={"product_id": product["id"], "quantity": 2})
    assert resp.status_code == 201
    data = resp.json()
    assert data["item_count"] == 2
    assert len(data["items"]) == 1
    assert data["items"][0]["quantity"] == 2

    cookies = resp.cookies
    resp2 = await client.get("/api/v1/cart", cookies=cookies)
    assert resp2.status_code == 200
    assert resp2.json()["item_count"] == 2


async def test_guest_cart_update_and_remove(client: AsyncClient):
    admin = await _register_and_make_admin(client)
    product = await _seed_product_and_category(client, admin, stock=20)

    resp = await client.post("/api/v1/cart/items", json={"product_id": product["id"], "quantity": 3})
    cookies = resp.cookies
    item_id = resp.json()["items"][0]["id"]

    resp2 = await client.put(f"/api/v1/cart/items/{item_id}", json={"quantity": 5}, cookies=cookies)
    assert resp2.status_code == 200
    assert resp2.json()["items"][0]["quantity"] == 5

    resp3 = await client.put(f"/api/v1/cart/items/{item_id}", json={"quantity": 0}, cookies=cookies)
    assert resp3.status_code == 200
    assert resp3.json()["item_count"] == 0


async def test_stock_validation_on_add(client: AsyncClient):
    admin = await _register_and_make_admin(client)
    product = await _seed_product_and_category(client, admin, stock=2)

    resp = await client.post("/api/v1/cart/items", json={"product_id": product["id"], "quantity": 5})
    assert resp.status_code == 400
    assert "stock" in resp.json()["detail"].lower()


async def test_auth_cart_separate_from_guest(client: AsyncClient):
    admin = await _register_and_make_admin(client)
    product = await _seed_product_and_category(client, admin, stock=10)
    token = await _register_user(client)

    resp_guest = await client.post("/api/v1/cart/items", json={"product_id": product["id"], "quantity": 1})
    assert resp_guest.status_code == 201
    guest_cookies = resp_guest.cookies

    resp_auth = await client.post(
        "/api/v1/cart/items",
        json={"product_id": product["id"], "quantity": 3},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp_auth.status_code == 201
    assert resp_auth.json()["item_count"] == 3

    resp_guest2 = await client.get("/api/v1/cart", cookies=guest_cookies)
    assert resp_guest2.json()["item_count"] == 1


async def test_cart_merge_keeps_higher_qty(client: AsyncClient):
    admin = await _register_and_make_admin(client)
    product = await _seed_product_and_category(client, admin, stock=20)
    token = await _register_user(client)

    resp_guest = await client.post("/api/v1/cart/items", json={"product_id": product["id"], "quantity": 5})
    session_id = resp_guest.cookies.get("cart_session_id")
    assert session_id

    await client.post(
        "/api/v1/cart/items",
        json={"product_id": product["id"], "quantity": 2},
        headers={"Authorization": f"Bearer {token}"},
    )

    resp_merge = await client.post(
        "/api/v1/cart/merge",
        json={"session_id": session_id},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp_merge.status_code == 200
    assert resp_merge.json()["items"][0]["quantity"] == 5


async def test_delete_cart_item(client: AsyncClient):
    admin = await _register_and_make_admin(client)
    product = await _seed_product_and_category(client, admin, stock=10)

    resp = await client.post("/api/v1/cart/items", json={"product_id": product["id"], "quantity": 2})
    cookies = resp.cookies
    item_id = resp.json()["items"][0]["id"]

    resp2 = await client.delete(f"/api/v1/cart/items/{item_id}", cookies=cookies)
    assert resp2.status_code == 200
    assert resp2.json()["item_count"] == 0


async def test_variant_cart_add_returns_computed_fields(client: AsyncClient):
    admin = await _register_and_make_admin(client)
    product = await _seed_variant_product(client, admin)

    resp = await client.post("/api/v1/cart/items", json={
        "product_id": product["id"],
        "quantity": 2,
        "selected_options": {"pot_type": "ceramic", "color": "sage-green"},
    })

    assert resp.status_code == 201, resp.text
    item = resp.json()["items"][0]
    assert item["selected_options"] == {"color": "sage-green", "pot_type": "ceramic"}
    assert item["unit_price"] == 350
    assert item["line_total"] == 700
    assert item["available_stock"] == 3
    assert item["stock_warning"] is False
    assert item["resolved_image_url"] == "https://example.com/sage-ceramic.jpg"


async def test_variant_cart_rejects_invalid_or_sold_out_options(client: AsyncClient):
    admin = await _register_and_make_admin(client)
    product = await _seed_variant_product(client, admin)

    invalid = await client.post("/api/v1/cart/items", json={
        "product_id": product["id"],
        "quantity": 1,
        "selected_options": {"color": "blue", "pot_type": "plastic"},
    })
    assert invalid.status_code == 400

    sold_out = await client.post("/api/v1/cart/items", json={
        "product_id": product["id"],
        "quantity": 1,
        "selected_options": {"color": "terracotta", "pot_type": "ceramic"},
    })
    assert sold_out.status_code == 400


async def test_variant_cart_groups_by_normalized_options(client: AsyncClient):
    admin = await _register_and_make_admin(client)
    product = await _seed_variant_product(client, admin)

    resp = await client.post("/api/v1/cart/items", json={
        "product_id": product["id"],
        "quantity": 1,
        "selected_options": {"pot_type": "plastic", "color": "terracotta"},
    })
    cookies = resp.cookies
    resp2 = await client.post("/api/v1/cart/items", json={
        "product_id": product["id"],
        "quantity": 2,
        "selected_options": {"color": "terracotta", "pot_type": "plastic"},
    }, cookies=cookies)

    assert resp2.status_code == 201, resp2.text
    data = resp2.json()
    assert len(data["items"]) == 1
    assert data["items"][0]["quantity"] == 3
