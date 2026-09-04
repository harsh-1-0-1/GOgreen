from datetime import datetime, timezone
from io import BytesIO
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from loguru import logger
from PIL import Image
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import httpx

from app.core.security import require_admin
from app.db.models import Banner
from app.db.session import get_db
from app.schemas.banner import BannerOut, BannerReorderRequest
from app.utils.image_upload import delete_image_file, extract_relative_key, upload_image_file, resolve_image_url, generate_image_key
from app.utils.redis import cache_delete, cache_get, cache_set
from fastapi.concurrency import run_in_threadpool

router = APIRouter(prefix="/banners", tags=["banners"])


class CropRequest(BaseModel):
    x: int
    y: int
    width: int
    height: int


async def _invalidate_banner_cache(placement: str, target_path: str | None = None) -> None:
    await cache_delete(f"banners:{placement}:")         # global (no slug)
    await cache_delete(f"banners:{placement}")          # legacy key guard
    await cache_delete("banners:all")
    if target_path:
        await cache_delete(f"banners:{placement}:{target_path}")


# ── PUBLIC ──────────────────────────────────────────────────────────────────


@router.get("", response_model=list[BannerOut])
async def get_banners(
    placement: str = "hero",
    category_slug: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    # Cache key includes category_slug so category-scoped and global results
    # are cached independently.
    cache_key = f"banners:{placement}:{category_slug or ''}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    now = datetime.now(timezone.utc)
    base_filter = [
        Banner.placement == placement,
        Banner.is_active == True,  # noqa: E712
        (Banner.valid_from == None) | (Banner.valid_from <= now),  # noqa: E711
        (Banner.valid_until == None) | (Banner.valid_until >= now),  # noqa: E711
    ]

    if category_slug:
        # Accept target_path saved as bare slug ("plants") OR as the full
        # query-string path ("/products?category=plants") so banners work
        # regardless of how they were entered in the admin. Also trim whitespace
        # from stored target_path to handle accidental spaces.
        from sqlalchemy import func
        
        full_path = f"/products?category={category_slug}"
        stmt = (
            select(Banner)
            .where(
                *base_filter,
                (func.trim(Banner.target_path).ilike(category_slug))
                | (func.trim(Banner.target_path).ilike(full_path)),
            )
            .order_by(Banner.position.asc())
        )
        result = await db.execute(stmt)
        banners = result.scalars().all()

        # Fall back to the global banner (target_path IS NULL) when no
        # category-specific one exists yet.
        if not banners:
            stmt = (
                select(Banner)
                .where(*base_filter, Banner.target_path == None)  # noqa: E711
                .order_by(Banner.position.asc())
            )
            result = await db.execute(stmt)
            banners = result.scalars().all()
    else:
        # No slug provided — return global banners only (target_path IS NULL).
        stmt = (
            select(Banner)
            .where(*base_filter, Banner.target_path == None)  # noqa: E711
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


def _crop_and_upload_sync(banner_id: int, old_key: str, x: int, y: int, width: int, height: int) -> str:
    """
    Synchronous function that:
    1. Downloads image from S3
    2. Crops it with Pillow
    3. Uploads cropped version back to S3
    
    Runs in threadpool to avoid blocking async event loop.
    """
    from app.core.config import settings
    import boto3
    from pathlib import Path
    
    # Get S3 client
    s3 = boto3.client(
        "s3",
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        region_name=settings.AWS_REGION or "us-east-1",
    )
    
    is_prod = settings.ENVIRONMENT.lower() == "production"
    bucket = settings.AWS_S3_BUCKET
    
    # Determine original format from key extension
    original_ext = Path(old_key).suffix.lower()
    if original_ext not in {".jpg", ".jpeg", ".png", ".webp"}:
        original_ext = ".png"  # Default fallback
    
    # Map extension to PIL format
    format_map = {
        ".jpg": "JPEG",
        ".jpeg": "JPEG",
        ".png": "PNG",
        ".webp": "WEBP",
    }
    pil_format = format_map.get(original_ext, "PNG")
    
    try:
        if is_prod and bucket:
            # Production: Download from S3
            response = s3.get_object(Bucket=bucket, Key=old_key)
            image_bytes = response["Body"].read()
        else:
            # Local/dev: Read from static folder
            local_path = Path("static") / old_key
            if not local_path.exists():
                raise FileNotFoundError(f"Image not found: {local_path}")
            image_bytes = local_path.read_bytes()
        
        # Open and crop image
        image = Image.open(BytesIO(image_bytes))
        
        # Validate crop bounds against actual image dimensions
        if x < 0 or y < 0:
            raise ValueError(f"Crop coordinates cannot be negative: x={x}, y={y}")
        if x + width > image.width or y + height > image.height:
            raise ValueError(
                f"Crop box ({x}, {y}, {x+width}, {y+height}) exceeds image bounds ({image.width}x{image.height})"
            )
        
        cropped = image.crop((x, y, x + width, y + height))
        
        # Save to bytes buffer preserving format
        output_buffer = BytesIO()
        cropped.save(output_buffer, format=pil_format)
        output_buffer.seek(0)
        cropped_bytes = output_buffer.read()
        
        # Generate new key for cropped image
        new_key = generate_image_key("banners", banner_id, f"cropped{original_ext}")
        
        # Upload cropped image
        if is_prod and bucket:
            # Production: Upload to S3
            content_type_map = {
                "JPEG": "image/jpeg",
                "PNG": "image/png",
                "WEBP": "image/webp",
            }
            s3.put_object(
                Bucket=bucket,
                Key=new_key,
                Body=cropped_bytes,
                ContentType=content_type_map.get(pil_format, "image/png"),
                CacheControl="public, max-age=31536000, immutable",
            )
        else:
            # Local/dev: Write to static folder
            dest = Path("static") / new_key
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(cropped_bytes)
        
        logger.info(f"Cropped banner image: {old_key} -> {new_key}")
        return new_key
        
    except Exception as e:
        logger.error(f"Failed to crop image {old_key}: {e}")
        raise


@router.post("/admin/{banner_id}/crop", response_model=BannerOut)
async def crop_banner_image(
    banner_id: int,
    crop: CropRequest,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    """
    Server-side image cropping endpoint.
    
    Accepts crop coordinates from the frontend, downloads the original image from S3,
    crops it with Pillow, uploads the cropped version, and updates the banner record.
    
    This avoids CORS issues with client-side canvas cropping.
    """
    banner = await db.get(Banner, banner_id)
    if not banner:
        raise HTTPException(404, "Banner not found")
    
    old_key = banner.image_public_id or banner.image_url
    if not old_key:
        raise HTTPException(400, "Banner has no image to crop")
    
    # Validate crop coordinates
    if crop.width <= 0 or crop.height <= 0:
        raise HTTPException(400, "Invalid crop dimensions")
    
    try:
        # Perform crop in threadpool (sync S3 + Pillow operations)
        new_key = await run_in_threadpool(
            _crop_and_upload_sync,
            banner_id,
            old_key,
            crop.x,
            crop.y,
            crop.width,
            crop.height,
        )
        
        # Update banner with new cropped image
        banner.image_url = new_key
        banner.image_public_id = new_key
        
        # Delete old image to prevent S3 orphans
        if old_key != new_key:
            await delete_image_file(old_key)
        
        await db.flush()
        await db.refresh(banner)
        
        # Invalidate cache
        await _invalidate_banner_cache(banner.placement, banner.target_path)
        
        logger.info(f"Banner {banner_id} image cropped successfully")
        return banner
        
    except ValueError as e:
        # Client error: invalid crop coordinates
        raise HTTPException(400, str(e))
    except FileNotFoundError as e:
        raise HTTPException(404, str(e))
    except Exception as e:
        logger.error(f"Crop operation failed for banner {banner_id}: {e}")
        raise HTTPException(500, "Failed to crop image")


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
    await _invalidate_banner_cache(placement, target_path)
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
    await _invalidate_banner_cache(old_placement, banner.target_path)
    if banner.placement != old_placement:
        await _invalidate_banner_cache(banner.placement, banner.target_path)
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
    target_path = banner.target_path
    await db.delete(banner)
    await db.flush()
    await _invalidate_banner_cache(placement, target_path)
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
    await _invalidate_banner_cache(banner.placement, banner.target_path)
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
