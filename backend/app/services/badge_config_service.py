"""Per-category appearance of the badges drawn on a product image.

The storefront fetches the whole map once (it is a handful of rows) and resolves
each product against its PRIMARY category. A category without a row keeps the
defaults, so adding a category costs nothing until an admin customises it.
"""

import logging

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Category, CategoryBadgeConfig, Product, ProductReview, ReviewStatus
from app.schemas.badge_config import (
    BadgeEligibility,
    BadgeConfigMap,
    BadgeStyle,
    CategoryBadgeConfigBase,
    CategoryBadgeConfigOut,
    CategoryBadgeConfigUpdate,
)
from app.utils.redis import cache_delete, cache_get, cache_set

logger = logging.getLogger(__name__)

CACHE_KEY = "badge-configs:v2"
# The TTL is only a safety net: every write path (upsert, delete, category
# deletion) drops the key, so an admin's change is visible to the very next
# reader. Kept short so a change that slips past an invalidation — a crashed
# process between commit and delete, say — still heals quickly.
CACHE_TTL = 30

# Mirrors `BadgeStyle`'s factory defaults. Kept here (not imported from the
# schema instance) so the fallback path does not depend on Pydantic defaults
# staying in sync — these are the values a category with no row renders with.
DEFAULT_CONFIG = CategoryBadgeConfigBase(
    bestseller=BadgeStyle(enabled=True, label="BESTSELLER", color="#F59E0B"),
    discount=BadgeStyle(enabled=True, label="", color="#1B4332"),
    rating=BadgeStyle(enabled=True, label="", color="#1B4332"),
)


def _to_out(row: CategoryBadgeConfig) -> CategoryBadgeConfigOut:
    return CategoryBadgeConfigOut(
        id=row.id,
        category_id=row.category_id,
        bestseller=BadgeStyle(
            enabled=row.bestseller_enabled,
            label=row.bestseller_label or "",
            color=row.bestseller_color or DEFAULT_CONFIG.bestseller.color,
        ),
        discount=BadgeStyle(
            enabled=row.discount_enabled,
            label=row.discount_label or "",
            color=row.discount_color or DEFAULT_CONFIG.discount.color,
        ),
        rating=BadgeStyle(
            enabled=row.rating_enabled,
            label=row.rating_label or "",
            color=row.rating_color or DEFAULT_CONFIG.rating.color,
        ),
        updated_at=row.updated_at,
    )


async def get_category_badge_stats(db: AsyncSession, category_id: int) -> BadgeEligibility:
    """Count, per badge, how many products in a category would show it.

    Scope is the category plus its subcategories, matching how a config is
    inherited. Products are counted by their PRIMARY category because that is
    what a badge resolves against.

    Without this the admin page happily shows a preview of, say, a bestseller
    badge in a category where nothing is flagged as a bestseller — and the colour
    they picked looks like it never applied.
    """
    # Include the category and all its descendants (children, grandchildren...).
    parent = category_id
    scope_ids: list[int] = [parent]
    # BFS to collect descendants; depth small, so fine for this admin call.
    queue = [parent]
    seen = {parent}
    while queue:
        current = queue.pop(0)
        children = (
            await db.execute(select(Category.id).where(Category.parent_id == current))
        ).scalars().all()
        for cid in children:
            if cid not in seen:
                seen.add(cid)
                scope_ids.append(cid)
                queue.append(cid)
    scope = select(Category.id).where(Category.id.in_(scope_ids)) if scope_ids else select(Category.id).where(Category.id == -1)
    rows = (
        await db.execute(
            select(
                Product.id,
                Product.is_bestseller,
                Product.price,
                Product.original_price,
            ).where(Product.is_active == True, Product.category_id.in_(scope))  # noqa: E712
        )
    ).all()

    product_ids = [row[0] for row in rows]
    reviewed: set[int] = set()
    if product_ids:
        reviewed = set(
            (
                await db.execute(
                    select(ProductReview.product_id).where(
                        ProductReview.product_id.in_(product_ids),
                        ProductReview.status == ReviewStatus.PUBLISHED,
                    )
                )
            )
            .scalars()
            .all()
        )

    bestseller = discount = rating = 0
    for product_id, is_bestseller, price, original_price in rows:
        if is_bestseller:
            bestseller += 1
        if original_price and original_price > price:
            discount += 1
        if product_id in reviewed:
            rating += 1

    return BadgeEligibility(
        total=len(rows),
        bestseller=bestseller,
        discount=discount,
        rating=rating,
    )


async def invalidate_badge_config_cache() -> None:
    """Drop the cached map.

    Call this AFTER the transaction commits. Deleting before the commit leaves a
    window in which a concurrent reader refills the key with pre-commit data,
    which then serves stale colours until the TTL expires.
    """
    await cache_delete(CACHE_KEY)


