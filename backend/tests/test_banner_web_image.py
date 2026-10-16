"""Banner web/mobile image variants.

Covers the separate desktop crop (`image_url_web`) end to end: upload both
variants, read them back through the public endpoint, crop each independently,
and remove the web image without touching the phone one.
"""

import io

import pytest
from PIL import Image


def _png_bytes(width: int, height: int, color: str) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (width, height), color).save(buf, format="PNG")
    return buf.getvalue()


async def _create_banner(client, token, files=None, **extra):
    body = {
        "title": "Monsoon Sale",
        "placement": "hero",
        "bg_color": "#F5F0E8",
        "text_color": "#1B4332",
        "position": 0,
        "is_active": "true",
    }
    body.update(extra)
    resp = await client.post(
        "/api/v1/banners/admin",
        data=body,
        files=files or {},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


def _phone_file() -> dict:
    return {"image": ("phone.png", _png_bytes(600, 600, "red"), "image/png")}


def _web_file() -> dict:
    return {"image_web": ("desktop.png", _png_bytes(1920, 824, "blue"), "image/png")}


@pytest.mark.asyncio
async def test_create_with_both_variants_and_read_back(client, admin_token):
    banner = await _create_banner(
        client, admin_token, files={**_phone_file(), **_web_file()}
    )

    assert banner["image_url"]
    assert banner["image_url_web"]
    assert banner["image_url"] != banner["image_url_web"]
    # Both resolve to absolute URLs (or pass through untouched remote URLs).
    assert banner["image_url"].startswith(("http://", "https://", "/"))
    assert banner["image_url_web"].startswith(("http://", "https://", "/"))

    public = await client.get("/api/v1/banners?placement=hero")
    assert public.status_code == 200
    listed = public.json()
    assert len(listed) == 1
    assert listed[0]["image_url_web"] == banner["image_url_web"]


@pytest.mark.asyncio
async def test_web_image_is_optional_and_defaults_to_null(client, admin_token):
    banner = await _create_banner(client, admin_token, files=_phone_file())

    assert banner["image_url"]
    assert banner["image_url_web"] is None


@pytest.mark.asyncio
async def test_clearing_web_image_keeps_mobile_image(client, admin_token):
    banner = await _create_banner(
        client, admin_token, files={**_phone_file(), **_web_file()}
    )

    resp = await client.put(
        f"/api/v1/banners/admin/{banner['id']}",
        data={"title": "Monsoon Sale", "clear_image_web": "true"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200, resp.text
    updated = resp.json()

    assert updated["image_url_web"] is None
    assert updated["image_url"] == banner["image_url"]


@pytest.mark.asyncio
async def test_clearing_mobile_image_keeps_web_image(client, admin_token):
    banner = await _create_banner(
        client, admin_token, files={**_phone_file(), **_web_file()}
    )

    resp = await client.put(
        f"/api/v1/banners/admin/{banner['id']}",
        data={"title": "Monsoon Sale", "clear_image": "true"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200, resp.text
    updated = resp.json()

    assert updated["image_url"] is None
    assert updated["image_url_web"] == banner["image_url_web"]


@pytest.mark.asyncio
async def test_crop_targets_only_the_requested_variant(client, admin_token):
    banner = await _create_banner(
        client, admin_token, files={**_phone_file(), **_web_file()}
    )
    headers = {"Authorization": f"Bearer {admin_token}"}
    before_mobile = banner["image_url"]
    before_web = banner["image_url_web"]

    cropped = await client.post(
        f"/api/v1/banners/admin/{banner['id']}/crop",
        json={"x": 0, "y": 0, "width": 400, "height": 200, "variant": "web"},
        headers=headers,
    )
    assert cropped.status_code == 200, cropped.text
    after = cropped.json()

    assert after["image_url_web"] != before_web
    assert after["image_url"] == before_mobile


@pytest.mark.asyncio
async def test_crop_rejects_unknown_variant(client, admin_token):
    banner = await _create_banner(client, admin_token, files=_phone_file())

    resp = await client.post(
        f"/api/v1/banners/admin/{banner['id']}/crop",
        json={"x": 0, "y": 0, "width": 10, "height": 10, "variant": "tablet"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_web_crop_without_a_web_image_is_rejected(client, admin_token):
    banner = await _create_banner(client, admin_token, files=_phone_file())

    resp = await client.post(
        f"/api/v1/banners/admin/{banner['id']}/crop",
        json={"x": 0, "y": 0, "width": 10, "height": 10, "variant": "web"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_crop_defaults_to_the_mobile_variant(client, admin_token):
    banner = await _create_banner(
        client, admin_token, files={**_phone_file(), **_web_file()}
    )
    headers = {"Authorization": f"Bearer {admin_token}"}
    before_mobile = banner["image_url"]
    before_web = banner["image_url_web"]

    # No `variant` key at all — must behave as "mobile" for backwards compat.
    resp = await client.post(
        f"/api/v1/banners/admin/{banner['id']}/crop",
        json={"x": 0, "y": 0, "width": 300, "height": 300},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    after = resp.json()

    assert after["image_url"] != before_mobile
    assert after["image_url_web"] == before_web


@pytest.mark.asyncio
async def test_web_image_can_be_set_from_a_url(client, admin_token):
    banner = await _create_banner(client, admin_token, files=_phone_file())

    resp = await client.put(
        f"/api/v1/banners/admin/{banner['id']}",
        data={
            "title": "Monsoon Sale",
            "image_url_web_manual": "https://cdn.example.com/desktop.png",
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200, resp.text
    updated = resp.json()

    assert updated["image_url_web"] == "https://cdn.example.com/desktop.png"
    assert updated["image_url"] == banner["image_url"]


@pytest.mark.asyncio
async def test_editing_other_fields_leaves_both_images_alone(client, admin_token):
    banner = await _create_banner(
        client, admin_token, files={**_phone_file(), **_web_file()}
    )

    resp = await client.put(
        f"/api/v1/banners/admin/{banner['id']}",
        data={"title": "Renamed", "subtitle": "new subtitle"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200, resp.text
    updated = resp.json()

    assert updated["title"] == "Renamed"
    assert updated["image_url"] == banner["image_url"]
    assert updated["image_url_web"] == banner["image_url_web"]
