import hashlib
import math
import re

from sqlalchemy import Select, cast, func, or_, select  # func used in list_products count queries
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Category, Product
from app.schemas.product import ProductCreate, ProductUpdate
from app.utils.redis import cache_delete, cache_delete_pattern

# Maximum number of times to retry a slug-collision IntegrityError before giving up.
# In practice this only fires under concurrent writes; 3 retries is more than enough.
_SLUG_RETRY_LIMIT = 3


def _slugify(text: str) -> str:
    slug = text.lower().strip()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_]+", "-", slug)
    return re.sub(r"-+", "-", slug).strip("-")


def _assert_relative_keys(variants: dict | None) -> None:
    """Guard against full URLs leaking into variant image fields.
    
    Variants should only contain relative keys like 'plantoga/products/42/abc.webp'.
    If a full URL (http://... or https://...) is detected, it means the payload
    wasn't built correctly or a bulk import bypassed the proper flow.
    
    Raises ValueError if any image field contains a full URL.
    """
    if not variants:
        return
    
    suspects = [variants.get("default_image")]
    image_map = variants.get("image_map", {}) or {}
    for val in image_map.values():
        if isinstance(val, list):
            suspects.extend(val)
        elif isinstance(val, str):
            suspects.append(val)
            
    suspects.extend([p.get("image_url") for p in variants.get("pot_types", [])])
    
    bad = [s for s in suspects if s and (s.startswith("http://") or s.startswith("https://"))]
    if bad:
        raise ValueError(f"variants contains full URL(s), expected relative keys: {bad}")


def _clean_and_validate_variants(variants: dict | None) -> dict | None:
    if not variants:
        return variants
    
    cleaned = dict(variants)
    
    if "image_map" in cleaned and isinstance(cleaned["image_map"], dict):
        new_image_map = {}
        for k, v in cleaned["image_map"].items():
            if isinstance(v, list):
                # Remove duplicate image keys while keeping order
                seen = set()
                cleaned_v = []
                for img in v:
                    if img and img not in seen:
                        seen.add(img)
                        cleaned_v.append(img)
                # Empty list is allowed — storefront falls back to
                # default_image → pot_type.image_url → product.images
                if len(cleaned_v) > 8:
                    raise ValueError(f"Combination {k} exceeds the limit of 8 images")
                new_image_map[k] = cleaned_v
            elif isinstance(v, str):
                if not v.strip():
                    # Blank string: treat as "no image" — same fallback as []
                    new_image_map[k] = []
                else:
                    new_image_map[k] = [v.strip()]
            else:
                raise ValueError(f"Invalid image format for combination {k}")
        cleaned["image_map"] = new_image_map
        
    _assert_relative_keys(cleaned)
    return cleaned


def make_list_cache_key(
    category_slug: str | None,
    search: str | None,
    min_price: float | None,
    max_price: float | None,
    tags: str | None,
    sort_by: str | None,
    page: int,
    limit: int,
) -> str:
    raw = f"{category_slug}:{search}:{min_price}:{max_price}:{tags}:{sort_by}:{page}:{limit}"
    h = hashlib.md5(raw.encode()).hexdigest()[:12]
    return f"products:{h}"


def _tag_filter(db: AsyncSession, tag: str):
    if db.bind and db.bind.dialect.name == "postgresql":
        return cast(Product.tags, JSONB).contains([tag])
    return Product.tags.contains(tag)


async def list_products(
    db: AsyncSession,
    *,
    category_slug: str | None = None,
    search: str | None = None,
    min_price: float | None = None,
    max_price: float | None = None,
    tags: str | None = None,
    sort_by: str | None = None,
    page: int = 1,
    limit: int = 20,
) -> tuple[list[Product], int, int]:
    """Return (items, total, pages)."""
    query: Select = select(Product).where(Product.is_active == True)  # noqa: E712
    count_q = select(func.count()).select_from(Product).where(Product.is_active == True)  # noqa: E712

    if category_slug:
        cat_ids = select(Category.id).where(
            or_(
                Category.slug == category_slug,
                Category.parent_id.in_(
                    select(Category.id).where(Category.slug == category_slug)
                ),
            )
        )
        query = query.where(Product.category_id.in_(cat_ids))
        count_q = count_q.where(Product.category_id.in_(cat_ids))

    if search:
        pattern = f"%{search}%"
        filt = or_(Product.name.ilike(pattern), Product.description.ilike(pattern))
        query = query.where(filt)
        count_q = count_q.where(filt)

    if min_price is not None:
        query = query.where(Product.price >= min_price)
        count_q = count_q.where(Product.price >= min_price)

    if max_price is not None:
        query = query.where(Product.price <= max_price)
        count_q = count_q.where(Product.price <= max_price)

    if tags:
        for tag in tags.split(","):
            tag = tag.strip()
            if not tag:
                continue
            filt = _tag_filter(db, tag)
            query = query.where(filt)
            count_q = count_q.where(filt)

    match sort_by:
        case "price_asc":
            query = query.order_by(Product.price.asc())
        case "price_desc":
            query = query.order_by(Product.price.desc())
        case "newest":
            query = query.order_by(Product.created_at.desc())
        case "discount":
            query = query.order_by(
                (Product.original_price - Product.price).desc()
            )
        case _:
            query = query.order_by(Product.created_at.desc())

    total = (await db.execute(count_q)).scalar() or 0
    pages = max(1, math.ceil(total / limit))
    query = query.offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    return list(result.scalars().all()), total, pages


