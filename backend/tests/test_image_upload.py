import re
from pathlib import Path

import pytest
from fastapi import UploadFile

from app.core.config import settings
from app.schemas.category import CategoryResponse
from app.schemas.product import ProductResponse
from app.utils import image_upload


def test_generate_image_key_uses_entity_and_unique_uuid():
    first = image_upload.generate_image_key("products", 42, "plant.WEBP")
    second = image_upload.generate_image_key("plantoga/products", 42, "plant.WEBP")

    pattern = r"^plantoga/products/42/[0-9a-f-]{36}\.webp$"
    assert re.match(pattern, first)
    assert re.match(pattern, second)
    assert first != second


def test_generate_image_key_rejects_unsafe_namespaces():
    with pytest.raises(ValueError):
        image_upload.generate_image_key("../outside", 1, "plant.jpg")
    with pytest.raises(ValueError):
        image_upload.generate_image_key("products", "../1", "plant.jpg")


def test_url_resolution_and_extraction_round_trip(monkeypatch):
    monkeypatch.setattr(settings, "CDN_BASE_URL", "https://images.example.com/")
    key = "plantoga/products/1/image.jpg"

    url = image_upload.resolve_image_url(key)
    assert url == f"https://images.example.com/{key}"
    assert image_upload.extract_relative_key(url) == key
    assert image_upload.extract_relative_key("/static/" + key) == key
    assert image_upload.resolve_image_url("https://elsewhere.test/image.jpg") == (
        "https://elsewhere.test/image.jpg"
    )


def test_variant_images_are_resolved(monkeypatch):
    """resolve_variants_images should convert relative keys to full URLs."""
    monkeypatch.setattr(settings, "CDN_BASE_URL", "https://cdn.test")
    variants = {
        "default_image": "plantoga/default.jpg",
        "image_map": {"green": "plantoga/green.jpg"},
        "pot_types": [{"name": "Clay", "image_url": "plantoga/clay.jpg"}],
    }

    resolved = image_upload.resolve_variants_images(variants)
    assert resolved["default_image"] == "https://cdn.test/plantoga/default.jpg"
    assert resolved["image_map"]["green"] == "https://cdn.test/plantoga/green.jpg"
    assert resolved["pot_types"][0]["image_url"] == "https://cdn.test/plantoga/clay.jpg"


@pytest.mark.asyncio
async def test_local_upload_and_delete(tmp_path: Path, monkeypatch):
    monkeypatch.setattr(image_upload, "STATIC_ROOT", tmp_path)
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")
    monkeypatch.setattr(settings, "AWS_ACCESS_KEY_ID", "")
    monkeypatch.setattr(settings, "AWS_SECRET_ACCESS_KEY", "")
    monkeypatch.setattr(settings, "AWS_S3_BUCKET", "")
    upload = UploadFile(filename="plant.png", file=__import__("io").BytesIO(b"image"))

    key = await image_upload.upload_image_file(upload, "products", 9)
    assert (tmp_path / key).read_bytes() == b"image"
    await image_upload.delete_image_file(key)
    assert not (tmp_path / key).exists()


@pytest.mark.asyncio
async def test_production_without_s3_fails(monkeypatch):
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(settings, "AWS_ACCESS_KEY_ID", "")
    monkeypatch.setattr(settings, "AWS_SECRET_ACCESS_KEY", "")
    monkeypatch.setattr(settings, "AWS_S3_BUCKET", "")
    upload = UploadFile(filename="plant.png", file=__import__("io").BytesIO(b"image"))

    with pytest.raises(
        image_upload.ImageStorageUnavailableError,
        match="Missing AWS S3 credentials",
    ):
        await image_upload.upload_image_file(upload, "products", 9)


@pytest.mark.asyncio
async def test_storage_unavailable_handler_returns_safe_503():
    from main import image_storage_unavailable_handler

    response = await image_storage_unavailable_handler(
        None,
        image_upload.ImageStorageUnavailableError(
            "AWS_SECRET_ACCESS_KEY was not configured"
        ),
    )

    assert response.status_code == 503
    assert response.body == b'{"error":"Image upload service unavailable"}'


def test_response_serializers_resolve_keys(monkeypatch):
    monkeypatch.setattr(settings, "CDN_BASE_URL", "https://cdn.test")
    product = ProductResponse.model_validate(
        {
            "id": 1,
            "name": "Fern",
            "slug": "fern",
            "description": None,
            "price": 10,
            "original_price": None,
            "stock_qty": 1,
            "category_id": 2,
            "images": ["plantoga/products/1/a.jpg"],
            "tags": [],
            "care_tips": [],
            "how_to_guide": None,
            "sunlight": None,
            "watering": None,
            "badge": None,
            "is_active": True,
            "created_at": "2026-01-01T00:00:00Z",
            "variants": None,
        }
    )
    assert product.model_dump()["images"] == [
        "https://cdn.test/plantoga/products/1/a.jpg"
    ]

    category = CategoryResponse.model_validate(
        {"id": 2, "name": "Plants", "slug": "plants", "parent_id": None,
         "image_url": "plantoga/categories/2/a.jpg", "is_active": True}
    )
    assert category.model_dump()["image_url"].startswith("https://cdn.test/")
