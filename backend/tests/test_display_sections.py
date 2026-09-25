import pytest
from httpx import AsyncClient
from sqlalchemy import text

from tests.conftest import _seed_category, _seed_product_via_db
from tests.conftest import test_session_factory as session_factory

DISPLAY_URL = "/api/v1/display_sections"


async def _create_section(client: AsyncClient, admin_token: str, name: str) -> dict:
    response = await client.post(
        f"{DISPLAY_URL}/admin",
        json={"name": name},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 201, response.text
    return response.json()


@pytest.mark.asyncio
async def test_display_sections_require_admin_for_mutation(client: AsyncClient):
    response = await client.post(f"{DISPLAY_URL}/admin", json={"name": "Featured"})
    assert response.status_code == 401

    response = await client.get(f"{DISPLAY_URL}/admin")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_create_rename_and_list_sections(client: AsyncClient, admin_token: str):
    first = await _create_section(client, admin_token, "Featured Picks")
    second = await _create_section(client, admin_token, "Seasonal")

    assert first["key"] == "featured_picks"
    assert first["sort_order"] == 0
    assert second["sort_order"] == 1

    response = await client.put(
        f"{DISPLAY_URL}/admin/{first['id']}",
        json={"name": "Customer Favorites"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 200, response.text
    assert response.json()["name"] == "Customer Favorites"
    assert response.json()["key"] == "featured_picks"

    response = await client.get(DISPLAY_URL)
    assert response.status_code == 200
    assert response.headers["cache-control"] == "public, max-age=300, stale-while-revalidate=60"
    assert [section["id"] for section in response.json()] == [first["id"], second["id"]]

    cached = await client.get(DISPLAY_URL)
    assert cached.json() == response.json()


@pytest.mark.asyncio
async def test_reorder_sections_and_reject_stale_list(client: AsyncClient, admin_token: str):
    sections = [
        await _create_section(client, admin_token, "New Arrivals"),
        await _create_section(client, admin_token, "Trending"),
        await _create_section(client, admin_token, "Featured"),
    ]

    response = await client.patch(
        f"{DISPLAY_URL}/admin/reorder",
        json={
            "items": [
                {"id": sections[2]["id"], "sort_order": 0},
                {"id": sections[0]["id"], "sort_order": 1},
                {"id": sections[1]["id"], "sort_order": 2},
            ]
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 200, response.text

    response = await client.get(DISPLAY_URL)
    assert [section["id"] for section in response.json()] == [
        sections[2]["id"],
        sections[0]["id"],
        sections[1]["id"],
    ]

    response = await client.patch(
        f"{DISPLAY_URL}/admin/reorder",
        json={"items": [{"id": sections[0]["id"], "sort_order": 0}]},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 409
    assert "stale" in response.json()["detail"]


@pytest.mark.asyncio
async def test_delete_section_rejected_when_product_uses_key(
    client: AsyncClient, admin_token: str,
):
    section = await _create_section(client, admin_token, "Used Section")
    category = await _seed_category(client, admin_token, "Section Products")

    async with session_factory() as db:
        await _seed_product_via_db(
            db,
            name="Assigned Plant",
            slug="assigned-plant",
            description="A plant",
            price=100.0,
            original_price=120.0,
            stock_qty=5,
            category_id=category["id"],
            images=["https://placehold.co/300"],
            tags=["x"],
            is_active=True,
            display_section=section["key"],
        )
        await db.commit()

    response = await client.delete(
        f"{DISPLAY_URL}/admin/{section['id']}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 409
    assert "product(s) use this section" in response.json()["detail"]


@pytest.mark.asyncio
async def test_product_create_preserves_display_section(
    client: AsyncClient, admin_token: str,
):
    section = await _create_section(client, admin_token, "New Arrivals")
    category = await _seed_category(client, admin_token, "New Plants")

    response = await client.post(
        "/api/v1/products",
        data={
            "name": "New Plant",
            "price": "199",
            "category_id": str(category["id"]),
            "display_section": section["key"],
            "tags": "[]",
            "care_tips": "[]",
            "image_urls": "[]",
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 201, response.text
    assert response.json()["display_section"] == section["key"]


async def _promote_to_system(client: AsyncClient, admin_token: str, key: str) -> None:
    async with session_factory() as db:
        await db.execute(
            text("UPDATE display_sections SET is_system = :flag WHERE key = :key"),
            {"flag": True, "key": key},
        )
        await db.commit()


@pytest.mark.asyncio
async def test_system_section_cannot_be_deleted_even_with_no_products(
    client: AsyncClient, admin_token: str,
):
    section = await _create_section(client, admin_token, "Protected Section")
    await _promote_to_system(client, admin_token, section["key"])

    response = await client.delete(
        f"{DISPLAY_URL}/admin/{section['id']}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 409
    assert "system section" in response.json()["detail"]


@pytest.mark.asyncio
async def test_non_system_section_without_products_can_be_deleted(
    client: AsyncClient, admin_token: str,
):
    section = await _create_section(client, admin_token, "Temporary Section")

    response = await client.delete(
        f"{DISPLAY_URL}/admin/{section['id']}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 204, response.text


@pytest.mark.asyncio
async def test_toggle_active_keeps_assignments_and_hides_from_storefront(
    client: AsyncClient, admin_token: str,
):
    section = await _create_section(client, admin_token, "Toggle Section")
    category = await _seed_category(client, admin_token, "Toggle Products")

    async with session_factory() as db:
        await _seed_product_via_db(
            db,
            name="Toggle Plant",
            slug="toggle-plant",
            description="A plant",
            price=100.0,
            original_price=120.0,
            stock_qty=5,
            category_id=category["id"],
            images=["https://placehold.co/300"],
            tags=["x"],
            is_active=True,
            display_section=section["key"],
        )
        await db.commit()

    listed = await client.get(
        f"{DISPLAY_URL}/admin", headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert listed.status_code == 200, listed.text
    row = next(item for item in listed.json() if item["id"] == section["id"])
    assert row["is_active"] is True
    assert row["is_system"] is False
    assert row["product_count"] == 1

    response = await client.patch(
        f"{DISPLAY_URL}/admin/{section['id']}/active",
        json={"is_active": False},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 200, response.text
    assert response.json()["is_active"] is False

    public = await client.get(DISPLAY_URL)
    assert section["id"] in [item["id"] for item in public.json()]

    filtered = await client.get(
        "/api/v1/products", params={"display_section": section["key"]}
    )
    assert filtered.status_code == 200, filtered.text
    assert filtered.json()["total"] == 1

    hidden = await client.get(
        f"{DISPLAY_URL}/admin", headers={"Authorization": f"Bearer {admin_token}"}
    )
    row = next(item for item in hidden.json() if item["id"] == section["id"])
    assert row["is_active"] is False
    assert row["product_count"] == 1


@pytest.mark.asyncio
async def test_admin_list_counts_empty_sections_as_zero(
    client: AsyncClient, admin_token: str,
):
    section = await _create_section(client, admin_token, "Empty Section")

    listed = await client.get(
        f"{DISPLAY_URL}/admin", headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert listed.status_code == 200, listed.text
    row = next(item for item in listed.json() if item["id"] == section["id"])
    assert row["product_count"] == 0
