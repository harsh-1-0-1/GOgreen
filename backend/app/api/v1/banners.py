from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import require_admin
from app.db.models import Banner
from app.db.session import get_db
from app.schemas.banner import BannerOut, BannerReorderRequest
from app.utils.image_upload import delete_image_file, extract_relative_key, upload_image_file
from app.utils.redis import cache_delete, cache_get, cache_set

router = APIRouter(prefix="/banners", tags=["banners"])


async def _invalidate_banner_cache(placement: str) -> None:
    await cache_delete(f"banners:{placement}")
    await cache_delete("banners:all")


# ── PUBLIC ──────────────────────────────────────────────────────────────────


@router.get("", response_model=list[BannerOut])
async def get_banners(
    placement: str = "hero",
    db: AsyncSession = Depends(get_db),
):
    cache_key = f"banners:{placement}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    now = datetime.now(timezone.utc)
    stmt = (
        select(Banner)
        .where(
            Banner.placement == placement,
            Banner.is_active == True,  # noqa: E712
            (Banner.valid_from == None) | (Banner.valid_from <= now),  # noqa: E711
            (Banner.valid_until == None) | (Banner.valid_until >= now),  # noqa: E711
        )
        .order_by(Banner.position.asc())
    )
    result = await db.execute(stmt)
    banners = result.scalars().all()
    data = [BannerOut.model_validate(b).model_dump(mode="json") for b in banners]
    await cache_set(cache_key, data, ttl=300)
    return data


@router.get("/config")
async def get_banner_config(_admin=Depends(require_admin)):
    return {"cloudinary_enabled": False}


# ── ADMIN ───────────────────────────────────────────────────────────────────


@router.get("/admin", response_model=list[BannerOut])
async def admin_list_banners(
    placement: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    stmt = select(Banner).order_by(Banner.placement, Banner.position)
    if placement:
        stmt = stmt.where(Banner.placement == placement)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/admin/{banner_id}", response_model=BannerOut)
async def admin_get_banner(
    banner_id: int,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    banner = await db.get(Banner, banner_id)
    if not banner:
        raise HTTPException(404, "Banner not found")
    return banner


@router.post("/admin", response_model=BannerOut)
async def create_banner(
    title: str = Form(...),
    subtitle: Optional[str] = Form(None),
    cta_text: Optional[str] = Form(None),
    cta_link: Optional[str] = Form(None),
    badge_text: Optional[str] = Form(None),
    bg_color: str = Form("#F5F0E8"),
    text_color: str = Form("#1B4332"),
    position: int = Form(0),
    placement: str = Form("hero"),
    target_path: Optional[str] = Form(None),
    is_active: bool = Form(True),
    valid_from: Optional[str] = Form(None),
    valid_until: Optional[str] = Form(None),
    image_url_manual: Optional[str] = Form(None),
    image: Optional[UploadFile] = File(None),
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    banner = Banner(
        title=title,
        subtitle=subtitle,
        cta_text=cta_text,
        cta_link=cta_link,
        badge_text=badge_text,
        bg_color=bg_color,
        text_color=text_color,
        position=position,
        placement=placement,
        target_path=target_path,
        is_active=is_active,
        image_url=extract_relative_key(image_url_manual) if image_url_manual else None,
        image_public_id=None,
        valid_from=datetime.fromisoformat(valid_from) if valid_from else None,
        valid_until=datetime.fromisoformat(valid_until) if valid_until else None,
    )
    db.add(banner)
    await db.flush()
    if image and image.filename:
        key = await upload_image_file(image, folder="banners", entity_id=banner.id)
        banner.image_url = key
        banner.image_public_id = key
        await db.flush()
    await db.refresh(banner)
    await _invalidate_banner_cache(placement)
    logger.info("Banner created id={} placement={}", banner.id, placement)
    return banner


@router.put("/admin/{banner_id}", response_model=BannerOut)
async def update_banner(
    banner_id: int,
    title: Optional[str] = Form(None),
    subtitle: Optional[str] = Form(None),
    cta_text: Optional[str] = Form(None),
    cta_link: Optional[str] = Form(None),
    badge_text: Optional[str] = Form(None),
    bg_color: Optional[str] = Form(None),
    text_color: Optional[str] = Form(None),
    position: Optional[int] = Form(None),
    placement: Optional[str] = Form(None),
    target_path: Optional[str] = Form(None),
    is_active: Optional[bool] = Form(None),
    valid_from: Optional[str] = Form(None),
    valid_until: Optional[str] = Form(None),
    image_url_manual: Optional[str] = Form(None),
    image: Optional[UploadFile] = File(None),
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    banner = await db.get(Banner, banner_id)
    if not banner:
        raise HTTPException(404, "Banner not found")

    old_placement = banner.placement

    if image and image.filename:
        old_key = banner.image_public_id or banner.image_url
        key = await upload_image_file(image, folder="banners", entity_id=banner_id)
        banner.image_url = key
        banner.image_public_id = key
        if old_key != key:
            await delete_image_file(old_key)
    elif image_url_manual is not None:
        old_key = banner.image_public_id or banner.image_url
        if image_url_manual == "":
            banner.image_url = None
            banner.image_public_id = None
        else:
            banner.image_url = extract_relative_key(image_url_manual)
            banner.image_public_id = None
        if old_key != banner.image_url:
            await delete_image_file(old_key)

    updatable = dict(
        title=title,
        subtitle=subtitle,
        cta_text=cta_text,
        cta_link=cta_link,
        badge_text=badge_text,
        bg_color=bg_color,
        text_color=text_color,
        position=position,
        placement=placement,
        target_path=target_path,
        is_active=is_active,
    )
    for field, value in updatable.items():
        if value is not None:
            setattr(banner, field, value)

    if valid_from is not None:
        banner.valid_from = datetime.fromisoformat(valid_from)
    if valid_until is not None:
        banner.valid_until = datetime.fromisoformat(valid_until)

    await db.flush()
    await db.refresh(banner)
    await _invalidate_banner_cache(old_placement)
    if banner.placement != old_placement:
        await _invalidate_banner_cache(banner.placement)
    return banner


@router.delete("/admin/{banner_id}")
async def delete_banner(
    banner_id: int,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    banner = await db.get(Banner, banner_id)
    if not banner:
        raise HTTPException(404, "Banner not found")
    await delete_image_file(banner.image_public_id)
    placement = banner.placement
    await db.delete(banner)
    await db.flush()
    await _invalidate_banner_cache(placement)
    logger.info("Banner deleted id={}", banner_id)
    return {"ok": True}


@router.patch("/admin/{banner_id}/toggle", response_model=BannerOut)
async def toggle_banner(
    banner_id: int,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    banner = await db.get(Banner, banner_id)
    if not banner:
        raise HTTPException(404, "Banner not found")
    banner.is_active = not banner.is_active
    await db.flush()
    await db.refresh(banner)
    await _invalidate_banner_cache(banner.placement)
    return banner


@router.patch("/admin/reorder")
async def reorder_banners(
    body: BannerReorderRequest,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    placements_affected: set[str] = set()
    for item in body.items:
        banner = await db.get(Banner, item.id)
        if banner:
            banner.position = item.position
            placements_affected.add(banner.placement)
    await db.flush()
    for p in placements_affected:
        await _invalidate_banner_cache(p)
    return {"ok": True}
