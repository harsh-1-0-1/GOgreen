from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from loguru import logger
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import require_admin
from app.db.models import Product, Story
from app.db.session import get_db
from app.schemas.story import StoryResponse
from app.utils.image_upload import delete_image_file, upload_image_file

router = APIRouter(prefix="/stories", tags=["stories"])

MAX_VIDEO_SIZE = 50 * 1024 * 1024  # 50 MB
ALLOWED_VIDEO_TYPES = {"video/mp4", "video/webm"}


async def _validate_video(video: UploadFile | None) -> None:
    if not video:
        return
    if video.content_type not in ALLOWED_VIDEO_TYPES:
        raise HTTPException(400, "Invalid video format. Only MP4 and WebM are allowed.")
    
    # Read the first chunk to ensure we can seek/read, and check total size if possible
    # We'll rely on reading it into memory and checking size during upload_image_file but to be strict:
    file_size = 0
    while chunk := await video.read(8192):
        file_size += len(chunk)
        if file_size > MAX_VIDEO_SIZE:
            raise HTTPException(400, f"Video file too large. Max size is {MAX_VIDEO_SIZE // (1024*1024)}MB.")
    
    await video.seek(0)


# ── PUBLIC ──────────────────────────────────────────────────────────────────

@router.get("", response_model=list[StoryResponse])
async def get_active_stories(db: AsyncSession = Depends(get_db)):
    stmt = (
        select(Story)
        .where(Story.is_active == True)  # noqa: E712
        .options(selectinload(Story.linked_product))
        .order_by(Story.display_order.asc())
    )
    result = await db.execute(stmt)
    return result.scalars().all()


# ── ADMIN ───────────────────────────────────────────────────────────────────

@router.get("/admin", response_model=list[StoryResponse])
async def admin_list_stories(
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    stmt = select(Story).options(selectinload(Story.linked_product)).order_by(Story.display_order.asc())
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/admin", response_model=StoryResponse)
async def create_story(
    video: UploadFile = File(...),
    thumbnail: Optional[UploadFile] = File(None),
    caption: Optional[str] = Form(None),
    linked_product_id: Optional[int] = Form(None),
    display_order: int = Form(0),
    is_active: bool = Form(True),
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    await _validate_video(video)

    # Frontend sends 0 to mean "no product" (same convention as update)
    resolved_product_id = linked_product_id if linked_product_id else None

    if resolved_product_id:
        product = await db.get(Product, resolved_product_id)
        if not product:
            raise HTTPException(404, "Linked product not found")

    story = Story(
        video="",  # Will update after upload
        caption=caption,
        linked_product_id=resolved_product_id,
        display_order=display_order,
        is_active=is_active,
    )
    db.add(story)
    await db.flush()

    video_key = await upload_image_file(video, folder="stories/video", entity_id=story.id)
    story.video = video_key

    if thumbnail and thumbnail.filename:
        thumb_key = await upload_image_file(thumbnail, folder="stories/thumb", entity_id=story.id)
        story.thumbnail = thumb_key

    await db.flush()
    # Need to load the relationship if it's there
    if story.linked_product_id:
        await db.refresh(story, attribute_names=["linked_product"])
    logger.info("Story created id={}", story.id)
    return story


@router.put("/admin/{story_id}", response_model=StoryResponse)
async def update_story(
    story_id: int,
    video: Optional[UploadFile] = File(None),
    thumbnail: Optional[UploadFile] = File(None),
    caption: Optional[str] = Form(None),
    linked_product_id: Optional[int] = Form(None),
    display_order: Optional[int] = Form(None),
    is_active: Optional[bool] = Form(None),
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    story = await db.get(Story, story_id, options=[selectinload(Story.linked_product)])
    if not story:
        raise HTTPException(404, "Story not found")

    if video and video.filename:
        await _validate_video(video)
        old_video_key = story.video
        video_key = await upload_image_file(video, folder="stories/video", entity_id=story.id)
        story.video = video_key
        if old_video_key:
            await delete_image_file(old_video_key)

    if thumbnail and thumbnail.filename:
        old_thumb_key = story.thumbnail
        thumb_key = await upload_image_file(thumbnail, folder="stories/thumb", entity_id=story.id)
        story.thumbnail = thumb_key
        if old_thumb_key:
            await delete_image_file(old_thumb_key)

    if caption is not None:
        story.caption = caption
    if linked_product_id is not None:
        # If trying to set a new product, check it exists
        if linked_product_id != 0:
            product = await db.get(Product, linked_product_id)
            if not product:
                raise HTTPException(404, "Linked product not found")
            story.linked_product_id = linked_product_id
        else:
            story.linked_product_id = None
    if display_order is not None:
        story.display_order = display_order
    if is_active is not None:
        story.is_active = is_active

    await db.flush()
    if linked_product_id is not None:
        await db.refresh(story, attribute_names=["linked_product"])
    return story


@router.delete("/admin/{story_id}")
async def delete_story(
    story_id: int,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    story = await db.get(Story, story_id)
    if not story:
        raise HTTPException(404, "Story not found")
    
    if story.video:
        await delete_image_file(story.video)
    if story.thumbnail:
        await delete_image_file(story.thumbnail)
        
    await db.delete(story)
    await db.flush()
    logger.info("Story deleted id={}", story_id)
    return {"ok": True}
