from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import require_admin
from app.db.session import get_db
from app.schemas.badge_config import (
    BadgeConfigMap,
    CategoryBadgeConfigOut,
    CategoryBadgeConfigUpdate,
)
from app.services import badge_config_service

router = APIRouter(prefix="/badge-configs", tags=["badge_configs"])


@router.get("", response_model=BadgeConfigMap)
async def list_badge_configs(
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """Public: what every category's badges look like.

    The storefront calls this once and resolves each product against its primary
    category, so the badge wording and colour never ship inside the product list.

    `no-cache` tells browsers and proxies they MUST revalidate with the server
    before using a cached copy. This prevents the browser from serving stale
    colours after an admin saves new ones. The Redis layer (30 s TTL) still
    provides server-side caching so the DB isn't hit on every storefront load.
    `must-revalidate` reinforces that stale-while-revalidate / stale-if-error
    must not be applied by intermediaries.
    """
    response.headers["Cache-Control"] = "no-cache, must-revalidate"
    return await badge_config_service.get_badge_config_map(db)


@router.get(
    "/{category_id}",
    response_model=CategoryBadgeConfigOut | None,
    dependencies=[Depends(require_admin)],
)
async def get_badge_config(
    category_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Admin: one category's config, or null when it still uses the defaults."""
    return await badge_config_service.get_category_badge_config(db, category_id)


@router.put("/{category_id}", response_model=CategoryBadgeConfigOut)
async def upsert_badge_config(
    category_id: int,
    payload: CategoryBadgeConfigUpdate,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    """Admin: set the badge wording, colour and on/off switches for a category."""
    from app.db.models import Category

    exists = await db.get(Category, category_id)
    if exists is None:
        raise HTTPException(status_code=404, detail="Category not found")
    config = await badge_config_service.upsert_category_badge_config(db, category_id, payload)
    await db.commit()
    # After the commit, so no reader can cache the pre-change map.
    await badge_config_service.invalidate_badge_config_cache()
    return config


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def reset_badge_config(
    category_id: int,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    """Admin: drop a category's customisation so it falls back to the defaults."""
    removed = await badge_config_service.delete_category_badge_config(db, category_id)
    if not removed:
        raise HTTPException(
            status_code=404, detail="This category has no badge overrides to reset"
        )
    await db.commit()
    await badge_config_service.invalidate_badge_config_cache()
    return None

@router.get("/{category_id}/stats")
async def badge_config_stats(
    category_id: int,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    """Admin: how many products in this category would show each badge.

    Lets the editor warn that a badge will never appear — e.g. a bestseller badge
    in a category where no product is flagged as one — instead of leaving the
    admin to wonder why their colour never appeared.
    """
    from app.db.models import Category

    exists = await db.get(Category, category_id)
    if exists is None:
        raise HTTPException(status_code=404, detail="Category not found")
    stats = await badge_config_service.get_category_badge_stats(db, category_id)
    return stats
