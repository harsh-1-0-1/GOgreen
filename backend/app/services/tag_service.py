import re

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Tag
from app.schemas.tag import TagCreate, TagUpdate


def _slugify(text: str) -> str:
    slug = text.lower().strip()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_]+", "-", slug)
    return re.sub(r"-+", "-", slug).strip("-")


async def _unique_slug(db: AsyncSession, base: str, exclude_id: int | None = None) -> str:
    """Pick a slug, appending a numeric suffix if the base is already taken."""
    candidate = base or "tag"
    suffix = 1
    while True:
        stmt = select(Tag.id).where(Tag.slug == candidate)
        if exclude_id is not None:
            stmt = stmt.where(Tag.id != exclude_id)
        result = await db.execute(stmt)
        if result.scalar_one_or_none() is None:
            return candidate
        suffix += 1
        candidate = f"{base}-{suffix}"


async def list_tags(db: AsyncSession, include_inactive: bool = False) -> list[Tag]:
    stmt = select(Tag)
    if not include_inactive:
        stmt = stmt.where(Tag.is_active == True)  # noqa: E712
    result = await db.execute(stmt.order_by(Tag.sort_order.asc(), Tag.id.asc()))
    return list(result.scalars().all())


async def get_tag_by_id(db: AsyncSession, tag_id: int) -> Tag | None:
    result = await db.execute(select(Tag).where(Tag.id == tag_id))
    return result.scalar_one_or_none()


async def get_tag_by_slug(db: AsyncSession, slug: str) -> Tag | None:
    result = await db.execute(select(Tag).where(Tag.slug == slug))
    return result.scalar_one_or_none()


async def create_tag(db: AsyncSession, payload: TagCreate) -> Tag:
    slug = await _unique_slug(db, _slugify(payload.name))
    tag = Tag(
        name=payload.name,
        slug=slug,
        color=payload.color,
        is_active=payload.is_active,
        sort_order=payload.sort_order,
    )
    db.add(tag)
    await db.flush()
    await db.refresh(tag)
    return tag


async def update_tag(db: AsyncSession, tag: Tag, payload: TagUpdate) -> Tag:
    data = payload.model_dump(exclude_unset=True)
    if data.get("name") is not None:
        new_slug = _slugify(data["name"])
        if new_slug != tag.slug:
            data["slug"] = await _unique_slug(db, new_slug, exclude_id=tag.id)
    for field, value in data.items():
        setattr(tag, field, value)
    await db.flush()
    await db.refresh(tag)
    return tag


async def delete_tag(db: AsyncSession, tag: Tag) -> None:
    await db.delete(tag)
    await db.flush()