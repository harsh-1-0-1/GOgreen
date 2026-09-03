import json
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Response, UploadFile, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import require_admin
from app.db.session import get_db
from app.schemas.product import (
    FAQItem,
    ProductCreate,
    ProductListResponse,
    ProductResponse,
    ProductUpdate,
)
from app.services import product_service
from app.utils.image_upload import (
    delete_image_file,
    extract_relative_key,
    resolve_image_url,
    upload_image_file,
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
    display_section: str | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
):
    response.headers["Cache-Control"] = "no-cache"
    cache_key = product_service.make_list_cache_key(
        category_slug, search, min_price, max_price, tags, sort_by, display_section, page, limit,
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
        display_section=display_section,
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

    Returns both the relative storage key and the resolved full URL.
    The key should be stored in the database; the URL is for display only.
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
    return {"key": key, "url": resolve_image_url(key)}


@router.post("/upload-image")
async def upload_product_image(
    image: UploadFile = File(...),
    product_id: Optional[int] = Form(default=None),
    _admin=Depends(require_admin),
):
    """Upload a product image.
    
    Returns both the relative storage key and the resolved full URL.
    The key should be stored in the database; the URL is for display only.
    """
    if image.content_type not in ALLOWED_PRODUCT_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Product image must be a JPG, PNG, or WEBP file",
        )
    if image.size is not None and image.size > MAX_PRODUCT_IMAGE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Product image must be 5MB or smaller",
        )

    key = await upload_image_file(image, folder="products", entity_id=product_id)
    return {"key": key, "url": resolve_image_url(key)}



@router.get("/admin/{product_id}/raw")
async def get_product_raw(
    product_id: int,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    """Return product raw data for admin editing.
    
    Returns relative image keys exactly as stored in DB, not resolved URLs.
    Used by admin edit form to seed state without URL→key round-trip.
    
    ⚠️ Keep field list in sync with Product model when schema changes.
    """
    product = await product_service.get_product_by_id(db, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Explicit dict to avoid SQLAlchemy __dict__ leakage and datetime encoding issues
    return {
        "id": product.id,
        "name": product.name,
        "slug": product.slug,
        "description": product.description,
        "price": product.price,
        "original_price": product.original_price,
        "stock_qty": product.stock_qty,
        "category_id": product.category_id,
        "images": product.images or [],  # relative keys, not resolved URLs
        "tags": product.tags or [],
        "care_tips": product.care_tips or [],
        "how_to_guide": product.how_to_guide,
        "sunlight": product.sunlight,
        "watering": product.watering,
        "badge": product.badge,
        "is_active": product.is_active,
        "variants": product.variants,  # raw dict with relative keys in image fields
        "promise_banner_image": product.promise_banner_image,  # raw relative key
        "why_plantoga_banner_image": product.why_plantoga_banner_image,  # raw relative key
        "care_card_image": product.care_card_image,  # raw relative key
        "faqs": product.faqs,  # raw list of {question, answer}
        "created_at": product.created_at.isoformat() if product.created_at else None,
    }


@router.get("/admin/all", response_model=ProductListResponse)
async def admin_get_all_products(
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
    limit: Annotated[int, Query(ge=1, le=5000)] = 1000,
):
    """Admin endpoint to fetch all products without pagination limit.
    
    Used by admin panels that need to show full product lists for selection.
    """
    items, total, pages = await product_service.list_products(
        db,
        page=1,
        limit=limit,
    )
    
    return ProductListResponse(
        items=[ProductResponse.model_validate(p) for p in items],
        total=total,
        page=1,
        pages=pages,
        limit=limit,
    )


@router.get("/{slug}", response_model=ProductResponse)
async def get_product(slug: str, response: Response, db: AsyncSession = Depends(get_db)):
    response.headers["Cache-Control"] = "no-cache"
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
    promise_banner_image: Annotated[str | None, Form()] = None,  # relative key from prior /upload-image call
    why_plantoga_banner_image: Annotated[str | None, Form()] = None,  # relative key from prior /upload-image call
    care_card_image: Annotated[str | None, Form()] = None,  # relative key from prior /upload-image call
    faqs: Annotated[str | None, Form()] = None,  # JSON string: [{question, answer}, ...]
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
        promise_banner_image=promise_banner_image or None,
        why_plantoga_banner_image=why_plantoga_banner_image or None,
        care_card_image=care_card_image or None,
        faqs=[FAQItem(**f) for f in json.loads(faqs)] if faqs else None,
    )

    # Flush first to get product.id, then upload using that id as the folder namespace.
    # Track every uploaded key so we can clean up orphaned files if a later upload
    # or the final DB flush fails (get_db rolls back the transaction, but S3/disk
    # writes are not transactional).
    try:
        product = await product_service.create_product(db, payload, image_urls=product_image_keys)

        uploaded_keys: list[str] = []
        try:
            for img in valid_images:
                key = await upload_image_file(img, folder="products", entity_id=product.id)
                uploaded_keys.append(key)
                product.images = list(product.images or []) + [key]

            await db.flush()
            await db.refresh(product)
            return product
        except Exception:
            # Clean up any files that were written before the failure
            for key in uploaded_keys:
                await delete_image_file(key)
            raise
    except IntegrityError as exc:
        orig = str(exc.orig) if exc.orig else str(exc)
        detail = orig.split("\n")[0] if "unique" in orig.lower() else "Could not save product due to a data conflict."
        raise HTTPException(status_code=409, detail=detail) from exc
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


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

    # Capture the set of keys to delete *before* the update, but only
    # delete them *after* the DB flush succeeds — so a DB failure never
    # leaves the product referencing images that no longer exist.
    keys_to_delete: set[str] = set()
    if body.images is not None:
        new_keys = {extract_relative_key(url) for url in body.images if url}
        old_keys = set(product.images or [])
        keys_to_delete = old_keys - new_keys
        # Store relative keys in the DB
        body = body.model_copy(update={"images": [extract_relative_key(u) for u in body.images if u]})

    try:
        product = await product_service.update_product(db, product, body)
    except IntegrityError as exc:
        orig = str(exc.orig) if exc.orig else str(exc)
        detail = orig.split("\n")[0] if "unique" in orig.lower() else "Could not save product due to a data conflict."
        raise HTTPException(status_code=409, detail=detail) from exc
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # DB flush has succeeded — now safe to delete the removed images
    for removed_key in keys_to_delete:
        await delete_image_file(removed_key)

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
