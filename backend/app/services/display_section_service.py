import re

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import DisplaySection, Product
from app.schemas.display_section import DisplaySectionCreate, DisplaySectionUpdate


def _key_base(name: str) -> str:
    key = re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")
    return key[:50] or "section"


async def _next_key(db: AsyncSession, name: str) -> str:
    base = _key_base(name)
    result = await db.execute(select(DisplaySection.key))
    existing = set(result.scalars().all())
    if base not in existing:
        return base

    suffix = 2
    while True:
        suffix_text = str(suffix)
        prefix = base[: 50 - len(suffix_text) - 1]
        candidate = f"{prefix}_{suffix_text}"
        if candidate not in existing:
            return candidate
        suffix += 1


async def _assert_unique_name(
    db: AsyncSession,
    name: str,
    exclude_id: int | None = None,
) -> None:
    statement = select(DisplaySection.id).where(func.lower(DisplaySection.name) == name.lower())
    if exclude_id is not None:
        statement = statement.where(DisplaySection.id != exclude_id)
    if (await db.execute(statement)).scalar_one_or_none() is not None:
        raise ValueError(f"A display section named '{name}' already exists")


async def list_display_sections(db: AsyncSession) -> list[DisplaySection]:
    result = await db.execute(
        select(DisplaySection).order_by(DisplaySection.sort_order.asc(), DisplaySection.id.asc())
    )
    return list(result.scalars().all())


async def list_display_sections_with_counts(
    db: AsyncSession,
) -> list[tuple[DisplaySection, int]]:
    counts = (
        select(
            Product.display_section.label("display_section"),
            func.count(Product.id).label("product_count"),
        )
        .where(Product.display_section.is_not(None))
        .group_by(Product.display_section)
        .subquery()
    )
    result = await db.execute(
        select(DisplaySection, func.coalesce(counts.c.product_count, 0))
        .outerjoin(counts, counts.c.display_section == DisplaySection.key)
        .order_by(DisplaySection.sort_order.asc(), DisplaySection.id.asc())
    )
    return [(section, count) for section, count in result.all()]


async def get_display_section(db: AsyncSession, section_id: int) -> DisplaySection | None:
    return await db.get(DisplaySection, section_id)


async def create_display_section(
    db: AsyncSession,
    payload: DisplaySectionCreate,
) -> DisplaySection:
    name = payload.name
    await _assert_unique_name(db, name)
    key = await _next_key(db, name)
    current_max = await db.scalar(select(func.max(DisplaySection.sort_order)))
    sort_order = (current_max if current_max is not None else -1) + 1

    section = DisplaySection(name=name, key=key, sort_order=sort_order)
    db.add(section)
    await db.flush()
    await db.refresh(section)
    return section


async def set_display_section_active(
    db: AsyncSession,
    section: DisplaySection,
    is_active: bool,
) -> DisplaySection:
    section.is_active = is_active
    await db.flush()
    await db.refresh(section)
    return section


async def update_display_section(
    db: AsyncSession,
    section: DisplaySection,
    payload: DisplaySectionUpdate,
) -> DisplaySection:
    data = payload.model_dump(exclude_unset=True)
    if "name" in data:
        name = data["name"]
        if not isinstance(name, str):
            raise ValueError("Section name is required")
        await _assert_unique_name(db, name, exclude_id=section.id)
        section.name = name

    await db.flush()
    await db.refresh(section)
    return section


async def delete_display_section(db: AsyncSession, section: DisplaySection) -> None:
    if section.is_system:
        raise ValueError(
            f"'{section.name}' is a system section and cannot be deleted. "
            "Hide it or rename it instead."
        )

    product_count = await db.scalar(
        select(func.count(Product.id)).where(Product.display_section == section.key)
    )
    if product_count:
        raise ValueError(
            f"Cannot delete '{section.name}' because {product_count} product(s) use this section"
        )

    await db.delete(section)
    await db.flush()


async def reorder_display_sections(
    db: AsyncSession,
    items: list[tuple[int, int]],
) -> None:
    ids = [section_id for section_id, _ in items]
    if len(ids) != len(set(ids)):
        raise ValueError("Each display section can appear only once")

    positions = [position for _, position in items]
    if len(positions) != len(set(positions)):
        raise ValueError("Each display section must have a unique position")

    result = await db.execute(select(DisplaySection))
    sections = {section.id: section for section in result.scalars().all()}
    requested_ids = set(ids)
    existing_ids = set(sections)
    if requested_ids != existing_ids:
        missing = sorted(existing_ids - requested_ids)
        unknown = sorted(requested_ids - existing_ids)
        details = []
        if missing:
            details.append(f"missing section ids: {missing}")
        if unknown:
            details.append(f"unknown section ids: {unknown}")
        raise ValueError("The section list is stale; " + ", ".join(details))

    for section_id, position in items:
        sections[section_id].sort_order = position

    await db.flush()
