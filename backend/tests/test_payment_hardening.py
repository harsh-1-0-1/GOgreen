"""
Payment system hardening tests:
- Duplicate webhook delivery (idempotency)
- Out-of-order webhook (payment.captured before order exists / after already PAID)
- Amount mismatch (webhook amount != order total)
- Race condition: two customers buying the last unit simultaneously
"""

import asyncio
import hashlib
import hmac
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.db.models import Order, PaymentStatus, Product, WebhookEvent
from tests.conftest import (
    _register_and_make_admin,
    _seed_address,
    _seed_product_and_category,
    test_session_factory,
)

pytestmark = pytest.mark.asyncio

WEBHOOK_SECRET = "test_webhook_secret"


def _make_webhook_payload(order_id: int, payment_id: str, amount: int) -> bytes:
    """Build a minimal payment.captured payload."""
    payload = {
        "id": f"evt_{payment_id}",
        "event": "payment.captured",
        "payload": {
            "payment": {
                "entity": {
                    "id": payment_id,
                    "amount": amount,
                    "notes": {"order_id": str(order_id), "source": "checkout"},
                }
            }
        },
    }
    return json.dumps(payload).encode()


def _sign(payload_bytes: bytes, secret: str = WEBHOOK_SECRET) -> str:
    return hmac.new(secret.encode("utf-8"), payload_bytes, hashlib.sha256).hexdigest()


def _webhook_headers(payload_bytes: bytes, event_id: str, secret: str = WEBHOOK_SECRET) -> dict:
    return {
        "Content-Type": "application/json",
        "X-Razorpay-Signature": _sign(payload_bytes, secret),
        "x-razorpay-event-id": event_id,
    }


# ─────────────────────────────────────────────────────────────────
# Shared helpers
# ─────────────────────────────────────────────────────────────────

async def _bootstrap_paid_order(
    client: AsyncClient,
    monkeypatch,
    stock: int = 50,
    quantity: int = 1,
    price: float = 100.0,
) -> tuple[int, int, str]:
    """
    Registers admin + customer, seeds a product, adds to cart,
    runs checkout with mocked Razorpay, returns (order_id, product_id, user_token).
    """
    monkeypatch.setattr("app.core.config.settings.RAZORPAY_KEY_ID", "rzp_test_key")
    monkeypatch.setattr("app.core.config.settings.RAZORPAY_KEY_SECRET", "rzp_test_secret")
    monkeypatch.setattr("app.core.config.settings.RAZORPAY_WEBHOOK_SECRET", WEBHOOK_SECRET)

    admin_token = await _register_and_make_admin(client)
    product = await _seed_product_and_category(client, admin_token, stock=stock, price=price)

    reg_resp = await client.post("/api/v1/auth/register", json={
        "email": "customer@test.com",
        "password": "Secure123!",
        "full_name": "Test Customer",
    })
    assert reg_resp.status_code == 201
    user_token = reg_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {user_token}"}

    cart_resp = await client.post(
        "/api/v1/cart/items",
        json={"product_id": product["id"], "quantity": quantity},
        headers=headers,
    )
    assert cart_resp.status_code == 201
    cart_id = cart_resp.json()["id"]

    addr = await _seed_address(client, user_token)

    mock_resp = MagicMock()
    mock_resp.json.return_value = {"id": "order_mock_rzp", "amount": 0, "currency": "INR"}
    mock_resp.raise_for_status = MagicMock()
    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)
    mock_client.post = AsyncMock(return_value=mock_resp)

    with patch("httpx.AsyncClient", return_value=mock_client):
        checkout_resp = await client.post(
            "/api/v1/orders/checkout",
            json={"address_id": addr["id"], "cart_id": cart_id},
            headers=headers,
        )
    assert checkout_resp.status_code == 201
    order_id = checkout_resp.json()["order_id"]
    return order_id, product["id"], user_token


