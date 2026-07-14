import pytest
from httpx import AsyncClient

from tests.conftest import (
    _register_and_make_admin,
    _register_user,
    _seed_address,
    _seed_category,
    _seed_product_and_category,
    test_session_factory,
)

pytestmark = pytest.mark.asyncio


ORDER_VARIANTS = {
    "colors": [
        {"name": "Terracotta", "hex": "#C4622D", "slug": "terracotta"},
        {"name": "Sage Green", "hex": "#7A9E7E", "slug": "sage-green"},
    ],
    "pot_types": [
        {"name": "Plastic", "slug": "plastic", "price_modifier": 0},
        {"name": "Ceramic", "slug": "ceramic", "price_modifier": 150},
    ],
    "image_map": {
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
    cat = await _seed_category(client, admin_token, "Order Variant Plants")
    from app.db.models import Product
    async with test_session_factory() as db:
        p = Product(
            name="Order Variant Pothos", slug="order-variant-pothos", description="Configurable",
            price=200.0, original_price=None, stock_qty=sum(ORDER_VARIANTS["stock"].values()),
            category_id=cat["id"], images=["https://example.com/base.jpg"],
            tags=["indoor"], variants=ORDER_VARIANTS, is_active=True,
        )
        db.add(p)
        await db.commit()
        await db.refresh(p)
        return {"id": p.id, "stock_qty": p.stock_qty}


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
    assert "razorpay_order_data" in data
    assert data["razorpay_order_data"] is not None


async def test_checkout_cod_skips_razorpay_and_records_payment_method(client: AsyncClient, monkeypatch):
    monkeypatch.setattr("app.core.config.settings.WHATSAPP_ACCESS_TOKEN", "")
    admin = await _register_and_make_admin(client)
    product = await _seed_product_and_category(client, admin, stock=10)
    token = await _register_user(client)
    address = await _seed_address(client, token)
    cart_id = await _setup_cart(client, token, product["id"], quantity=1)

    resp = await client.post(
        "/api/v1/orders/checkout",
        json={"address_id": address["id"], "cart_id": cart_id, "payment_method": "cod"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["order_id"] > 0
    assert data["razorpay_order_data"] is None

    detail_resp = await client.get(
        f"/api/v1/orders/{data['order_id']}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert detail_resp.status_code == 200
    detail = detail_resp.json()
    assert detail["payment_method"] == "cod"
    assert detail["payment_status"] == "pending"


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


async def test_variant_checkout_decrements_combo_stock_and_snapshots_options(client: AsyncClient):
    admin = await _register_and_make_admin(client)
    product = await _seed_variant_product(client, admin)
    token = await _register_user(client)
    address = await _seed_address(client, token)
    add_resp = await client.post(
        "/api/v1/cart/items",
        json={
            "product_id": product["id"],
            "quantity": 2,
            "selected_options": {"color": "sage-green", "pot_type": "ceramic"},
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert add_resp.status_code == 201, add_resp.text
    cart_id = add_resp.json()["id"]

    checkout_resp = await client.post(
        "/api/v1/orders/checkout",
        json={"address_id": address["id"], "cart_id": cart_id},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert checkout_resp.status_code == 201, checkout_resp.text
    order_id = checkout_resp.json()["order_id"]

    detail_resp = await client.get(
        f"/api/v1/orders/{order_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    item = detail_resp.json()["items"][0]
    assert item["unit_price"] == 350
    assert item["selected_options"] == {"color": "sage-green", "pot_type": "ceramic"}
    assert item["resolved_image_url"] == "https://example.com/sage-ceramic.jpg"

    from app.db.models import Product
    async with test_session_factory() as db:
        db_product = await db.get(Product, product["id"])
        assert db_product.variants["stock"]["sage-green__ceramic"] == 1
        assert db_product.stock_qty == sum(db_product.variants["stock"].values())
