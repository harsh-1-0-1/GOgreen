from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import require_admin
from app.db.session import get_db
from app.schemas.tag import TagCreate, TagResponse, TagUpdate
from app.services import tag_service
from app.utils.redis import cache_delete, cache_get, cache_set


router = APIRouter(prefix="/tags", tags=["tags"])

TAGS_ALL_KEY = "tags:all"
TAGS_TTL = 600


@router.get("", response_model=list[TagResponse])
async def list_tags(response: Response, db: AsyncSession = Depends(get_db)):
    # `no-cache`, not `max-age=300`: the admin tag editor recolours and deletes
    # tags, and a browser-cached copy would keep showing the old colours for
    # minutes after a write. The Redis cache below already absorbs the load.
    response.headers["Cache-Control"] = "no-cache"
    cached = await cache_get(TAGS_ALL_KEY)
    if cached:
        return cached

    tags = await tag_service.list_tags(db)
    payload = [TagResponse.model_validate(t).model_dump(mode="json") for t in tags]
    await cache_set(TAGS_ALL_KEY, payload, ttl=TAGS_TTL)
    return payload


@router.get("/admin", response_model=list[TagResponse])
async def list_tags_admin(
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    tags = await tag_service.list_tags(db, include_inactive=True)
    return tags


@router.post("", response_model=TagResponse, status_code=status.HTTP_201_CREATED)
async def create_tag(
    body: TagCreate,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    tag = await tag_service.create_tag(db, body)
    await cache_delete(TAGS_ALL_KEY)
    return tag


@router.put("/{tag_id}", response_model=TagResponse)
async def update_tag(
    tag_id: int,
    body: TagUpdate,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    tag = await tag_service.get_tag_by_id(db, tag_id)
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    tag = await tag_service.update_tag(db, tag, body)
    await cache_delete(TAGS_ALL_KEY)
    return tag


@router.delete("/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tag(
    tag_id: int,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    tag = await tag_service.get_tag_by_id(db, tag_id)
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    await tag_service.delete_tag(db, tag)
    await cache_delete(TAGS_ALL_KEY)