async def get_badge_config_map(db: AsyncSession) -> BadgeConfigMap:
    """Every category's badge config, cached in Redis.

    Two maps come back: `by_category` holds the rows an admin actually saved,
    and `effective_by_category` holds what each category should actually render.
    The two differ because almost no product sits in a top-level category — a
    config saved on "Plants" must reach "Indoor Plants", "XL Plants" and the rest
    of its subcategories, otherwise the admin's colour silently applies to nothing.
    """
    cached = await cache_get(CACHE_KEY)
    if cached is not None:
        return BadgeConfigMap.model_validate(cached)

    rows = (await db.execute(select(CategoryBadgeConfig))).scalars().all()
    explicit = {row.category_id: _to_out(row) for row in rows}
    effective = await _resolve_effective(db, explicit)

    payload = BadgeConfigMap(
        defaults=DEFAULT_CONFIG,
        by_category={
            str(category_id): config.model_dump(mode="json")
            for category_id, config in explicit.items()
        },
        effective_by_category={
            str(category_id): config.model_dump(mode="json")
            for category_id, config in effective.items()
        },
    )
    await cache_set(CACHE_KEY, payload.model_dump(mode="json"), ttl=CACHE_TTL)
    return payload


async def _resolve_effective(
    db: AsyncSession, explicit: dict[int, CategoryBadgeConfigOut]
) -> dict[int, CategoryBadgeConfigBase]:
    """For every category, the nearest config on itself or an ancestor."""
    parent_of = dict(
        (
            await db.execute(select(Category.id, Category.parent_id))
        ).all()
    )

    def styles_for(category_id: int) -> CategoryBadgeConfigBase:
        row = explicit.get(category_id)
        if row is not None:
            return CategoryBadgeConfigBase(
                bestseller=row.bestseller, discount=row.discount, rating=row.rating
            )
        return CategoryBadgeConfigBase(
            bestseller=DEFAULT_CONFIG.bestseller,
            discount=DEFAULT_CONFIG.discount,
            rating=DEFAULT_CONFIG.rating,
        )

    effective: dict[int, CategoryBadgeConfigBase] = {}
    for category_id in parent_of:
        # Walk up until a saved row is found. The visited set guards against a
        # cycle in parent_id turning this into an infinite loop.
        current: int | None = category_id
        seen: set[int] = set()
        resolved: CategoryBadgeConfigBase | None = None
        while current is not None and current not in seen:
            seen.add(current)
            if current in explicit:
                resolved = styles_for(current)
                break
            current = parent_of.get(current)
        effective[category_id] = resolved or styles_for(category_id)
    return effective


async def get_category_badge_config(
    db: AsyncSession, category_id: int
) -> CategoryBadgeConfigOut | None:
    """A single category's config, or None when it has never been customised."""
    row = (
        await db.execute(
            select(CategoryBadgeConfig).where(CategoryBadgeConfig.category_id == category_id)
        )
    ).scalar_one_or_none()
    return _to_out(row) if row else None


async def upsert_category_badge_config(
    db: AsyncSession, category_id: int, payload: CategoryBadgeConfigUpdate
) -> CategoryBadgeConfigOut:
    """Create or replace a category's badge config, then bust the cache."""
    row = (
        await db.execute(
            select(CategoryBadgeConfig).where(CategoryBadgeConfig.category_id == category_id)
        )
    ).scalar_one_or_none()
    if row is None:
        row = CategoryBadgeConfig(category_id=category_id)
        db.add(row)

    for badge in ("bestseller", "discount", "rating"):
        style: BadgeStyle = getattr(payload, badge)
        setattr(row, f"{badge}_enabled", style.enabled)
        setattr(row, f"{badge}_label", style.label)
        setattr(row, f"{badge}_color", style.color)

    await db.flush()
    await db.refresh(row)
    # NOTE: do NOT invalidate the cache here — the transaction has not been committed yet.
    # The router calls invalidate_badge_config_cache() after db.commit(), which is the
    # correct place. Invalidating pre-commit opens a race where a concurrent reader
    # refills the cache from the DB before the commit lands, storing the old values.
    logger.info("Badge config updated category_id={}", category_id)
    return _to_out(row)


async def delete_category_badge_config(db: AsyncSession, category_id: int) -> bool:
    """Reset a category back to the defaults. Returns False when there was no row."""
    row = (
        await db.execute(
            select(CategoryBadgeConfig).where(CategoryBadgeConfig.category_id == category_id)
        )
    ).scalar_one_or_none()
    if row is None:
        return False
    await db.delete(row)
    await db.flush()
    # NOTE: do NOT invalidate here — transaction not committed yet. The router
    # calls invalidate_badge_config_cache() after db.commit().
    logger.info("Badge config reset category_id={}", category_id)
    return True