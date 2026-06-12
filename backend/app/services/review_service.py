import math
import re
from datetime import datetime, timezone

from sqlalchemy import Select, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models import (
    Order,
    OrderItem,
    OrderStatus,
    PaymentStatus,
    Product,
    ProductReview,
    ReviewStatus,
    User,
)
from app.schemas.review import ReviewCreate
from app.utils.redis import cache_delete_pattern


def _clean(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = re.sub(r"\s+", " ", value).strip()
    return cleaned or None


def _display_name(name: str) -> str:
    parts = [p for p in name.strip().split() if p]
    if not parts:
        return "Plantoga customer"
    if len(parts) == 1:
        return parts[0]
    return f"{parts[0]} {parts[-1][0]}."


async def get_review_summary(db: AsyncSession, product_id: int) -> dict:
    rows = await db.execute(
        select(ProductReview.rating, func.count(ProductReview.id))
        .where(
            ProductReview.product_id == product_id,
            ProductReview.status == ReviewStatus.PUBLISHED,
        )
        .group_by(ProductReview.rating)
    )
    counts = {star: 0 for star in range(1, 6)}
    for rating, count in rows.all():
        counts[int(rating)] = int(count)
    total = sum(counts.values())
    weighted = sum(star * count for star, count in counts.items())
    avg = round(weighted / total, 1) if total else 0.0
    return {"average_rating": avg, "review_count": total, "rating_counts": counts}


async def list_reviews(
    db: AsyncSession,
    product_id: int,
    *,
    page: int = 1,
    limit: int = 10,
    sort_by: str = "top",
    rating: int | None = None,
) -> tuple[list[ProductReview], dict, int, int]:
    query: Select = (
        select(ProductReview)
        .where(
            ProductReview.product_id == product_id,
            ProductReview.status == ReviewStatus.PUBLISHED,
        )
        .options(selectinload(ProductReview.user))
    )
    count_q = (
        select(func.count())
        .select_from(ProductReview)
        .where(
            ProductReview.product_id == product_id,
            ProductReview.status == ReviewStatus.PUBLISHED,
        )
    )
    if rating is not None:
        query = query.where(ProductReview.rating == rating)
        count_q = count_q.where(ProductReview.rating == rating)

    match sort_by:
        case "newest":
            query = query.order_by(ProductReview.created_at.desc())
        case "highest":
            query = query.order_by(ProductReview.rating.desc(), ProductReview.created_at.desc())
        case "lowest":
            query = query.order_by(ProductReview.rating.asc(), ProductReview.created_at.desc())
        case _:
            query = query.order_by(
                desc(ProductReview.is_verified_purchase),
                ProductReview.helpful_count.desc(),
                ProductReview.created_at.desc(),
            )

    total = (await db.execute(count_q)).scalar() or 0
    pages = max(1, math.ceil(total / limit))
    result = await db.execute(query.offset((page - 1) * limit).limit(limit))
    summary = await get_review_summary(db, product_id)
    return list(result.scalars().all()), summary, total, pages


async def user_has_verified_purchase(db: AsyncSession, user_id: int, product_id: int) -> bool:
    result = await db.execute(
        select(OrderItem.id)
        .join(Order, Order.id == OrderItem.order_id)
        .where(
            Order.user_id == user_id,
            OrderItem.product_id == product_id,
            Order.payment_status == PaymentStatus.PAID,
            Order.status.in_([OrderStatus.CONFIRMED, OrderStatus.SHIPPED, OrderStatus.DELIVERED]),
        )
        .limit(1)
    )
    return result.scalar_one_or_none() is not None


async def create_or_update_review(
    db: AsyncSession,
    product_id: int,
    user: User,
    payload: ReviewCreate,
) -> ProductReview:
    product = (await db.execute(select(Product).where(Product.id == product_id, Product.is_active == True))).scalar_one_or_none()  # noqa: E712
    if not product:
        raise ValueError("Product not found")

    existing = (
        await db.execute(
            select(ProductReview).where(
                ProductReview.product_id == product_id,
                ProductReview.user_id == user.id,
            )
        )
    ).scalar_one_or_none()
    is_verified = await user_has_verified_purchase(db, user.id, product_id)

    if existing:
        existing.rating = payload.rating
        existing.title = _clean(payload.title)
        existing.body = _clean(payload.body)
        existing.status = ReviewStatus.PUBLISHED
        existing.is_verified_purchase = is_verified
        existing.updated_at = datetime.now(timezone.utc)
        existing.user = user
        review = existing
    else:
        review = ProductReview(
            product_id=product_id,
            user_id=user.id,
            rating=payload.rating,
            title=_clean(payload.title),
            body=_clean(payload.body),
            status=ReviewStatus.PUBLISHED,
            is_verified_purchase=is_verified,
        )
        review.user = user
        db.add(review)

    await db.flush()
    await db.refresh(review)
    await cache_delete_pattern("products:*")
    await cache_delete_pattern(f"product:{product.slug}")
    return review


async def mark_helpful(db: AsyncSession, review_id: int, user: User) -> ProductReview:
    review = (
        await db.execute(
            select(ProductReview)
            .where(ProductReview.id == review_id)
            .options(selectinload(ProductReview.user))
        )
    ).scalar_one_or_none()
    if not review or review.status != ReviewStatus.PUBLISHED:
        raise ValueError("Review not found")
    if review.user_id == user.id:
        raise PermissionError("You cannot vote on your own review")
    review.helpful_count += 1
    await db.flush()
    await db.refresh(review)
    return review


def to_review_response(review: ProductReview) -> dict:
    return {
        "id": review.id,
        "product_id": review.product_id,
        "user_id": review.user_id,
        "author_name": _display_name(review.user.full_name),
        "rating": review.rating,
        "title": review.title,
        "body": review.body,
        "is_verified_purchase": review.is_verified_purchase,
        "helpful_count": review.helpful_count,
        "created_at": review.created_at,
        "updated_at": review.updated_at,
    }
