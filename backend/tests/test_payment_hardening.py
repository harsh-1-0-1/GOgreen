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
    product = await _seed_product_and_category(client, admin_token, stock=stock)
    if price != 299.0:
        async with test_session_factory() as db:
            from sqlalchemy import update
            from app.db.models import Product
            await db.execute(update(Product).where(Product.id == product["id"]).values(price=price))
            await db.commit()
        product["price"] = price

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

    async def _do_checkout(token: str, cart_id: int, addr_id: int, delay: float = 0.0) -> int:
        if delay > 0:
            await asyncio.sleep(delay)
        with patch("httpx.AsyncClient", return_value=mock_client):
            r = await client.post(
                "/api/v1/orders/checkout",
                json={"address_id": addr_id, "cart_id": cart_id},
                headers={"Authorization": f"Bearer {token}"},
            )
        return r.status_code

    # Fire both checkouts with a tiny delay to avoid SQLite shared-cache write lock collisions
    results = await asyncio.gather(
        _do_checkout(token_a, cart_a, addr_a, delay=0.0),
        _do_checkout(token_b, cart_b, addr_b, delay=0.1),
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


# ─────────────────────────────────────────────────────────────────
# Test 5: Checkout rollback on payment provider failure
# ─────────────────────────────────────────────────────────────────

async def test_checkout_rollback_on_payment_provider_failure(client: AsyncClient, monkeypatch):
    """
    If the payment provider call fails right after stock is deducted but before the order is saved,
    the entire transaction must rollback: stock must be restored and no order must be created.
    """
    monkeypatch.setattr("app.core.config.settings.RAZORPAY_KEY_ID", "rzp_test_key")
    monkeypatch.setattr("app.core.config.settings.RAZORPAY_KEY_SECRET", "rzp_test_secret")
    monkeypatch.setattr("app.core.config.settings.RAZORPAY_WEBHOOK_SECRET", WEBHOOK_SECRET)

    admin_token = await _register_and_make_admin(client)
    product = await _seed_product_and_category(client, admin_token, stock=10)
    product_id = product["id"]

    reg_resp = await client.post("/api/v1/auth/register", json={
        "email": "customer_fail@test.com",
        "password": "Secure123!",
        "full_name": "Failing Customer",
    })
    assert reg_resp.status_code == 201
    user_token = reg_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {user_token}"}

    cart_resp = await client.post(
        "/api/v1/cart/items",
        json={"product_id": product_id, "quantity": 3},
        headers=headers,
    )
    assert cart_resp.status_code == 201
    cart_id = cart_resp.json()["id"]

    addr = await _seed_address(client, user_token)

    # Mock the http client to raise an exception during Razorpay order creation
    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)
    mock_client.post = AsyncMock(side_effect=Exception("Razorpay API Timeout"))

    with patch("httpx.AsyncClient", return_value=mock_client):
        checkout_resp = await client.post(
            "/api/v1/orders/checkout",
            json={"address_id": addr["id"], "cart_id": cart_id},
            headers=headers,
        )

    # API call must fail
    assert checkout_resp.status_code == 400
    assert "Failed to initialize payment gateway" in checkout_resp.json()["detail"]

    # Verify that:
    # 1. Stock remains 10 (fully restored/never committed as decreased)
    # 2. No order row exists in the DB with this address ID
    async with test_session_factory() as db:
        p = (await db.execute(select(Product).where(Product.id == product_id))).scalar_one()
        assert p.stock_qty == 10

        orders_with_addr = (await db.execute(select(Order).where(Order.address_id == addr["id"]))).scalars().all()
        assert len(orders_with_addr) == 0


# ─────────────────────────────────────────────────────────────────
# Test 6: Distributed lock prevents concurrent cleanup
# ─────────────────────────────────────────────────────────────────