# ─────────────────────────────────────────────────────────────────
# Test 1: Duplicate webhook delivery
# ─────────────────────────────────────────────────────────────────

async def test_duplicate_webhook_is_idempotent(client: AsyncClient, monkeypatch):
    """
    A webhook delivered twice must be processed exactly once.
    The second delivery must return 200 immediately without changing anything.
    """
    order_id, product_id, _ = await _bootstrap_paid_order(client, monkeypatch)

    # Build a single payload with a fixed event_id (Razorpay uses UUID per event)
    amount_paise = int(100.0 * 100)  # price * 100
    body = _make_webhook_payload(order_id, "pay_dup_test_001", amount_paise)
    headers = _webhook_headers(body, "evt_dup_test_001")

    # First delivery — should succeed and mark order PAID
    r1 = await client.post("/api/v1/payments/razorpay/webhook", content=body, headers=headers)
    assert r1.status_code == 200
    assert r1.json().get("payment_status") == "paid"

    # Second delivery — exact same event_id; must return 200 but do nothing
    r2 = await client.post("/api/v1/payments/razorpay/webhook", content=body, headers=headers)
    assert r2.status_code == 200
    assert r2.json().get("message") == "already processed"

    # Confirm the DB only has one WebhookEvent row for this event_id
    async with test_session_factory() as db:
        rows = (await db.execute(
            select(WebhookEvent).where(WebhookEvent.razorpay_event_id == "evt_dup_test_001")
        )).scalars().all()
        assert len(rows) == 1

    # Confirm the order is still PAID (not double-processed)
    async with test_session_factory() as db:
        order = (await db.execute(select(Order).where(Order.id == order_id))).scalar_one()
        assert order.payment_status == PaymentStatus.PAID


# ─────────────────────────────────────────────────────────────────
# Test 2: Out-of-order / late webhook
# ─────────────────────────────────────────────────────────────────

async def test_out_of_order_webhook_does_not_overwrite_paid(client: AsyncClient, monkeypatch):
    """
    If a payment.captured webhook arrives AFTER the order is already PAID
    (e.g. a delayed duplicate from Razorpay with a different event_id),
    the idempotency guard on mark_paid must prevent any state regression.
    """
    order_id, _, _ = await _bootstrap_paid_order(client, monkeypatch)
    amount_paise = int(100.0 * 100)

    # First webhook: marks order PAID
    body1 = _make_webhook_payload(order_id, "pay_first_001", amount_paise)
    r1 = await client.post(
        "/api/v1/payments/razorpay/webhook",
        content=body1,
        headers=_webhook_headers(body1, "evt_first_001"),
    )
    assert r1.status_code == 200
    assert r1.json().get("payment_status") == "paid"

    # Second webhook: a *different* event_id (so it's NOT an idempotency duplicate)
    # but the order is already PAID — mark_paid should guard against re-processing
    body2 = _make_webhook_payload(order_id, "pay_late_002", amount_paise)
    r2 = await client.post(
        "/api/v1/payments/razorpay/webhook",
        content=body2,
        headers=_webhook_headers(body2, "evt_late_002"),
    )
    assert r2.status_code == 200
    # The mark_paid idempotency guard returns the already-PAID order
    # so we get the current status back (still 'paid'), not an error

    async with test_session_factory() as db:
        order = (await db.execute(select(Order).where(Order.id == order_id))).scalar_one()
        assert order.payment_status == PaymentStatus.PAID


# ─────────────────────────────────────────────────────────────────
# Test 3: Amount mismatch
# ─────────────────────────────────────────────────────────────────

