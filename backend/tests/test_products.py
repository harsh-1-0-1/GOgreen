import pytest
from httpx import AsyncClient

from tests.conftest import _seed_category, test_session_factory

PROD_URL = "/api/v1/products"


async def _bulk_seed(client: AsyncClient, admin_token: str, count: int = 5):
    """Seed a category + N products directly in the DB for speed."""
    cat = await _seed_category(client, admin_token, "Indoor Plants")
    cat_id = cat["id"]

    async with test_session_factory() as db:
        from app.db.models import Product
        for i in range(1, count + 1):
            db.add(Product(
                name=f"Plant {i}",
                slug=f"plant-{i}",
                description=f"A lovely plant number {i}",
                price=100.0 + i * 50,
                original_price=200.0 + i * 50,
                stock_qty=10,
                category_id=cat_id,
                images=[f"https://example.com/img{i}.jpg"],
                tags=["indoor", "green"] if i % 2 == 0 else ["outdoor"],
                sunlight="Bright Indirect",
                watering="Weekly",
                is_active=True,
            ))
        await db.commit()
    return cat


# ---- Public list with filtering ----------------------------------------

@pytest.mark.asyncio
async def test_list_products_empty(client: AsyncClient):
    resp = await client.get(PROD_URL)
    assert resp.status_code == 200
    assert resp.headers["cache-control"] == "no-cache"
    data = resp.json()
    assert data["items"] == []
    assert data["total"] == 0


@pytest.mark.asyncio
async def test_list_products_pagination(client: AsyncClient, admin_token: str):
    await _bulk_seed(client, admin_token, count=5)
    resp = await client.get(PROD_URL, params={"page": 1, "limit": 2})
    data = resp.json()
    assert len(data["items"]) == 2
    assert data["total"] == 5
    assert data["pages"] == 3
    assert data["limit"] == 2


@pytest.mark.asyncio
async def test_list_filter_by_category(client: AsyncClient, admin_token: str):
    await _bulk_seed(client, admin_token, count=3)
    resp = await client.get(PROD_URL, params={"category_slug": "indoor-plants"})
    data = resp.json()
    assert data["total"] == 3

    resp2 = await client.get(PROD_URL, params={"category_slug": "nonexistent"})
    assert resp2.json()["total"] == 0


@pytest.mark.asyncio
async def test_list_search(client: AsyncClient, admin_token: str):
    await _bulk_seed(client, admin_token, count=5)
    resp = await client.get(PROD_URL, params={"search": "plant 3"})
    data = resp.json()
    assert data["total"] == 1
    assert "Plant 3" in data["items"][0]["name"]


@pytest.mark.asyncio
async def test_list_price_range(client: AsyncClient, admin_token: str):
    await _bulk_seed(client, admin_token, count=5)
    resp = await client.get(PROD_URL, params={"min_price": 200, "max_price": 300})
    data = resp.json()
    for item in data["items"]:
        assert 200 <= item["price"] <= 300


@pytest.mark.asyncio
async def test_list_filter_by_tags(client: AsyncClient, admin_token: str):
    await _bulk_seed(client, admin_token, count=5)
    resp = await client.get(PROD_URL, params={"tags": "indoor"})
    data = resp.json()
    assert data["total"] == 2
    assert all("indoor" in item["tags"] for item in data["items"])


@pytest.mark.asyncio
async def test_list_sort_price_asc(client: AsyncClient, admin_token: str):
    await _bulk_seed(client, admin_token, count=5)
    resp = await client.get(PROD_URL, params={"sort_by": "price_asc"})
    prices = [p["price"] for p in resp.json()["items"]]
    assert prices == sorted(prices)


# ---- Single product ----------------------------------------------------

@pytest.mark.asyncio
async def test_get_product_by_slug(client: AsyncClient, admin_token: str):
    await _bulk_seed(client, admin_token, count=1)
    resp = await client.get(f"{PROD_URL}/plant-1")
    assert resp.status_code == 200
    assert resp.headers["cache-control"] == "no-cache"
    assert resp.json()["slug"] == "plant-1"


@pytest.mark.asyncio
async def test_get_product_not_found(client: AsyncClient):
    resp = await client.get(f"{PROD_URL}/no-such-plant")
    assert resp.status_code == 404


# ---- Cache hit ---------------------------------------------------------

@pytest.mark.asyncio
async def test_product_list_cache_hit(client: AsyncClient, admin_token: str):
    await _bulk_seed(client, admin_token, count=2)
    r1 = await client.get(PROD_URL)
    r2 = await client.get(PROD_URL)
    assert r1.json() == r2.json()


