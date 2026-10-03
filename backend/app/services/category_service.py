import re

from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import (
    CartItem,
    Category,
    CategoryBadgeConfig,
    DoNotForgetProduct,
    OrderItem,
    Product,
    ProductReview,
    Story,
    product_categories,
)
from app.schemas.category import CategoryCreate, CategoryTree, CategoryUpdate
from app.services import badge_config_service
from app.utils.redis import cache_delete


def _slugify(text: str) -> str:
    slug = text.lower().strip()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_]+", "-", slug)
    return re.sub(r"-+", "-", slug).strip("-")


async def get_all_categories(db: AsyncSession) -> list[Category]:
    result = await db.execute(
        select(Category)
        .where(Category.is_active == True)  # noqa: E712
        .order_by(Category.sort_order.asc(), Category.id.asc())
    )
    return list(result.scalars().all())


async def get_all_categories_include_inactive(db: AsyncSession) -> list[Category]:
    result = await db.execute(
        select(Category).order_by(
            Category.parent_id.nulls_first(),
            Category.sort_order.asc(),
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
            mobile_image_url=cat.mobile_image_url,
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

    # Ensure every level is sorted by sort_order so the tree reflects the
    # admin-defined position rather than DB insertion / dict iteration order.
    def _sort(nodes: list[CategoryTree]) -> list[CategoryTree]:
        nodes.sort(key=lambda n: (n.sort_order, n.id))
        for n in nodes:
            if n.children:
                _sort(n.children)
        return nodes

    return _sort(roots)


async def get_category_by_slug(db: AsyncSession, slug: str) -> Category | None:
    result = await db.execute(select(Category).where(Category.slug == slug))
    return result.scalar_one_or_none()


async def get_category_by_id(db: AsyncSession, category_id: int) -> Category | None:
    result = await db.execute(select(Category).where(Category.id == category_id))
    return result.scalar_one_or_none()


async def create_category(
    db: AsyncSession,
    payload: CategoryCreate,
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
        mobile_image_url=payload.mobile_image_url,
        is_active=payload.is_active,
        sort_order=payload.sort_order,
    )
    db.add(category)
    await db.flush()
    await db.refresh(category)
    return category


async def update_category(
    db: AsyncSession,
    category: Category,
    payload: CategoryUpdate,
) -> Category:
    data = payload.model_dump(exclude_unset=True)
    if "name" in data:
        data["slug"] = _slugify(data["name"])
    for field, value in data.items():
        setattr(category, field, value)
    await db.flush()
    await db.refresh(category)
    return category


async def delete_category(db: AsyncSession, category: Category, force: bool = False) -> None:
    has_children = (await db.execute(select(Category.id).where(Category.parent_id == category.id).limit(1))).first()
    if has_children:
        raise ValueError("Cannot delete category with subcategories. Delete or move its subcategories first")

    # Products that sit in this category as an ADDITIONAL one only. They are not
    # this category's products and must survive — the link is simply dropped, the
    # same as removing a category from a product's picker. Runs before the delete
    # so the join table never holds a dangling row (SQLite does not enforce FKs).
    linked_ids = list(
        (
            await db.execute(
                select(product_categories.c.product_id).where(
                    product_categories.c.category_id == category.id
                )
            )
        )
        .scalars()
        .all()
    )

    result = await db.execute(select(Product.id, Product.name, Product.is_active).where(Product.category_id == category.id))
    products = result.all()

    product_ids = [product_id for product_id, _, _ in products]
    active = [product_id for product_id, _, is_active in products if is_active]

    if active:
        raise ValueError("Cannot delete category with active products attached")

    if linked_ids:
        await db.execute(
            delete(product_categories).where(
                product_categories.c.category_id == category.id
            )
        )

    if product_ids:
        # force=True only bypasses the order-history block. Active products are
        # always blocked above so live catalog items must be deactivated first.
        order_items_result = await db.execute(
            select(OrderItem.id).where(OrderItem.product_id.in_(product_ids)).limit(1)
        )
        if order_items_result.first():
            if not force:
                raise ValueError("Cannot delete category: products are linked to past orders")
            for p_id, p_name, _ in products:
                await db.execute(
                    update(OrderItem)
                    .where(OrderItem.product_id == p_id)
                    .values(product_id=None, product_name_snapshot=func.coalesce(OrderItem.product_name_snapshot, p_name))
                )

        # Stories - unlink product
        await db.execute(update(Story).where(Story.linked_product_id.in_(product_ids)).values(linked_product_id=None))

        # Cart items - delete rows
        await db.execute(delete(CartItem).where(CartItem.product_id.in_(product_ids)))

        # Do not forget products - delete rows
        await db.execute(delete(DoNotForgetProduct).where(DoNotForgetProduct.product_id.in_(product_ids)))

        # Product reviews - delete rows
        await db.execute(delete(ProductReview).where(ProductReview.product_id.in_(product_ids)))

        # Additional category links - delete rows
        await db.execute(delete(product_categories).where(product_categories.c.product_id.in_(product_ids)))

        # Finally delete products
        await db.execute(delete(Product).where(Product.category_id == category.id))
        await db.flush()

    # Badge config is 1:1 with the category and has nowhere to go once the
    # category is gone (SQLite does not enforce the CASCADE).
    await db.execute(delete(CategoryBadgeConfig).where(CategoryBadgeConfig.category_id == category.id))

    await db.delete(category)
    await db.flush()
    # The storefront caches the whole badge map, so a deleted category's entry
    # would otherwise linger until the TTL expired.
    await cache_delete(badge_config_service.CACHE_KEY)
