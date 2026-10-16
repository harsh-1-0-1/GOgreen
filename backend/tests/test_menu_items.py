import pytest
from httpx import AsyncClient

from app.core.config import settings
from app.schemas.menu_item import MenuItemOut
from app.utils.image_upload import resolve_image_url

MENU_URL = "/api/v1/menu_items"
MENU_IMAGE_URL = f"{MENU_URL}/admin/upload-image"
MAX_MENU_IMAGE_SIZE = 5 * 1024 * 1024


@pytest.mark.asyncio
async def test_menu_image_upload_requires_admin(client: AsyncClient):
    response = await client.post(
        MENU_IMAGE_URL,
        files={"image": ("menu.png", b"image", "image/png")},
    )

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_menu_image_upload_rejects_unsupported_file(
    client: AsyncClient, admin_token: str,
):
    response = await client.post(
        MENU_IMAGE_URL,
        files={"image": ("menu.svg", b"<svg></svg>", "image/svg+xml")},
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    assert response.status_code == 400
    assert "JPG, PNG, or WEBP" in response.json()["detail"]


@pytest.mark.asyncio
async def test_menu_image_upload_rejects_large_file(
    client: AsyncClient, admin_token: str,
):
    response = await client.post(
        MENU_IMAGE_URL,
        files={
            "image": (
                "menu.png",
                b"x" * (MAX_MENU_IMAGE_SIZE + 1),
                "image/png",
            )
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    assert response.status_code == 400
    assert "5MB or smaller" in response.json()["detail"]


@pytest.mark.asyncio
async def test_menu_image_upload_uses_menu_storage(
    client: AsyncClient, admin_token: str, monkeypatch,
):
    calls: list[tuple[str | None, str, object]] = []
    key = "plantoga/menus/test-id/menu.png"

    async def fake_upload_image_file(image, folder: str, entity_id=None):
        calls.append((image.filename, folder, entity_id))
        return key

    monkeypatch.setattr(
        "app.api.v1.menu_items.upload_image_file",
        fake_upload_image_file,
    )

    response = await client.post(
        MENU_IMAGE_URL,
        files={"image": ("menu.png", b"image", "image/png")},
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    assert response.status_code == 200
    assert response.json() == {"key": key, "url": resolve_image_url(key)}
    assert calls == [("menu.png", "menus", None)]


def test_menu_item_response_resolves_relative_image(monkeypatch):
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(settings, "CDN_BASE_URL", "https://cdn.example")

    menu_item = MenuItemOut.model_validate(
        {
            "id": 1,
            "label": "Gifting",
            "href": "/gifting",
            "parent_id": None,
            "image_url": "plantoga/menus/1/menu.png",
            "accent_color": None,
            "highlight": False,
            "sort_order": 0,
            "is_active": True,
            "created_at": "2026-01-01T00:00:00Z",
            "updated_at": None,
        }
    )

    assert menu_item.model_dump(mode="json")["image_url"] == (
        "https://cdn.example/plantoga/menus/1/menu.png"
    )


@pytest.mark.asyncio
async def test_menu_update_preserves_or_clears_image(
    client: AsyncClient, admin_token: str,
):
    create_response = await client.post(
        f"{MENU_URL}/admin",
        json={
            "label": "Gifting",
            "href": "/gifting",
            "image_url": "plantoga/menus/1/menu.png",
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    assert create_response.status_code == 200, create_response.text
    item_id = create_response.json()["id"]

    update_response = await client.put(
        f"{MENU_URL}/admin/{item_id}",
        json={"label": "Updated Gifting"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    assert update_response.status_code == 200, update_response.text
    assert update_response.json()["image_url"] is not None

    clear_response = await client.put(
        f"{MENU_URL}/admin/{item_id}",
        json={"image_url": None},
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    assert clear_response.status_code == 200, clear_response.text
    assert clear_response.json()["image_url"] is None
