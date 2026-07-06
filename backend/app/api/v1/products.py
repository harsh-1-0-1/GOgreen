import json
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Response, UploadFile, status
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
from app.utils.image_upload import (
    delete_image_file,
    extract_relative_key,
    upload_image_file,
    resolve_image_url,
)
from app.utils.redis import cache_get, cache_set

router = APIRouter(prefix="/products", tags=["products"])

PRODUCT_TTL = 300  # 5 min
MAX_PRODUCT_IMAGE_SIZE = 5 * 1024 * 1024
ALLOWED_PRODUCT_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}


@router.get("", response_model=ProductListResponse)
async def list_products(
    response: Response,
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
    response.headers["Cache-Control"] = "public, max-age=300, stale-while-revalidate=60"
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
    product_id: Optional[int] = Form(default=None),
    _admin=Depends(require_admin),
):
    """Upload an image used by a product variant (pot type, combo, etc.).

    When uploading during product creation (before product.id exists) product_id
    is None; the utility generates a UUID staging folder. When editing an existing
    product, product_id is provided so the image lands under
    plantoga/product-variants/{productId}/{uuid}.{ext}.
    """
    if image.content_type not in ALLOWED_PRODUCT_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Variant image must be a JPG, PNG, or WEBP file",
        )
    if image.size is not None and image.size > MAX_PRODUCT_IMAGE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Variant image must be 5MB or smaller",
        )

    key = await upload_image_file(image, folder="product-variants", entity_id=product_id)
    return {"url": resolve_image_url(key)}


@router.get("/{slug}", response_model=ProductResponse)
async def get_product(slug: str, response: Response, db: AsyncSession = Depends(get_db)):
    response.headers["Cache-Control"] = "public, max-age=60"
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
    image_urls: Annotated[str, Form()] = "[]",
    images: list[UploadFile] = File(default=[]),
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    try:
        submitted_image_urls = json.loads(image_urls)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Image URLs must be a valid JSON list") from exc
    if not isinstance(submitted_image_urls, list) or not all(
        isinstance(url, str) for url in submitted_image_urls
    ):
        raise HTTPException(status_code=400, detail="Image URLs must be a valid JSON list")

    # Convert any submitted full URLs to relative keys for storage
    product_image_keys = [extract_relative_key(url.strip()) for url in submitted_image_urls if url.strip()][:5]

    # Validate uploaded files before touching the database
    valid_images = images[: max(0, 5 - len(product_image_keys))]
    for img in valid_images:
        if img.content_type not in ALLOWED_PRODUCT_IMAGE_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Product images must be JPG, PNG, or WEBP files",
            )
        if img.size is not None and img.size > MAX_PRODUCT_IMAGE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Each product image must be 5MB or smaller",
            )

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

    # Flush first to get product.id, then upload using that id as the folder namespace.
    # If any upload fails, the get_db generator rolls back the transaction automatically.
    product = await product_service.create_product(db, payload, image_urls=product_image_keys)

    for img in valid_images:
        key = await upload_image_file(img, folder="products", entity_id=product.id)
        product.images = list(product.images or []) + [key]

    await db.flush()
    await db.refresh(product)
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

    # Delete images that were removed from the list
    if body.images is not None:
        new_keys = {extract_relative_key(url) for url in body.images if url}
        old_keys = set(product.images or [])
        for removed_key in old_keys - new_keys:
            await delete_image_file(removed_key)
        # Store relative keys in the DB
        body = body.model_copy(update={"images": [extract_relative_key(u) for u in body.images if u]})

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
