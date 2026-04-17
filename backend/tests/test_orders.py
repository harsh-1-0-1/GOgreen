import pytest
from httpx import AsyncClient

from tests.conftest import (
    _register_and_make_admin,
    _register_user,
    _seed_address,
    _seed_product_and_category,
)

pytestmark = pytest.mark.asyncio


async def _setup_cart(client: AsyncClient, token: str, product_id: int, quantity: int = 2) -> int:
    resp = await client.post(
        "/api/v1/cart/items",
        json={"product_id": product_id, "quantity": quantity},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    return resp.json()["id"]


async def test_checkout_success(client: AsyncClient):
    admin = await _register_and_make_admin(client)
    product = await _seed_product_and_category(client, admin, stock=10)
    token = await _register_user(client)
    address = await _seed_address(client, token)
    cart_id = await _setup_cart(client, token, product["id"], quantity=2)

    resp = await client.post(
        "/api/v1/orders/checkout",
        json={"address_id": address["id"], "cart_id": cart_id},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["order_id"] > 0
    assert "payu_form_data" in data
    assert data["payu_form_data"]["txnid"] == f"ORDER-{data['order_id']}"


async def test_checkout_clears_cart(client: AsyncClient):
    admin = await _register_and_make_admin(client)
    product = await _seed_product_and_category(client, admin, stock=10)
    token = await _register_user(client)
    address = await _seed_address(client, token)
    cart_id = await _setup_cart(client, token, product["id"], quantity=1)

    await client.post(
        "/api/v1/orders/checkout",
        json={"address_id": address["id"], "cart_id": cart_id},
        headers={"Authorization": f"Bearer {token}"},
    )

    resp = await client.get("/api/v1/cart", headers={"Authorization": f"Bearer {token}"})
    assert resp.json()["item_count"] == 0


async def test_checkout_insufficient_stock(client: AsyncClient):
    admin = await _register_and_make_admin(client)
    product = await _seed_product_and_category(client, admin, stock=1)
    token = await _register_user(client)
    address = await _seed_address(client, token)
    cart_id = await _setup_cart(client, token, product["id"], quantity=1)

    # Drain the stock by direct DB update so checkout fails
    from sqlalchemy import update

    from app.db.models import Product
    from tests.conftest import test_session_factory
    async with test_session_factory() as db:
        await db.execute(update(Product).where(Product.id == product["id"]).values(stock_qty=0))
        await db.commit()

    resp = await client.post(
        "/api/v1/orders/checkout",
        json={"address_id": address["id"], "cart_id": cart_id},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 400
    assert "stock" in resp.json()["detail"].lower()


async def test_checkout_empty_cart(client: AsyncClient):
    await _register_and_make_admin(client)
    token = await _register_user(client)
    address = await _seed_address(client, token)

    # Create an empty cart
    resp = await client.get("/api/v1/cart", headers={"Authorization": f"Bearer {token}"})
    cart_id = resp.json()["id"]

    resp = await client.post(
        "/api/v1/orders/checkout",
        json={"address_id": address["id"], "cart_id": cart_id},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 400


async def test_order_list_and_detail(client: AsyncClient):
    admin = await _register_and_make_admin(client)
    product = await _seed_product_and_category(client, admin, stock=20)
    token = await _register_user(client)
    address = await _seed_address(client, token)
    cart_id = await _setup_cart(client, token, product["id"], quantity=2)

    checkout_resp = await client.post(
        "/api/v1/orders/checkout",
        json={"address_id": address["id"], "cart_id": cart_id},
        headers={"Authorization": f"Bearer {token}"},
    )
    order_id = checkout_resp.json()["order_id"]

    list_resp = await client.get("/api/v1/orders", headers={"Authorization": f"Bearer {token}"})
    assert list_resp.status_code == 200
    assert list_resp.json()["total"] == 1

    detail_resp = await client.get(
        f"/api/v1/orders/{order_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert detail_resp.status_code == 200
    assert detail_resp.json()["id"] == order_id
    assert len(detail_resp.json()["items"]) == 1


async def test_checkout_requires_auth(client: AsyncClient):
    resp = await client.post("/api/v1/orders/checkout", json={"address_id": 1, "cart_id": 1})
    assert resp.status_code == 401
