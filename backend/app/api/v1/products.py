import json
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import require_admin
from app.db.session import get_db
from app.schemas.product import (
    ProductCreate,
    ProductListResponse,
    ProductResponse,
    ProductUpdate,
)
from app.services import product_service
from app.utils.cloudinary_helper import upload_image
from app.utils.image_upload import handle_image_upload
from app.utils.redis import cache_get, cache_set

router = APIRouter(prefix="/products", tags=["products"])

PRODUCT_TTL = 300  # 5 min
MAX_VARIANT_IMAGE_SIZE = 5 * 1024 * 1024
ALLOWED_VARIANT_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}


@router.get("", response_model=ProductListResponse)
async def list_products(
    db: AsyncSession = Depends(get_db),
    category_slug: str | None = None,
    search: str | None = None,
    min_price: float | None = None,
    max_price: float | None = None,
    tags: str | None = None,
    sort_by: str | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
):
    cache_key = product_service.make_list_cache_key(
        category_slug, search, min_price, max_price, tags, sort_by, page, limit,
    )
    cached = await cache_get(cache_key)
    if cached:
        return cached

    items, total, pages = await product_service.list_products(
        db,
        category_slug=category_slug,
        search=search,
        min_price=min_price,
        max_price=max_price,
        tags=tags,
        sort_by=sort_by,
        page=page,
        limit=limit,
    )

    resp = ProductListResponse(
        items=[ProductResponse.model_validate(p) for p in items],
        total=total,
        page=page,
        pages=pages,
        limit=limit,
    )
    await cache_set(cache_key, json.loads(resp.model_dump_json()), ttl=PRODUCT_TTL)
    return resp


@router.post("/variant-image")
async def upload_variant_image(
    image: UploadFile = File(...),
    _admin=Depends(require_admin),
):
    """Upload an image used by a product variant option."""
    if image.content_type not in ALLOWED_VARIANT_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Variant image must be a JPG, PNG, or WEBP file",
        )
    if image.size is not None and image.size > MAX_VARIANT_IMAGE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Variant image must be 5MB or smaller",
        )

    result = await handle_image_upload(image, folder="plantoga/product-variants")
    return {"url": result["url"]}


@router.get("/{slug}", response_model=ProductResponse)
async def get_product(slug: str, db: AsyncSession = Depends(get_db)):
    cache_key = f"product:{slug}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    product = await product_service.get_product_by_slug(db, slug)
    if not product or not product.is_active:
        raise HTTPException(status_code=404, detail="Product not found")

    resp = ProductResponse.model_validate(product)
    await cache_set(cache_key, json.loads(resp.model_dump_json()), ttl=PRODUCT_TTL)
    return resp


@router.post("", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
async def create_product(
    name: Annotated[str, Form()],
    price: Annotated[float, Form()],
    category_id: Annotated[int, Form()],
    description: Annotated[str | None, Form()] = None,
    original_price: Annotated[float | None, Form()] = None,
    stock_qty: Annotated[int, Form()] = 0,
    tags: Annotated[str, Form()] = "[]",
    care_tips: Annotated[str, Form()] = "[]",
    how_to_guide: Annotated[str | None, Form()] = None,
    sunlight: Annotated[str | None, Form()] = None,
    watering: Annotated[str | None, Form()] = None,
    badge: Annotated[str | None, Form()] = None,
    variants: Annotated[str | None, Form()] = None,
    images: list[UploadFile] = File(default=[]),
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    image_urls: list[str] = []
    for img in images[:5]:
        data = await img.read()
        result = upload_image(data, folder="plantoga/products")
        image_urls.append(result["url"])

    payload = ProductCreate(
        name=name,
        description=description,
        price=price,
        original_price=original_price,
        stock_qty=stock_qty,
        category_id=category_id,
        tags=json.loads(tags),
        care_tips=json.loads(care_tips),
        how_to_guide=how_to_guide,
        sunlight=sunlight,
        watering=watering,
        badge=badge,
        variants=json.loads(variants) if variants else None,
    )
    product = await product_service.create_product(db, payload, image_urls=image_urls)
    return product


@router.put("/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: int,
    body: ProductUpdate,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    product = await product_service.get_product_by_id(db, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    product = await product_service.update_product(db, product, body)
    return product


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(
    product_id: int,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    product = await product_service.get_product_by_id(db, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    await product_service.soft_delete_product(db, product)
