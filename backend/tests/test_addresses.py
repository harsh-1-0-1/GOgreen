import pytest
from httpx import AsyncClient

from tests.conftest import _register_user

pytestmark = pytest.mark.asyncio

ADDR = {
    "full_name": "Harsh",
    "phone": "9876543210",
    "line1": "42 Plant Street",
    "city": "Pune",
    "state": "Maharashtra",
    "pincode": "411001",
}


async def test_create_and_list(client: AsyncClient):
    token = await _register_user(client)
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.post("/api/v1/addresses", json=ADDR, headers=headers)
    assert resp.status_code == 201
    addr_id = resp.json()["id"]

    resp2 = await client.get("/api/v1/addresses", headers=headers)
    assert resp2.status_code == 200
    assert any(a["id"] == addr_id for a in resp2.json())


async def test_update_address(client: AsyncClient):
    token = await _register_user(client)
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.post("/api/v1/addresses", json=ADDR, headers=headers)
    addr_id = resp.json()["id"]

    resp2 = await client.put(
        f"/api/v1/addresses/{addr_id}",
        json={"city": "Mumbai"},
        headers=headers,
    )
    assert resp2.status_code == 200
    assert resp2.json()["city"] == "Mumbai"


async def test_delete_address(client: AsyncClient):
    token = await _register_user(client)
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.post("/api/v1/addresses", json=ADDR, headers=headers)
    addr_id = resp.json()["id"]

    resp2 = await client.delete(f"/api/v1/addresses/{addr_id}", headers=headers)
    assert resp2.status_code == 204


async def test_default_address_toggle(client: AsyncClient):
    token = await _register_user(client)
    headers = {"Authorization": f"Bearer {token}"}

    resp1 = await client.post("/api/v1/addresses", json={**ADDR, "is_default": True}, headers=headers)
    resp1.json()["id"]

    addr2 = {**ADDR, "full_name": "Second", "is_default": True}
    resp2 = await client.post("/api/v1/addresses", json=addr2, headers=headers)
    id2 = resp2.json()["id"]

    all_resp = await client.get("/api/v1/addresses", headers=headers)
    addrs = all_resp.json()
    defaults = [a for a in addrs if a["is_default"]]
    assert len(defaults) == 1
    assert defaults[0]["id"] == id2


async def test_requires_auth(client: AsyncClient):
    resp = await client.get("/api/v1/addresses")
    assert resp.status_code == 401