# ---- Admin-only enforcement -------------------------------------------

@pytest.mark.asyncio
async def test_create_product_requires_admin(client: AsyncClient):
    resp = await client.post(PROD_URL, data={"name": "x", "price": "100", "category_id": "1"})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_update_product_requires_admin(client: AsyncClient):
    resp = await client.put(f"{PROD_URL}/1", json={"name": "new"})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_delete_product_requires_admin(client: AsyncClient):
    resp = await client.delete(f"{PROD_URL}/1")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_variant_image_upload_requires_admin(client: AsyncClient):
    resp = await client.post(
        f"{PROD_URL}/variant-image",
        files={"image": ("pot.png", b"fake-image", "image/png")},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_variant_image_upload_rejects_unsupported_file(
    client: AsyncClient, admin_token: str,
):
    resp = await client.post(
        f"{PROD_URL}/variant-image",
        files={"image": ("pot.svg", b"<svg></svg>", "image/svg+xml")},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 400
    assert "JPG, PNG, or WEBP" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_create_product_uses_shared_image_storage(
    client: AsyncClient, admin_token: str, monkeypatch,
):
    category = await _seed_category(client, admin_token, "Upload Test Plants")
    uploaded_filenames: list[str] = []

    async def fake_upload_image_file(image, folder: str, entity_id=None):
        uploaded_filenames.append(image.filename)
        assert folder == "products"
        assert entity_id is not None
        return f"plantoga/products/{entity_id}/{image.filename}"

    monkeypatch.setattr(
        "app.api.v1.products.upload_image_file", fake_upload_image_file,
    )
    resp = await client.post(
        PROD_URL,
        data={
            "name": "Uploaded Plant",
            "price": "499",
            "category_id": str(category["id"]),
        },
        files={"images": ("plant.webp", b"fake-image", "image/webp")},
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    assert resp.status_code == 201, resp.text
    assert uploaded_filenames == ["plant.webp"]
    assert resp.json()["images"] == [
        f"http://localhost:8000/static/plantoga/products/{resp.json()['id']}/plant.webp"
    ]


@pytest.mark.asyncio
async def test_create_product_keeps_submitted_image_urls(
    client: AsyncClient, admin_token: str,
):
    category = await _seed_category(client, admin_token, "URL Test Plants")
    resp = await client.post(
        PROD_URL,
        data={
            "name": "Linked Plant",
            "price": "299",
            "category_id": str(category["id"]),
            "image_urls": '["https://example.com/plant.jpg"]',
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    assert resp.status_code == 201, resp.text
    assert resp.json()["images"] == ["https://example.com/plant.jpg"]


# ---- Soft delete -------------------------------------------------------

@pytest.mark.asyncio
async def test_soft_delete(client: AsyncClient, admin_token: str):
    await _bulk_seed(client, admin_token, count=1)
    # Get product id
    resp = await client.get(f"{PROD_URL}/plant-1")
    pid = resp.json()["id"]

    del_resp = await client.delete(
        f"{PROD_URL}/{pid}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert del_resp.status_code == 204

    # Should no longer appear in public list
    list_resp = await client.get(PROD_URL)
    assert list_resp.json()["total"] == 0

    # Slug lookup should 404
    slug_resp = await client.get(f"{PROD_URL}/plant-1")
    assert slug_resp.status_code == 404


# ---- Update & Image Upload --------------------------------------------

@pytest.mark.asyncio
async def test_upload_product_image_success(client: AsyncClient, admin_token: str):
    resp = await client.post(
        f"{PROD_URL}/upload-image",
        files={"image": ("plant.png", b"fake-image", "image/png")},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200, resp.text
    assert "url" in resp.json()
    assert "plantoga/products/" in resp.json()["url"]



@pytest.mark.asyncio
async def test_update_product_success(client: AsyncClient, admin_token: str):
    await _bulk_seed(client, admin_token, count=1)
    
    # Get product
    resp = await client.get(f"{PROD_URL}/plant-1")
    product = resp.json()
    pid = product["id"]

    # Update product
    update_resp = await client.put(
        f"{PROD_URL}/{pid}",
        json={
            "name": "Updated Plant 1",
            "stock_qty": 99,
            "images": ["https://example.com/new-image.jpg"]
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert update_resp.status_code == 200, update_resp.text
    data = update_resp.json()
    assert data["name"] == "Updated Plant 1"
    assert data["stock_qty"] == 99
    assert data["images"] == ["https://example.com/new-image.jpg"]

