import hashlib
import math
import re
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import BlogCategory, BlogPost
from app.schemas.blog import BlogPostCreate, BlogPostUpdate
from app.utils.redis import cache_delete_pattern


def _slugify(text: str) -> str:
    slug = text.lower().strip()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_]+", "-", slug)
    return re.sub(r"-+", "-", slug).strip("-")


def make_list_cache_key(category: str | None, page: int, limit: int) -> str:
    raw = f"{category}:{page}:{limit}"
    h = hashlib.md5(raw.encode()).hexdigest()[:12]
    return f"blog:list:{h}"


async def list_posts(
    db: AsyncSession,
    *,
    category: str | None = None,
    page: int = 1,
    limit: int = 10,
) -> tuple[list[BlogPost], int, int]:
    query = select(BlogPost).where(BlogPost.is_published == True)  # noqa: E712
    count_q = select(func.count()).select_from(BlogPost).where(BlogPost.is_published == True)  # noqa: E712

    if category:
        cat_enum = BlogCategory(category.upper())
        query = query.where(BlogPost.category == cat_enum)
        count_q = count_q.where(BlogPost.category == cat_enum)

    query = query.order_by(BlogPost.published_at.desc())

    total = (await db.execute(count_q)).scalar() or 0
    pages = max(1, math.ceil(total / limit))
    query = query.offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    return list(result.scalars().all()), total, pages


async def get_post_by_slug(db: AsyncSession, slug: str) -> BlogPost | None:
    result = await db.execute(select(BlogPost).where(BlogPost.slug == slug))
    return result.scalar_one_or_none()


async def create_post(
    db: AsyncSession,
    payload: BlogPostCreate,
    cover_url: str | None = None,
) -> BlogPost:
    slug = _slugify(payload.title)
    existing = await db.execute(select(BlogPost).where(BlogPost.slug == slug))
    if existing.scalar_one_or_none():
        slug = f"{slug}-2"

    published_at = datetime.now(timezone.utc) if payload.is_published else None

    post = BlogPost(
        title=payload.title,
        slug=slug,
        excerpt=payload.excerpt,
        content=payload.content,
        cover_image_url=cover_url,
        category=BlogCategory(payload.category.upper()),
        author_name=payload.author_name,
        is_published=payload.is_published,
        published_at=published_at,
    )
    db.add(post)
    await db.flush()
    await db.refresh(post)
    await _invalidate_blog_cache()
    return post


async def update_post(
    db: AsyncSession,
    post: BlogPost,
    payload: BlogPostUpdate,
) -> BlogPost:
    data = payload.model_dump(exclude_unset=True)
    if "title" in data and data["title"]:
        data["slug"] = _slugify(data["title"])
    if "category" in data and data["category"]:
        data["category"] = BlogCategory(data["category"].upper())
    if data.get("is_published") and not post.is_published:
        data["published_at"] = datetime.now(timezone.utc)
    for field, value in data.items():
        setattr(post, field, value)
    await db.flush()
    await db.refresh(post)
    await _invalidate_blog_cache()
    return post


async def soft_delete_post(db: AsyncSession, post: BlogPost) -> BlogPost:
    post.is_published = False
    await db.flush()
    await db.refresh(post)
    await _invalidate_blog_cache()
    return post


async def _invalidate_blog_cache() -> None:
    await cache_delete_pattern("blog:*")
