"""Tag colour + deletion behaviour used by the admin product editor.

Regression coverage for the "Vastu friendly stays green and tags cannot be
deleted" report:

* re-submitting an existing tag name must recolour that tag rather than append
  a duplicate row with a `-2` slug suffix,
* a colour change and a delete must be visible on the next public list read
  (the Redis cache is dropped on every write),
* the public list must not be browser-cacheable, otherwise an admin write stays
  invisible to an already-loaded tab for minutes.
"""

import pytest
from httpx import AsyncClient

TAGS_URL = "/api/v1/tags"


async def _create_tag(
    client: AsyncClient, admin_token: str, name: str, color: str
) -> dict:
    response = await client.post(
        TAGS_URL,
        json={"name": name, "color": color},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 201, response.text
    return response.json()


@pytest.mark.asyncio
async def test_tag_mutations_require_admin(client: AsyncClient):
    assert (await client.get(f"{TAGS_URL}/admin")).status_code == 401
    assert (
        await client.post(TAGS_URL, json={"name": "Nope", "color": "#DC2626"})
    ).status_code == 401
    assert (await client.put(f"{TAGS_URL}/1", json={"color": "#DC2626"})).status_code == 401
    assert (await client.delete(f"{TAGS_URL}/1")).status_code == 401


@pytest.mark.asyncio
async def test_update_recolours_existing_tag(client: AsyncClient, admin_token: str):
    created = await _create_tag(client, admin_token, "Vastu Friendly", "#1B4332")
    assert created["slug"] == "vastu-friendly"
    assert created["color"] == "#1B4332"

    response = await client.put(
        f"{TAGS_URL}/{created['id']}",
        json={"name": "Vastu Friendly", "color": "#DC2626"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 200, response.text
    assert response.json()["color"] == "#DC2626"
    # Recolouring must not move the tag: the product badges resolve by slug.
    assert response.json()["slug"] == "vastu-friendly"

    listed = await client.get(TAGS_URL)
    row = next(item for item in listed.json() if item["id"] == created["id"])
    assert row["color"] == "#DC2626"


@pytest.mark.asyncio
async def test_recolour_is_visible_immediately_after_update(
    client: AsyncClient, admin_token: str,
):
    """The public list is Redis-cached; a write must invalidate that cache."""
    created = await _create_tag(client, admin_token, "Cache Check", "#0ae6e2")

    warm = await client.get(TAGS_URL)
    assert any(item["id"] == created["id"] for item in warm.json())

    await client.put(
        f"{TAGS_URL}/{created['id']}",
        json={"color": "#DC2626"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    after = await client.get(TAGS_URL)
    row = next(item for item in after.json() if item["id"] == created["id"])
    assert row["color"] == "#DC2626"


@pytest.mark.asyncio
async def test_public_tag_list_is_not_browser_cacheable(client: AsyncClient):
    response = await client.get(TAGS_URL)
    assert response.status_code == 200
    cache_control = response.headers["cache-control"]
    assert "no-cache" in cache_control
    assert "max-age" not in cache_control


@pytest.mark.asyncio
async def test_delete_removes_tag_from_public_and_admin_lists(
    client: AsyncClient, admin_token: str,
):
    created = await _create_tag(client, admin_token, "Temporary Tag", "#2563EB")

    warm = await client.get(TAGS_URL)
    assert any(item["id"] == created["id"] for item in warm.json())

    response = await client.delete(
        f"{TAGS_URL}/{created['id']}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 204, response.text

    public = await client.get(TAGS_URL)
    assert all(item["id"] != created["id"] for item in public.json())

    admin_list = await client.get(
        f"{TAGS_URL}/admin", headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert all(item["id"] != created["id"] for item in admin_list.json())

    missing = await client.delete(
        f"{TAGS_URL}/{created['id']}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert missing.status_code == 404


@pytest.mark.asyncio
async def test_admin_list_includes_inactive_tags(client: AsyncClient, admin_token: str):
    created = await _create_tag(client, admin_token, "Hidden Tag", "#7C3AED")

    response = await client.put(
        f"{TAGS_URL}/{created['id']}",
        json={"is_active": False},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 200, response.text

    admin_list = await client.get(
        f"{TAGS_URL}/admin", headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert any(item["id"] == created["id"] for item in admin_list.json())

    public = await client.get(TAGS_URL)
    assert all(item["id"] != created["id"] for item in public.json())


@pytest.mark.asyncio
async def test_duplicate_name_gets_suffixed_slug(
    client: AsyncClient, admin_token: str,
):
    """Documents the underlying trap the admin UI works around.

    A second POST with the same name does not overwrite the first row, so a
    blind re-submit would leave the badge keyed on the original slug stuck on
    its old colour.
    """
    first = await _create_tag(client, admin_token, "Vastu Friendly", "#1B4332")
    second = await _create_tag(client, admin_token, "Vastu Friendly", "#DC2626")

    assert second["id"] != first["id"]
    assert first["slug"] == "vastu-friendly"
    assert second["slug"].startswith("vastu-friendly-")
