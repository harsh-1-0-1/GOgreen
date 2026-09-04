from fastapi import APIRouter, Depends, HTTPException
from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import require_admin
from app.db.models import MenuItem
from app.db.session import get_db
from app.schemas.menu_item import (
    MenuItemCreate,
    MenuItemOut,
    MenuItemReorderRequest,
    MenuItemUpdate,
)
from app.utils.redis import cache_delete, cache_get, cache_set

router = APIRouter(prefix="/menu_items", tags=["menu_items"])

CACHE_KEY = "menu_items"


async def _invalidate_menu_cache() -> None:
    await cache_delete(CACHE_KEY)


async def _check_duplicate_label(
    db: AsyncSession,
    label: str,
    parent_id: int | None,
    exclude_id: int | None = None,
) -> None:
    """Check for duplicate (label, parent_id) using IS NOT DISTINCT FROM semantics.

    Handles top-level (parent_id IS NULL) separately from submenu items because
    SQL NULL semantics make the composite unique constraint ineffective for NULL."""

    if parent_id is None:
        dup_filter = MenuItem.parent_id.is_(None)
    else:
        dup_filter = MenuItem.parent_id == parent_id

    stmt = select(MenuItem).where(MenuItem.label == label, dup_filter)
    if exclude_id is not None:
        stmt = stmt.where(MenuItem.id != exclude_id)

    result = await db.execute(stmt)
    if result.scalar_one_or_none():
        raise HTTPException(
            409,
            "A menu item with this name already exists under the same parent.",
        )


async def _validate_parent(
    db: AsyncSession,
    parent_id: int | None,
    self_id: int | None = None,
) -> None:
    """Validate a parent reference: exists, not self, not nested beyond depth 1."""
    if parent_id is None:
        return
    if self_id is not None and parent_id == self_id:
        raise HTTPException(400, "Cannot set an item as its own parent")
    parent = await db.get(MenuItem, parent_id)
    if not parent:
        raise HTTPException(404, "Parent menu item not found")
    if parent.parent_id is not None:
        raise HTTPException(
            400,
            "Maximum nesting depth is 1 level (submenu items must be direct children of a top-level item)",
        )


def _order_stmt():
    return (
        select(MenuItem)
        .order_by(
            MenuItem.parent_id.asc().nulls_first(),
            MenuItem.sort_order.asc(),
            MenuItem.label.asc(),
        )
    )


# -- PUBLIC --

@router.get("", response_model=list[MenuItemOut])
async def get_menu_items(db: AsyncSession = Depends(get_db)):
    """Public endpoint: returns a FLAT list of all active menu items.

    Top-level items have parent_id = null; submenu children have parent_id set.
    No nesting — the frontend separates them by filtering on parent_id."""
    cached = await cache_get(CACHE_KEY)
    if cached:
        return cached

    stmt = _order_stmt().where(MenuItem.is_active.is_(True))
    result = await db.execute(stmt)
    items = result.scalars().all()

    data = [MenuItemOut.model_validate(m).model_dump(mode="json") for m in items]
    await cache_set(CACHE_KEY, data, ttl=300)
    return data


# -- ADMIN --

