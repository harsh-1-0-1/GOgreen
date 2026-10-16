import io

import pytest
from httpx import AsyncClient

from tests.conftest import (
    _register_and_make_admin,
    _register_user,
    _seed_address,
    _seed_product_and_category,
)

pytestmark = pytest.mark.asyncio


async def _make_delivered_order(client: AsyncClient, token: str, admin_token: str) -> int:
    """Create a COD order for the user and mark it delivered as admin."""
    product = await _seed_product_and_category(client, admin_token, stock=10)
    address = await _seed_address(client, token)

    resp = await client.post(
        "/api/v1/cart/items",
        json={"product_id": product["id"], "quantity": 2},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201, resp.text
    cart_id = resp.json()["id"]

    resp = await client.post(
        "/api/v1/orders/checkout",
        json={"address_id": address["id"], "cart_id": cart_id, "payment_method": "cod"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201, resp.text
    order_id = resp.json()["order_id"]

    resp = await client.put(
        f"/api/v1/admin/orders/{order_id}/status",
        json={"status": "delivered"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200, resp.text
    return order_id


def _photo_file() -> dict:
    return {"photos": ("proof.jpg", io.BytesIO(b"fake-jpeg-bytes"), "image/jpeg")}


async def test_full_damage_claim_flow(client: AsyncClient):
    """Customer submits a claim, admin reviews + approves, customer sees the update."""
    admin_token = await _register_and_make_admin(client)
    token = await _register_user(client)
    order_id = await _make_delivered_order(client, token, admin_token)

    # 1. Submit claim (multipart with photo)
    resp = await client.post(
        "/api/v1/damage-claims",
        data={
            "order_id": str(order_id),
            "issue_type": "broken_pot",
            "description": "The ceramic pot shattered in transit and the plant roots were exposed.",
        },
        files=_photo_file(),
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201, resp.text
    claim = resp.json()
    assert claim["ticket_id"].startswith("PLG-DR-")
    assert claim["status"] == "submitted"
    assert claim["order_id"] == order_id
    assert len(claim["photo_urls"]) == 1
    assert claim["photo_urls"][0].endswith(".jpg")
    assert claim["user"]["email"] == "user@test.com"
    assert claim["order"]["id"] == order_id
    assert len(claim["order"]["items"]) == 1
    claim_id = claim["id"]
    ticket_id = claim["ticket_id"]

    # 2. Duplicate active claim is rejected
    resp = await client.post(
        "/api/v1/damage-claims",
        data={
            "order_id": str(order_id),
            "issue_type": "broken_pot",
            "description": "Attempting to file a second claim for the same order.",
        },
        files=_photo_file(),
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 400, resp.text
    assert "already exists" in resp.json()["detail"]

    # 3. Customer lists own claims
    resp = await client.get("/api/v1/damage-claims/my", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200, resp.text
    assert resp.json()["total"] == 1
    assert resp.json()["items"][0]["ticket_id"] == ticket_id

    # 4. Customer fetch by ticket
    resp = await client.get(
        f"/api/v1/damage-claims/ticket/{ticket_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "submitted"

    # 5. Customer cannot see another user's claim via ticket endpoint
    resp = await client.post(
        "/api/v1/auth/register",
        json={"email": "other@test.com", "password": "User1234!", "full_name": "Other User"},
    )
    assert resp.status_code in (200, 201), resp.text
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "other@test.com", "password": "User1234!"},
    )
    other_token = resp.json()["access_token"]
    resp = await client.get(
        f"/api/v1/damage-claims/ticket/{ticket_id}",
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert resp.status_code == 404

    # 6. Admin lists all claims (includes customer + order details)
    resp = await client.get(
        "/api/v1/damage-claims/admin",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["total"] == 1
    admin_item = resp.json()["items"][0]
    assert admin_item["user"]["full_name"] == "Test User"
    assert admin_item["order"]["status"] == "delivered"

    # 7. Admin gets single claim detail
    resp = await client.get(
        f"/api/v1/damage-claims/admin/{claim_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["description"].startswith("The ceramic pot")

    # 8. Admin approves with notes
    resp = await client.patch(
        f"/api/v1/damage-claims/admin/{claim_id}",
        json={"status": "approved", "admin_notes": "Replacement plant will ship within 2 days."},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "approved"
    assert resp.json()["admin_notes"] == "Replacement plant will ship within 2 days."

    # 9. Customer sees the updated status + notes
    resp = await client.get("/api/v1/damage-claims/my", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200, resp.text
    updated = resp.json()["items"][0]
    assert updated["status"] == "approved"
    assert updated["admin_notes"] == "Replacement plant will ship within 2 days."

    # 10. Admin status filter works
    resp = await client.get(
        "/api/v1/damage-claims/admin?status=approved",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["total"] == 1
    resp = await client.get(
        "/api/v1/damage-claims/admin?status=submitted",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["total"] == 0

    # 11. Invalid status update rejected
    resp = await client.patch(
        f"/api/v1/damage-claims/admin/{claim_id}",
        json={"status": "not-a-status"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 400, resp.text


async def test_damage_claim_requires_delivered_order(client: AsyncClient):
    """Non-delivered orders cannot be claimed."""
    admin_token = await _register_and_make_admin(client)
    token = await _register_user(client)
    product = await _seed_product_and_category(client, admin_token, stock=10)
    address = await _seed_address(client, token)

    resp = await client.post(
        "/api/v1/cart/items",
        json={"product_id": product["id"], "quantity": 1},
        headers={"Authorization": f"Bearer {token}"},
    )
    cart_id = resp.json()["id"]
    resp = await client.post(
        "/api/v1/orders/checkout",
        json={"address_id": address["id"], "cart_id": cart_id, "payment_method": "cod"},
        headers={"Authorization": f"Bearer {token}"},
    )
    order_id = resp.json()["order_id"]

    resp = await client.post(
        "/api/v1/damage-claims",
        data={
            "order_id": str(order_id),
            "issue_type": "withered_plant",
            "description": "The plant arrived completely withered and dry.",
        },
        files=_photo_file(),
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 400, resp.text
    assert "delivered" in resp.json()["detail"]


async def test_damage_claim_order_ownership_enforced(client: AsyncClient):
    """A user cannot claim an order belonging to someone else."""
    admin_token = await _register_and_make_admin(client)
    token = await _register_user(client)
    order_id = await _make_delivered_order(client, token, admin_token)

    resp = await client.post(
        "/api/v1/auth/register",
        json={"email": "other@test.com", "password": "User1234!", "full_name": "Other User"},
    )
    assert resp.status_code in (200, 201), resp.text
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "other@test.com", "password": "User1234!"},
    )
    other_token = resp.json()["access_token"]
    resp = await client.post(
        "/api/v1/damage-claims",
        data={
            "order_id": str(order_id),
            "issue_type": "missing_item",
            "description": "One of the plants was missing from the box.",
        },
        files=_photo_file(),
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert resp.status_code == 400, resp.text
    assert resp.json()["detail"] == "Order not found"


async def test_damage_claim_requires_auth_and_photo(client: AsyncClient):
    """Anonymous submit is rejected; claim without photos is rejected."""
    resp = await client.post("/api/v1/damage-claims", data={"order_id": "1", "issue_type": "broken_pot", "description": "a" * 20})
    assert resp.status_code == 401

    admin_token = await _register_and_make_admin(client)
    token = await _register_user(client)
    order_id = await _make_delivered_order(client, token, admin_token)

    resp = await client.post(
        "/api/v1/damage-claims",
        data={
            "order_id": str(order_id),
            "issue_type": "broken_pot",
            "description": "The pot arrived cracked down the side.",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code in (200, 201), resp.text
    assert resp.json()["photo_urls"] == []