async def get_product_by_slug(db: AsyncSession, slug: str) -> Product | None:
    result = await db.execute(select(Product).where(Product.slug == slug))
    return result.scalar_one_or_none()


async def get_product_by_id(db: AsyncSession, product_id: int) -> Product | None:
    result = await db.execute(select(Product).where(Product.id == product_id))
    return result.scalar_one_or_none()


async def _unique_slug(db: AsyncSession, base_slug: str, exclude_id: int | None = None) -> str:
    """Return a slug that doesn't collide with any existing product.
    
    If base_slug is taken, appends -2, -3, … until a free one is found.
    Pass exclude_id when updating so the product's own current slug is not
    treated as a collision.
    """
    candidate = base_slug
    suffix = 2
    while True:
        q = select(Product.id).where(Product.slug == candidate)
        if exclude_id is not None:
            q = q.where(Product.id != exclude_id)
        taken = (await db.execute(q)).scalar_one_or_none()
        if taken is None:
            return candidate
        candidate = f"{base_slug}-{suffix}"
        suffix += 1


def _is_slug_violation(exc: IntegrityError) -> bool:
    """Return True when the IntegrityError is specifically a slug uniqueness conflict."""
    msg = str(exc.orig).lower()
    return "ix_products_slug" in msg or (
        "unique" in msg and "slug" in msg
    )


async def create_product(
    db: AsyncSession, payload: ProductCreate, image_urls: list[str] | None = None,
) -> Product:
    base_slug = _slugify(payload.name)
    data = payload.model_dump()
    if data.get("variants"):
        data["variants"] = _clean_and_validate_variants(data["variants"])

    for attempt in range(_SLUG_RETRY_LIMIT):
        slug = await _unique_slug(db, base_slug)
        product = Product(**data, slug=slug, images=image_urls or [])
        db.add(product)
        try:
            await db.flush()
        except IntegrityError as exc:
            await db.rollback()
            if not _is_slug_violation(exc):
                # A different constraint (FK, not-null, etc.) — retrying won't help.
                raise
            if attempt < _SLUG_RETRY_LIMIT - 1:
                # Another request grabbed the same slug between our SELECT and INSERT.
                # Roll back, let _unique_slug pick the next free candidate, and retry.
                continue
            raise
        break

    await db.refresh(product)
    await _invalidate_product_cache(product.slug)
    return product


async def update_product(
    db: AsyncSession, product: Product, payload: ProductUpdate,
) -> Product:
    old_slug = product.slug
    data = payload.model_dump(exclude_unset=True)
    if "name" in data and data["name"]:
        # Only regenerate the slug if the name actually changed
        new_slug_base = _slugify(data["name"])
        if new_slug_base != product.slug:
            new_slug = await _unique_slug(db, new_slug_base, exclude_id=product.id)
            data["slug"] = new_slug
        else:
            # Name unchanged (or slug already matches) — keep existing slug
            data.pop("slug", None)
    if "variants" in data and data["variants"]:
        data["variants"] = _clean_and_validate_variants(data["variants"])

    # Full dict reassignment triggers SQLAlchemy dirty tracking for JSON columns.
    # Do NOT refactor to in-place mutation without calling flag_modified(product, "variants").
    for field, value in data.items():
        setattr(product, field, value)

    for attempt in range(_SLUG_RETRY_LIMIT):
        try:
            await db.flush()
        except IntegrityError as exc:
            await db.rollback()
            if not _is_slug_violation(exc):
                # A different constraint — retrying with a new slug won't fix it.
                raise
            if attempt < _SLUG_RETRY_LIMIT - 1:
                # Race: another request claimed this slug between our SELECT and UPDATE.
                # Re-fetch the product (session was rolled back) and pick a new slug.
                product = await get_product_by_id(db, product.id)
                new_base = _slugify(data.get("name", product.name))
                new_slug = await _unique_slug(db, new_base, exclude_id=product.id)
                data["slug"] = new_slug
                for field, value in data.items():
                    setattr(product, field, value)
                continue
            raise
        break

    await db.refresh(product)
    await cache_delete(f"product:{old_slug}")
    await _invalidate_product_cache(product.slug)
    return product


async def soft_delete_product(db: AsyncSession, product: Product) -> Product:
    product.is_active = False
    await db.flush()
    await db.refresh(product)
    await _invalidate_product_cache(product.slug)
    return product


async def _invalidate_product_cache(slug: str) -> None:
    await cache_delete(f"product:{slug}")
    await cache_delete_pattern("products:*")