@router.get("/admin", response_model=list[MenuItemOut])
async def admin_list_menu_items(
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    """Admin endpoint: same FLAT shape as public, but includes inactive items."""
    result = await db.execute(_order_stmt())
    return result.scalars().all()


@router.get("/admin/{item_id}", response_model=MenuItemOut)
async def admin_get_menu_item(
    item_id: int,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    item = await db.get(MenuItem, item_id)
    if not item:
        raise HTTPException(404, "Menu item not found")
    return item


@router.post("/admin", response_model=MenuItemOut)
async def create_menu_item(
    body: MenuItemCreate,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    await _validate_parent(db, body.parent_id)
    await _check_duplicate_label(db, body.label, body.parent_id)

    item = MenuItem(
        label=body.label,
        href=body.href,
        parent_id=body.parent_id,
        image_url=body.image_url,
        accent_color=body.accent_color,
        highlight=body.highlight,
        sort_order=body.sort_order,
        is_active=body.is_active,
    )
    db.add(item)
    await db.flush()
    await db.refresh(item)
    await _invalidate_menu_cache()
    logger.info("Menu item created id={}", item.id)
    return item


@router.put("/admin/{item_id}", response_model=MenuItemOut)
async def update_menu_item(
    item_id: int,
    body: MenuItemUpdate,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    item = await db.get(MenuItem, item_id)
    if not item:
        raise HTTPException(404, "Menu item not found")

    new_parent_id = body.parent_id if body.parent_id is not None else item.parent_id
    await _validate_parent(db, new_parent_id, self_id=item.id)

    new_label = body.label if body.label is not None else item.label
    await _check_duplicate_label(db, new_label, new_parent_id, exclude_id=item.id)

    updatable = {
        "label": new_label,
        "href": body.href if body.href is not None else item.href,
        "parent_id": new_parent_id,
        "image_url": body.image_url,
        "accent_color": body.accent_color,
        "highlight": body.highlight,
        "sort_order": body.sort_order,
        "is_active": body.is_active,
    }
    for field, value in updatable.items():
        if value is not None:
            setattr(item, field, value)

    await db.flush()
    await db.refresh(item)
    await _invalidate_menu_cache()
    logger.info("Menu item updated id={}", item.id)
    return item


@router.delete("/admin/{item_id}")
async def delete_menu_item(
    item_id: int,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    item = await db.get(MenuItem, item_id)
    if not item:
        raise HTTPException(404, "Menu item not found")

    # Query children explicitly — accessing the lazy .children relationship on
    # the async session would raise MissingGreenlet.
    stmt = select(MenuItem.id).where(MenuItem.parent_id == item_id)
    children = (await db.execute(stmt)).scalars().all()
    if children:
        raise HTTPException(
            400,
            f"Cannot delete menu item with {len(children)} submenu item(s). Remove or reassign children first.",
        )

    await db.delete(item)
    await db.flush()
    await _invalidate_menu_cache()
    logger.info("Menu item deleted id={}", item_id)
    return {"ok": True}


@router.patch("/admin/{item_id}/toggle", response_model=MenuItemOut)
async def toggle_menu_item(
    item_id: int,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    item = await db.get(MenuItem, item_id)
    if not item:
        raise HTTPException(404, "Menu item not found")
    item.is_active = not item.is_active
    await db.flush()
    await db.refresh(item)
    await _invalidate_menu_cache()
    return item


@router.patch("/admin/reorder")
async def reorder_menu_items(
    body: MenuItemReorderRequest,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    if not body.items:
        return {"ok": True}

    ids = [item.id for item in body.items]
    stmt = select(MenuItem).where(MenuItem.id.in_(ids))
    result = await db.execute(stmt)
    items_map = {m.id: m for m in result.scalars().all()}

    missing = set(ids) - set(items_map.keys())
    if missing:
        raise HTTPException(
            400,
            f"Unknown menu item ids: {sorted(missing)}. The list may be stale — refresh and try again.",
        )

    parent_ids = {items_map[iid].parent_id for iid in ids}
    if len(parent_ids) > 1:
        raise HTTPException(
            400,
            "All items in a reorder batch must be at the same level (same parent_id). Use PUT to move items between levels.",
        )

    for item in body.items:
        items_map[item.id].sort_order = item.sort_order

    await db.flush()
    await _invalidate_menu_cache()
    return {"ok": True}


# Default seed data — parents-first ordering is required so children
# can resolve their parent label after the parent is created/updated.
DEFAULT_MENU_ITEMS = [
    # Top-level
    {"label": "Gifting", "href": "/products?tags=gifting", "image_url": "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=280&q=80", "accent_color": "#f9c8d4", "highlight": False, "sort_order": 0},
    {"label": "Corporate Gifts", "href": "/corporate-gifting", "image_url": "https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=280&q=80", "accent_color": "#cdebd7", "highlight": False, "sort_order": 1},
    {"label": "Garden Services", "href": "/products?tags=garden-services", "image_url": "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=280&q=80", "accent_color": "#d6e6f5", "highlight": False, "sort_order": 2},
    {"label": "Blog", "href": "/blog", "image_url": "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=280&q=80", "accent_color": "#f9c8d4", "highlight": False, "sort_order": 3},
    {"label": "Offers", "href": "/products?tags=offers", "image_url": "https://images.unsplash.com/photo-1560693225-b8507d6f3aa9?w=280&q=80", "accent_color": "#f9e4a0", "highlight": True, "sort_order": 4},
    # Submenu children
    {"label": "All Gifts", "href": "/products?tags=gifting", "parent_label": "Gifting", "sort_order": 0},
    {"label": "Plant Gifting", "href": "/products?tags=gifting", "parent_label": "Gifting", "sort_order": 1},
    {"label": "Corporate Gifting", "href": "/corporate-gifting", "parent_label": "Gifting", "sort_order": 2},
    {"label": "Vastu Gifting", "href": "/products?tags=vastu-friendly", "parent_label": "Gifting", "sort_order": 3},
]


@router.post("/admin/seed-defaults")
async def seed_defaults(
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    """Idempotent upsert-by-label. Processing parents before children guarantees
    the parent exists before a child tries to reference it."""
    created = 0
    updated = 0

    for item_data in DEFAULT_MENU_ITEMS:
        parent_id = None
        if item_data.get("parent_label"):
            parent_stmt = select(MenuItem).where(
                MenuItem.label == item_data["parent_label"],
                MenuItem.parent_id.is_(None),
            )
            parent_result = await db.execute(parent_stmt)
            parent = parent_result.scalar_one_or_none()
            if parent:
                parent_id = parent.id

        if parent_id is None:
            dup_filter = MenuItem.parent_id.is_(None)
        else:
            dup_filter = MenuItem.parent_id == parent_id

        stmt = select(MenuItem).where(
            MenuItem.label == item_data["label"],
            dup_filter,
        )
        result = await db.execute(stmt)
        existing = result.scalar_one_or_none()

        if existing:
            existing.href = item_data["href"]
            existing.image_url = item_data.get("image_url")
            existing.accent_color = item_data.get("accent_color")
            existing.highlight = item_data.get("highlight", False)
            existing.is_active = True
            updated += 1
        else:
            new_item = MenuItem(
                label=item_data["label"],
                href=item_data["href"],
                parent_id=parent_id,
                image_url=item_data.get("image_url"),
                accent_color=item_data.get("accent_color"),
                highlight=item_data.get("highlight", False),
                sort_order=item_data.get("sort_order", 0),
                is_active=True,
            )
            db.add(new_item)
            created += 1

    await db.flush()
    await _invalidate_menu_cache()
    return {"created": created, "updated": updated}
