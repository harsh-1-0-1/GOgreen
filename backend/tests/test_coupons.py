import pytest
from httpx import AsyncClient

from tests.conftest import (
    _register_and_make_admin,
    _register_user,
    _seed_address,
    _seed_product_and_category,
    test_session_factory,
)

pytestmark = pytest.mark.asyncio


async def _create_coupon(admin_token: str, client: AsyncClient, body: dict) -> dict:
    resp = await client.post(
        "/api/v1/admin/coupons",
        json=body,
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _seed_coupon(code: str, ctype: str = "percent", value: float = 10.0,
                       min_amount: float = 0.0, is_active: bool = True) -> dict:
    from app.db.models import Coupon, CouponType
    async with test_session_factory() as db:
        c = Coupon(
            code=code,
            type=CouponType(ctype),
            value=value,
            min_amount=min_amount,
            is_active=is_active,
            times_used=0,
        )
        db.add(c)
        await db.commit()
        await db.refresh(c)
        return {"id": c.id, "code": c.code, "type": c.type.value, "value": c.value, "min_amount": c.min_amount}


async def test_validate_percent_coupon(client: AsyncClient):
    await _seed_coupon("SAVE10", ctype="percent", value=10, min_amount=100)
    token = await _register_user(client)

    resp = await client.post(
        "/api/v1/coupons/validate",
        json={"code": "save10", "subtotal": 1000},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["valid"] is True
    assert data["code"] == "SAVE10"
    assert data["type"] == "percent"
    assert data["discount_amount"] == 100.0


async def test_validate_fixed_coupon(client: AsyncClient):
    await _seed_coupon("FIXED50", ctype="fixed", value=50)
    token = await _register_user(client)

    resp = await client.post(
        "/api/v1/coupons/validate",
        json={"code": "fixed50", "subtotal": 500},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["discount_amount"] == 50.0


async def test_validate_min_amount_not_met(client: AsyncClient):
    await _seed_coupon("MIN500", ctype="percent", value=10, min_amount=500)
    token = await _register_user(client)

    resp = await client.post(
        "/api/v1/coupons/validate",
        json={"code": "min500", "subtotal": 200},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 400
    assert "minimum order" in resp.json()["detail"]


async def test_validate_invalid_code(client: AsyncClient):
    token = await _register_user(client)
    resp = await client.post(
        "/api/v1/coupons/validate",
        json={"code": "NOPE", "subtotal": 500},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 400
    assert "invalid" in resp.json()["detail"].lower()


async def test_validate_inactive_coupon(client: AsyncClient):
    await _seed_coupon("OFF", ctype="percent", value=10, is_active=False)
    token = await _register_user(client)
    resp = await client.post(
        "/api/v1/coupons/validate",
        json={"code": "off", "subtotal": 500},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 400
    assert "no longer active" in resp.json()["detail"]


async def test_checkout_applies_percent_coupon_and_increments_usage(client: AsyncClient):
    admin = await _register_and_make_admin(client)
    product = await _seed_product_and_category(client, admin, stock=10)
    await _seed_coupon("WELCOME", ctype="percent", value=10)
    token = await _register_user(client)
    address = await _seed_address(client, token)

    cart_resp = await client.post(
        "/api/v1/cart/items",
        json={"product_id": product["id"], "quantity": 2},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert cart_resp.status_code == 201
    subtotal = 2 * product["price"]

    resp = await client.post(
        "/api/v1/orders/checkout",
        json={
            "address_id": address["id"],
            "cart_id": cart_resp.json()["id"],
            "payment_method": "cod",
            "coupon_code": "welcome",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201, resp.text

    detail = await client.get(
        f"/api/v1/orders/{resp.json()['order_id']}",
        headers={"Authorization": f"Bearer {token}"},
    )
    order = detail.json()
    assert order["coupon_code"] == "WELCOME"
    assert abs(order["coupon_discount"] - round(subtotal * 0.1, 2)) < 0.01
    assert abs(order["total_amount"] - (subtotal - round(subtotal * 0.1, 2))) < 0.01

    from app.db.models import Coupon
    async with test_session_factory() as db:
        from sqlalchemy import select
        coupon = (await db.execute(select(Coupon).where(Coupon.code == "WELCOME"))).scalar_one()
        assert coupon.times_used == 1


async def test_checkout_coupon_below_min_rejects(client: AsyncClient):
    admin = await _register_and_make_admin(client)
    product = await _seed_product_and_category(client, admin, stock=10)
    await _seed_coupon("BIG500", ctype="percent", value=10, min_amount=500)
    token = await _register_user(client)
    address = await _seed_address(client, token)

    cart_resp = await client.post(
        "/api/v1/cart/items",
        json={"product_id": product["id"], "quantity": 1},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert cart_resp.status_code == 201

    resp = await client.post(
        "/api/v1/orders/checkout",
        json={
            "address_id": address["id"],
            "cart_id": cart_resp.json()["id"],
            "payment_method": "cod",
            "coupon_code": "big500",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 400
    assert "minimum order" in resp.json()["detail"]


async def test_direct_checkout_applies_fixed_coupon(client: AsyncClient):
    admin = await _register_and_make_admin(client)
    product = await _seed_product_and_category(client, admin, stock=5)
    await _seed_coupon("FLAT100", ctype="fixed", value=100)
    token = await _register_user(client)
    address = await _seed_address(client, token)

    resp = await client.post(
        "/api/v1/orders/direct-checkout",
        json={
            "address_id": address["id"],
            "items": [{"product_id": product["id"], "quantity": 1}],
            "payment_method": "cod",
            "coupon_code": "flat100",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201, resp.text

    detail = await client.get(
        f"/api/v1/orders/{resp.json()['order_id']}",
        headers={"Authorization": f"Bearer {token}"},
    )
    order = detail.json()
    assert order["coupon_code"] == "FLAT100"
    assert abs(order["coupon_discount"] - 100.0) < 0.01
    assert abs(order["total_amount"] - (product["price"] - 100)) < 0.01


async def test_fixed_coupon_cannot_exceed_subtotal(client: AsyncClient):
    admin = await _register_and_make_admin(client)
    product = await _seed_product_and_category(client, admin, stock=3)
    await _seed_coupon("BIGGIE", ctype="fixed", value=99999)
    token = await _register_user(client)
    address = await _seed_address(client, token)

    cart_resp = await client.post(
        "/api/v1/cart/items",
        json={"product_id": product["id"], "quantity": 1},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert cart_resp.status_code == 201

    resp = await client.post(
        "/api/v1/orders/checkout",
        json={
            "address_id": address["id"],
            "cart_id": cart_resp.json()["id"],
            "payment_method": "cod",
            "coupon_code": "biggie",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201, resp.text
    order = (await client.get(
        f"/api/v1/orders/{resp.json()['order_id']}",
        headers={"Authorization": f"Bearer {token}"},
    )).json()
    assert order["total_amount"] == 0.0


async def test_admin_coupon_crud(client: AsyncClient):
    admin = await _register_and_make_admin(client)

    created = await _create_coupon(admin, client, {
        "code": " launch20 ",
        "type": "percent",
        "value": 20,
        "min_amount": 0,
        "is_active": True,
    })
    assert created["code"] == "LAUNCH20"

    resp = await client.get("/api/v1/admin/coupons", headers={"Authorization": f"Bearer {admin}"})
    assert resp.status_code == 200
    assert len(resp.json()) == 1

    resp = await client.patch(
        f"/api/v1/admin/coupons/{created['id']}",
        json={"is_active": False},
        headers={"Authorization": f"Bearer {admin}"},
    )
    assert resp.status_code == 200
    assert resp.json()["is_active"] is False

    resp = await client.delete(
        f"/api/v1/admin/coupons/{created['id']}",
        headers={"Authorization": f"Bearer {admin}"},
    )
    assert resp.status_code == 204

    resp = await client.get("/api/v1/admin/coupons", headers={"Authorization": f"Bearer {admin}"})
    assert resp.json() == []


async def test_admin_coupon_duplicate_code_conflicts(client: AsyncClient):
    admin = await _register_and_make_admin(client)
    await _create_coupon(admin, client, {"code": "DUP", "type": "percent", "value": 10})
    resp = await client.post(
        "/api/v1/admin/coupons",
        json={"code": "dup", "type": "percent", "value": 15},
        headers={"Authorization": f"Bearer {admin}"},
    )
    assert resp.status_code == 409


async def test_coupons_require_auth(client: AsyncClient):
    resp = await client.post("/api/v1/coupons/validate", json={"code": "X", "subtotal": 100})
    assert resp.status_code in (401, 403)
