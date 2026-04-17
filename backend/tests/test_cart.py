import pytest
from httpx import AsyncClient

from tests.conftest import (
    _register_and_make_admin,
    _register_user,
    _seed_product_and_category,
)

pytestmark = pytest.mark.asyncio


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
