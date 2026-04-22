import hashlib
import math
import re

from sqlalchemy import Select, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Category, Product
from app.schemas.product import ProductCreate, ProductUpdate
from app.utils.redis import cache_delete, cache_delete_pattern


def _slugify(text: str) -> str:
    slug = text.lower().strip()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_]+", "-", slug)
    return re.sub(r"-+", "-", slug).strip("-")


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
            query = query.where(Product.tags.contains(tag))
            count_q = count_q.where(Product.tags.contains(tag))

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


async def create_product(
    db: AsyncSession, payload: ProductCreate, image_urls: list[str] | None = None,
) -> Product:
    slug = _slugify(payload.name)
    existing = await db.execute(select(Product).where(Product.slug == slug))
    if existing.scalar_one_or_none():
        slug = f"{slug}-{func.count()}"

    product = Product(
        **payload.model_dump(),
        slug=slug,
        images=image_urls or [],
    )
    db.add(product)
    await db.flush()
    await db.refresh(product)
    await _invalidate_product_cache(product.slug)
    return product


async def update_product(
    db: AsyncSession, product: Product, payload: ProductUpdate,
) -> Product:
    old_slug = product.slug
    data = payload.model_dump(exclude_unset=True)
    if "name" in data and data["name"]:
        data["slug"] = _slugify(data["name"])
    for field, value in data.items():
        setattr(product, field, value)
    await db.flush()
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
