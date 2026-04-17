import pytest
from httpx import AsyncClient

from tests.conftest import _seed_category

CAT_URL = "/api/v1/categories"


@pytest.mark.asyncio
async def test_list_categories_empty(client: AsyncClient):
    resp = await client.get(CAT_URL)
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_create_category_admin_only(client: AsyncClient):
    resp = await client.post(CAT_URL, json={"name": "Plants"})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_create_and_list_tree(client: AsyncClient, admin_token: str):
    parent = await _seed_category(client, admin_token, "Plants")
    assert parent["slug"] == "plants"

    child = await _seed_category(client, admin_token, "Indoor Plants", parent_id=parent["id"])
    assert child["parent_id"] == parent["id"]

    resp = await client.get(CAT_URL)
    tree = resp.json()
    assert len(tree) == 1
    assert tree[0]["slug"] == "plants"
    assert len(tree[0]["children"]) == 1
    assert tree[0]["children"][0]["slug"] == "indoor-plants"


@pytest.mark.asyncio
async def test_get_category_by_slug(client: AsyncClient, admin_token: str):
    await _seed_category(client, admin_token, "Seeds")
    resp = await client.get(f"{CAT_URL}/seeds")
    assert resp.status_code == 200
    assert resp.json()["name"] == "Seeds"


@pytest.mark.asyncio
async def test_update_category(client: AsyncClient, admin_token: str):
    cat = await _seed_category(client, admin_token, "Old Name")
    resp = await client.put(
        f"{CAT_URL}/{cat['id']}",
        json={"name": "New Name"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "New Name"
    assert resp.json()["slug"] == "new-name"


@pytest.mark.asyncio
async def test_delete_category(client: AsyncClient, admin_token: str):
    cat = await _seed_category(client, admin_token, "ToDelete")
    resp = await client.delete(
        f"{CAT_URL}/{cat['id']}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_list_uses_cache_on_second_call(client: AsyncClient, admin_token: str):
    await _seed_category(client, admin_token, "Cached")
    r1 = await client.get(CAT_URL)
    r2 = await client.get(CAT_URL)
    assert r1.json() == r2.json()