async def test_amount_mismatch_does_not_mark_paid(client: AsyncClient, monkeypatch):
    """
    If the webhook amount (in paise) doesn't match the DB order total,
    the order must NOT be marked as PAID — it stays PENDING.
    """
    order_id, _, _ = await _bootstrap_paid_order(client, monkeypatch, price=100.0)

    # Send ₹1 (100 paise) instead of the actual ₹100 (10000 paise)
    wrong_amount_paise = 100
    body = _make_webhook_payload(order_id, "pay_mismatch_001", wrong_amount_paise)
    r = await client.post(
        "/api/v1/payments/razorpay/webhook",
        content=body,
        headers=_webhook_headers(body, "evt_mismatch_001"),
    )
    # Webhook is accepted (200) but the order update is aborted internally
    assert r.status_code == 200

    async with test_session_factory() as db:
        order = (await db.execute(select(Order).where(Order.id == order_id))).scalar_one()
        # Order must remain PENDING — the mismatch blocked the state transition
        assert order.payment_status == PaymentStatus.PENDING


# ─────────────────────────────────────────────────────────────────
# Test 4: Race condition — last-unit stock contention
# ─────────────────────────────────────────────────────────────────

async def test_race_condition_last_unit(client: AsyncClient, monkeypatch):
    """
    Two customers try to buy the last unit of a product at the same time.
    The atomic SQL update ensures exactly ONE succeeds and the other gets
    a 400 error (insufficient stock).
    Only one order should be created; stock should reach 0.
    """
    monkeypatch.setattr("app.core.config.settings.RAZORPAY_KEY_ID", "rzp_test_key")
    monkeypatch.setattr("app.core.config.settings.RAZORPAY_KEY_SECRET", "rzp_test_secret")
    monkeypatch.setattr("app.core.config.settings.RAZORPAY_WEBHOOK_SECRET", WEBHOOK_SECRET)

    admin_token = await _register_and_make_admin(client)
    # Seed a product with exactly 1 unit in stock
    product = await _seed_product_and_category(client, admin_token, stock=1)
    product_id = product["id"]

    # Register two separate customers
    async def _register_customer(email: str) -> tuple[str, int, int]:
        reg = await client.post("/api/v1/auth/register", json={
            "email": email, "password": "Secure123!", "full_name": "Race Customer",
        })
        assert reg.status_code == 201
        token = reg.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        cart_r = await client.post(
            "/api/v1/cart/items",
            json={"product_id": product_id, "quantity": 1},
            headers=headers,
        )
        assert cart_r.status_code == 201
        cart_id = cart_r.json()["id"]
        addr = await _seed_address(client, token)
        return token, cart_id, addr["id"]

    token_a, cart_a, addr_a = await _register_customer("racer_a@test.com")
    token_b, cart_b, addr_b = await _register_customer("racer_b@test.com")

    mock_resp = MagicMock()
    mock_resp.json.return_value = {"id": "order_mock_race", "amount": 0, "currency": "INR"}
    mock_resp.raise_for_status = MagicMock()
    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)
    mock_client.post = AsyncMock(return_value=mock_resp)

    async def _do_checkout(token: str, cart_id: int, addr_id: int) -> int:
        with patch("httpx.AsyncClient", return_value=mock_client):
            r = await client.post(
                "/api/v1/orders/checkout",
                json={"address_id": addr_id, "cart_id": cart_id},
                headers={"Authorization": f"Bearer {token}"},
            )
        return r.status_code

    # Fire both checkouts concurrently
    results = await asyncio.gather(
        _do_checkout(token_a, cart_a, addr_a),
        _do_checkout(token_b, cart_b, addr_b),
        return_exceptions=True,
    )

    status_codes = [r for r in results if isinstance(r, int)]
    successes = status_codes.count(201)
    failures  = status_codes.count(400)

    # Exactly one should succeed, one should fail with 400 (out of stock)
    assert successes == 1, f"Expected exactly 1 success, got: {status_codes}"
    assert failures  == 1, f"Expected exactly 1 failure, got: {status_codes}"

    # Confirm stock is now 0
    async with test_session_factory() as db:
        p = (await db.execute(select(Product).where(Product.id == product_id))).scalar_one()
        assert p.stock_qty == 0