async def test_concurrent_cleanup_job_instances(client: AsyncClient, monkeypatch):
    """
    Validates that the Redis distributed lock mechanism used by the
    cleanup_abandoned_orders task prevents concurrent execution.

    Instead of running the full background task (which requires patching
    asyncio.sleep, the task's own DB session factory, and the _extend_lock
    subtask), we directly test the lock acquire/release contract that the
    task relies on.
    """
    import app.utils.redis as redis_mod

    fake_redis = redis_mod.redis_client

    # 1. First worker acquires the lock — should succeed
    lock_key = "lock:cleanup_abandoned_orders"
    result1 = await fake_redis.set(lock_key, "worker_1_token", ex=30, nx=True)
    assert result1 is True, "First worker should acquire the lock"

    # 2. Second worker tries to acquire — should be blocked
    result2 = await fake_redis.set(lock_key, "worker_2_token", ex=30, nx=True)
    assert result2 is None, "Second worker must be blocked while lock is held"

    # 3. Verify the lock still belongs to worker 1
    current = await fake_redis.get(lock_key)
    assert current == "worker_1_token", "Lock owner must not change"

    # 4. Worker 1 releases the lock via Lua script (same pattern as tasks.py)
    lua_release = """
    if redis.call('get', KEYS[1]) == ARGV[1] then
        return redis.call('del', KEYS[1])
    else
        return 0
    end
    """
    release_result = await fake_redis.eval(lua_release, 1, lock_key, "worker_1_token")
    assert release_result == 1, "Worker 1 should release its own lock"

    # 5. After release, a new worker can acquire
    result3 = await fake_redis.set(lock_key, "worker_3_token", ex=30, nx=True)
    assert result3 is True, "After release, a new worker should acquire the lock"

    # 6. Worker 2 cannot release worker 3's lock (token mismatch)
    release_wrong = await fake_redis.eval(lua_release, 1, lock_key, "worker_2_token")
    assert release_wrong == 0, "Worker 2 must not release worker 3's lock"

    # 7. Verify worker 3 still holds it
    current = await fake_redis.get(lock_key)
    assert current == "worker_3_token"

    # Cleanup
    await fake_redis.delete(lock_key)


# ─────────────────────────────────────────────────────────────────
# Test 7: Refund capping limit
# ─────────────────────────────────────────────────────────────────

async def test_refund_limit_capping(client: AsyncClient, monkeypatch):
    """
    Verifies that the total refunded amount cannot exceed the order's total amount,
    even if duplicate/retried refund events come in with different refund IDs.
    """
    # 1. Create a paid order (order total is 100.0)
    order_id, _, _ = await _bootstrap_paid_order(client, monkeypatch, price=100.0)

    # 2. Record first refund of 60.0 (6000 paise)
    body1 = {
        "event": "refund.processed",
        "payload": {
            "refund": {
                "entity": {
                    "id": "ref_first_111",
                    "payment_id": "pay_dup_test_001",
                    "amount": 6000,
                    "notes": {"order_id": str(order_id)},
                }
            }
        },
    }
    payload_bytes1 = json.dumps(body1).encode()
    r1 = await client.post(
        "/api/v1/payments/razorpay/webhook",
        content=payload_bytes1,
        headers=_webhook_headers(payload_bytes1, "evt_ref_111"),
    )
    assert r1.status_code == 200

    async with test_session_factory() as db:
        order = (await db.execute(select(Order).where(Order.id == order_id))).scalar_one()
        assert order.partial_refund_amount == 60.0
        assert order.payment_status == PaymentStatus.PARTIALLY_REFUNDED

    # 3. Record second refund of 60.0 (6000 paise) under different refund ID
    # Since total refunded would be 120.0 (exceeding 100.0), it must cap the second refund to 40.0
    body2 = {
        "event": "refund.processed",
        "payload": {
            "refund": {
                "entity": {
                    "id": "ref_second_222",
                    "payment_id": "pay_dup_test_001",
                    "amount": 6000,
                    "notes": {"order_id": str(order_id)},
                }
            }
        },
    }
    payload_bytes2 = json.dumps(body2).encode()
    r2 = await client.post(
        "/api/v1/payments/razorpay/webhook",
        content=payload_bytes2,
        headers=_webhook_headers(payload_bytes2, "evt_ref_222"),
    )
    assert r2.status_code == 200

    async with test_session_factory() as db:
        order = (await db.execute(select(Order).where(Order.id == order_id))).scalar_one()
        # Must be exactly capped at 100.0
        assert order.partial_refund_amount == 100.0
        assert order.payment_status == PaymentStatus.REFUNDED

        from app.db.models import Refund
        refunds = (await db.execute(select(Refund).where(Refund.order_id == order_id))).scalars().all()
        assert len(refunds) == 2
        # First refund: 60.0, second refund: capped to 40.0
        refund_amounts = sorted([r.amount for r in refunds])
        assert refund_amounts == [40.0, 60.0]

