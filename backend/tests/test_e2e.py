"""
Full happy-path end-to-end test:
register → browse products → add to cart → checkout → Razorpay webhook → verify order CONFIRMED
"""

import hashlib
import hmac
import json

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
    # -- Config stubs for Razorpay webhook signature verification --
    monkeypatch.setattr("app.core.config.settings.RAZORPAY_KEY_ID", "rzp_test_key")
    monkeypatch.setattr("app.core.config.settings.RAZORPAY_KEY_SECRET", "rzp_test_secret")
    monkeypatch.setattr("app.core.config.settings.RAZORPAY_WEBHOOK_SECRET", "webhook_secret")

    # Mock the Razorpay order creation HTTP call so we don't need real credentials
    import httpx
    from unittest.mock import AsyncMock, MagicMock, patch

    mock_razorpay_response = MagicMock()
    mock_razorpay_response.json.return_value = {
        "id": "order_test_razorpay_123",
        "amount": 0,
        "currency": "INR",
    }
    mock_razorpay_response.raise_for_status = MagicMock()

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

    # ── 6. Checkout (mocking the Razorpay API call) ──────────
    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)
    mock_client.post = AsyncMock(return_value=mock_razorpay_response)

    with patch("httpx.AsyncClient", return_value=mock_client):
        checkout_resp = await client.post(
            "/api/v1/orders/checkout",
            json={"address_id": addr["id"], "cart_id": cart_id},
            headers=headers,
        )
    assert checkout_resp.status_code == 201
    checkout_data = checkout_resp.json()
    order_id = checkout_data["order_id"]
    razorpay_data = checkout_data["razorpay_order_data"]
    assert razorpay_data is not None

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

    # ── 8. Simulate Razorpay payment.captured webhook ─────────
    razorpay_payment_id = "pay_test_razorpay_12345"
    webhook_payload = {
        "event": "payment.captured",
        "payload": {
            "payment": {
                "entity": {
                    "id": razorpay_payment_id,
                    "amount": 89700,
                    "notes": {
                        "order_id": str(order_id),
                        "source": "checkout",
                    },
                }
            }
        },
    }
    payload_bytes = json.dumps(webhook_payload).encode()

    # Build the HMAC-SHA256 signature (same as Razorpay would send)
    expected_signature = hmac.new(
        "webhook_secret".encode(), payload_bytes, hashlib.sha256
    ).hexdigest()

    webhook_resp = await client.post(
        "/api/v1/payments/razorpay/webhook",
        content=payload_bytes,
        headers={
            "Content-Type": "application/json",
            "X-Razorpay-Signature": expected_signature,
            "x-razorpay-event-id": "evt_test_happy_path_123",
        },
    )
    assert webhook_resp.status_code == 200, webhook_resp.text
    assert webhook_resp.json()["payment_status"] == "paid"

    # ── 9. Verify order is now CONFIRMED ──────────────────────
    final_order = await client.get(f"/api/v1/orders/{order_id}", headers=headers)
    assert final_order.status_code == 200
    assert final_order.json()["status"] == "confirmed"
    assert final_order.json()["payment_status"] == "paid"
    assert final_order.json()["payment_id"] == razorpay_payment_id

    # ── 10. Admin can see stats ───────────────────────────────
    stats_resp = await client.get(
        "/api/v1/admin/stats",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert stats_resp.status_code == 200
    stats = stats_resp.json()
    assert stats["total_orders"] >= 1
    assert stats["total_users"] >= 2  # admin + customer
