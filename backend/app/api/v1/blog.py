import json
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import require_admin
from app.db.session import get_db
from app.schemas.blog import (
    BlogListResponse,
    BlogPostCreate,
    BlogPostResponse,
    BlogPostUpdate,
)
from app.services import blog_service
from app.utils.cloudinary_helper import upload_image
from app.utils.redis import cache_get, cache_set

router = APIRouter(prefix="/blog", tags=["blog"])

BLOG_TTL = 900  # 15 min


@router.get("", response_model=BlogListResponse)
async def list_posts(
    db: AsyncSession = Depends(get_db),
    category: str | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int, Query(ge=1, le=50)] = 10,
):
    cache_key = blog_service.make_list_cache_key(category, page, limit)
    cached = await cache_get(cache_key)
    if cached:
        return cached

    items, total, pages = await blog_service.list_posts(
        db, category=category, page=page, limit=limit,
    )

    resp = BlogListResponse(
        items=[BlogPostResponse.model_validate(p) for p in items],
        total=total,
        page=page,
        pages=pages,
        limit=limit,
    )
    await cache_set(cache_key, json.loads(resp.model_dump_json()), ttl=BLOG_TTL)
    return resp


@router.get("/{slug}", response_model=BlogPostResponse)
async def get_post(slug: str, db: AsyncSession = Depends(get_db)):
    cache_key = f"blog:{slug}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    post = await blog_service.get_post_by_slug(db, slug)
    if not post or not post.is_published:
        raise HTTPException(status_code=404, detail="Blog post not found")

    resp = BlogPostResponse.model_validate(post)
    await cache_set(cache_key, json.loads(resp.model_dump_json()), ttl=BLOG_TTL)
    return resp


@router.post("", response_model=BlogPostResponse, status_code=status.HTTP_201_CREATED)
async def create_post(
    title: Annotated[str, Form()],
    excerpt: Annotated[str, Form()],
    content: Annotated[str, Form()],
    category: Annotated[str, Form()],
    author_name: Annotated[str, Form()],
    is_published: Annotated[bool, Form()] = False,
    cover_image: UploadFile | None = File(default=None),
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    cover_url = None
    if cover_image:
        data = await cover_image.read()
        result = upload_image(data, folder="plantoga/blog")
        cover_url = result["url"]

    payload = BlogPostCreate(
        title=title,
        excerpt=excerpt,
        content=content,
        category=category,
        author_name=author_name,
        is_published=is_published,
    )
    post = await blog_service.create_post(db, payload, cover_url=cover_url)
    return post


@router.put("/{slug}", response_model=BlogPostResponse)
async def update_post(
    slug: str,
    body: BlogPostUpdate,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    post = await blog_service.get_post_by_slug(db, slug)
    if not post:
        raise HTTPException(status_code=404, detail="Blog post not found")
    post = await blog_service.update_post(db, post, body)
    return post


@router.delete("/{slug}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_post(
    slug: str,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    post = await blog_service.get_post_by_slug(db, slug)
    if not post:
        raise HTTPException(status_code=404, detail="Blog post not found")
    await blog_service.soft_delete_post(db, post)
