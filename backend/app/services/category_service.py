import re

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Category, Product
from app.schemas.category import CategoryCreate, CategoryTree, CategoryUpdate


def _slugify(text: str) -> str:
    slug = text.lower().strip()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_]+", "-", slug)
    return re.sub(r"-+", "-", slug).strip("-")


async def get_all_categories(db: AsyncSession) -> list[Category]:
    result = await db.execute(
        select(Category)
        .where(Category.is_active == True)  # noqa: E712
        .order_by(Category.sort_order.asc(), Category.name.asc(), Category.id.asc())
    )
    return list(result.scalars().all())


async def get_all_categories_include_inactive(db: AsyncSession) -> list[Category]:
    result = await db.execute(
        select(Category).order_by(
            Category.parent_id.nulls_first(),
            Category.sort_order.asc(),
            Category.name.asc(),
            Category.id.asc(),
        )
    )
    return list(result.scalars().all())


def build_tree(categories: list[Category]) -> list[CategoryTree]:
    by_id: dict[int, CategoryTree] = {}
    for cat in categories:
        by_id[cat.id] = CategoryTree(
            id=cat.id,
            name=cat.name,
            slug=cat.slug,
            parent_id=cat.parent_id,
            image_url=cat.image_url,
            is_active=cat.is_active,
            sort_order=cat.sort_order,
            children=[],
        )

    roots: list[CategoryTree] = []
    for node in by_id.values():
        if node.parent_id and node.parent_id in by_id:
            by_id[node.parent_id].children.append(node)
        else:
            roots.append(node)
    return roots


async def get_category_by_slug(db: AsyncSession, slug: str) -> Category | None:
    result = await db.execute(select(Category).where(Category.slug == slug))
    return result.scalar_one_or_none()


async def get_category_by_id(db: AsyncSession, category_id: int) -> Category | None:
    result = await db.execute(select(Category).where(Category.id == category_id))
    return result.scalar_one_or_none()


async def create_category(
    db: AsyncSession, payload: CategoryCreate,
) -> Category:
    slug = _slugify(payload.name)
    existing = await db.execute(select(Category).where(Category.slug == slug))
    if existing.scalar_one_or_none():
        raise ValueError(f"Category with slug '{slug}' already exists")

    category = Category(
        name=payload.name,
        slug=slug,
        parent_id=payload.parent_id,
        image_url=payload.image_url,
        is_active=payload.is_active,
        sort_order=payload.sort_order,
    )
    db.add(category)
    await db.flush()
    await db.refresh(category)
    return category


async def update_category(
    db: AsyncSession, category: Category, payload: CategoryUpdate,
) -> Category:
    data = payload.model_dump(exclude_unset=True)
    if "name" in data:
        data["slug"] = _slugify(data["name"])
    for field, value in data.items():
        setattr(category, field, value)
    await db.flush()
    await db.refresh(category)
    return category


async def delete_category(db: AsyncSession, category: Category) -> None:
    product_count = (
        await db.execute(
            select(Product.id).where(Product.category_id == category.id).limit(1)
        )
    ).first()
    if product_count:
        raise ValueError("Cannot delete category with products attached")
    await db.delete(category)
    await db.flush()
