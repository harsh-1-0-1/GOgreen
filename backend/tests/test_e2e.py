"""
Full happy-path end-to-end test:
register → browse products → add to cart → checkout → PayU webhook → verify order CONFIRMED
"""

import hashlib

import pytest
from httpx import AsyncClient

from tests.conftest import (
    _register_and_make_admin,
    _seed_address,
    _seed_product_and_category,
    test_session_factory,
)

pytestmark = pytest.mark.asyncio


async def test_full_happy_path(client: AsyncClient, monkeypatch):
    # -- Config stubs for PayU hash verification --
    monkeypatch.setattr("app.core.config.settings.PAYU_KEY", "testkey")
    monkeypatch.setattr("app.core.config.settings.PAYU_SALT", "testsalt")
    monkeypatch.setattr("app.services.payu.settings.PAYU_KEY", "testkey")
    monkeypatch.setattr("app.services.payu.settings.PAYU_SALT", "testsalt")

    # ── 1. Admin seeds a product ──────────────────────────────
    admin_token = await _register_and_make_admin(client)
    product = await _seed_product_and_category(client, admin_token, stock=50)
    assert product["stock_qty"] == 50

    # ── 2. Customer registers ─────────────────────────────────
    reg_resp = await client.post("/api/v1/auth/register", json={
        "email": "customer@example.com",
        "password": "Secure123!",
        "full_name": "Happy Customer",
    })
    assert reg_resp.status_code == 201
    tokens = reg_resp.json()
    user_token = tokens["access_token"]
    headers = {"Authorization": f"Bearer {user_token}"}

    # ── 3. Browse products ────────────────────────────────────
    list_resp = await client.get("/api/v1/products")
    assert list_resp.status_code == 200
    assert list_resp.json()["total"] >= 1

    detail_resp = await client.get(f"/api/v1/products/{product['slug']}")
    assert detail_resp.status_code == 200
    assert detail_resp.json()["name"] == product["name"]

    # ── 4. Add to cart ────────────────────────────────────────
    cart_resp = await client.post(
        "/api/v1/cart/items",
        json={"product_id": product["id"], "quantity": 3},
        headers=headers,
    )
    assert cart_resp.status_code == 201
    cart_data = cart_resp.json()
    assert cart_data["item_count"] == 3
    cart_id = cart_data["id"]

    # ── 5. Add address ────────────────────────────────────────
    addr = await _seed_address(client, user_token)
    assert addr["id"] > 0

    # ── 6. Checkout ───────────────────────────────────────────
    checkout_resp = await client.post(
        "/api/v1/orders/checkout",
        json={"address_id": addr["id"], "cart_id": cart_id},
        headers=headers,
    )
    assert checkout_resp.status_code == 201
    checkout_data = checkout_resp.json()
    order_id = checkout_data["order_id"]
    payu_data = checkout_data["payu_form_data"]
    assert payu_data["txnid"] == f"ORDER-{order_id}"

    # Verify cart is now empty
    empty_cart = await client.get("/api/v1/cart", headers=headers)
    assert empty_cart.json()["item_count"] == 0

    # Verify stock decreased
    from app.db.models import Product
    async with test_session_factory() as db:
        from sqlalchemy import select
        p = (await db.execute(select(Product).where(Product.id == product["id"]))).scalar_one()
        assert p.stock_qty == 47  # 50 - 3

    # ── 7. Verify order is PENDING ────────────────────────────
    order_resp = await client.get(f"/api/v1/orders/{order_id}", headers=headers)
    assert order_resp.status_code == 200
    assert order_resp.json()["status"] == "pending"
    assert order_resp.json()["payment_status"] == "pending"

    # ── 8. Simulate PayU success webhook ──────────────────────
    txnid = payu_data["txnid"]
    amount = payu_data["amount"]
    firstname = payu_data["firstname"]
    email = payu_data["email"]
    mihpayid = "PAY-TEST-12345"

    # Build reverse hash: salt|status||||||udf5|...|udf1|email|firstname|productinfo|amount|txnid|key
    reverse_str = (
        f"testsalt|success||||||"
        f"|||||{email}|"
        f"{firstname}|Plantoga Order|{amount}|{txnid}|testkey"
    )
    expected_hash = hashlib.sha512(reverse_str.encode()).hexdigest()

    webhook_resp = await client.post(
        "/api/v1/payments/payu/webhook",
        data={
            "status": "success",
            "txnid": txnid,
            "amount": amount,
            "productinfo": "Plantoga Order",
            "firstname": firstname,
            "email": email,
            "mihpayid": mihpayid,
            "hash": expected_hash,
        },
    )
    assert webhook_resp.status_code == 200, webhook_resp.text
    assert webhook_resp.json()["payment_status"] == "paid"

    # ── 9. Verify order is now CONFIRMED ──────────────────────
    final_order = await client.get(f"/api/v1/orders/{order_id}", headers=headers)
    assert final_order.status_code == 200
    assert final_order.json()["status"] == "confirmed"
    assert final_order.json()["payment_status"] == "paid"
    assert final_order.json()["payment_id"] == mihpayid

    # ── 10. Admin can see stats ───────────────────────────────
    stats_resp = await client.get(
        "/api/v1/admin/stats",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert stats_resp.status_code == 200
    stats = stats_resp.json()
    assert stats["total_orders"] >= 1
    assert stats["total_users"] >= 2  # admin + customer
