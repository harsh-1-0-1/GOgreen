from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models import (
    DamageClaim,
    DamageClaimStatus,
    Order,
    OrderItem,
    OrderStatus,
    PaymentStatus,
    Product,
    User,
)


async def get_stats(db: AsyncSession) -> dict:
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    total_products = (await db.execute(
        select(func.count()).select_from(Product).where(Product.is_active == True)  # noqa: E712
    )).scalar() or 0

    total_orders = (await db.execute(
        select(func.count()).select_from(Order)
    )).scalar() or 0

    total_users = (await db.execute(
        select(func.count()).select_from(User)
    )).scalar() or 0

    revenue_today = (await db.execute(
        select(func.coalesce(func.sum(Order.total_amount), 0))
        .where(Order.payment_status == PaymentStatus.PAID)
        .where(Order.created_at >= today_start)
    )).scalar() or 0

    revenue_month = (await db.execute(
        select(func.coalesce(func.sum(Order.total_amount), 0))
        .where(Order.payment_status == PaymentStatus.PAID)
        .where(Order.created_at >= month_start)
    )).scalar() or 0

    status_counts_q = await db.execute(
        select(Order.status, func.count())
        .group_by(Order.status)
    )
    orders_by_status = {s.value: 0 for s in OrderStatus}
    for status, count in status_counts_q.all():
        orders_by_status[status.value if hasattr(status, "value") else status] = count

    open_damage_claims = (await db.execute(
        select(func.count()).select_from(DamageClaim).where(
            DamageClaim.status.notin_([
                DamageClaimStatus.CLOSED,
                DamageClaimStatus.REJECTED,
            ])
        )
    )).scalar() or 0

    return {
        "total_products": total_products,
        "total_orders": total_orders,
        "total_users": total_users,
        "revenue_today": round(float(revenue_today), 2),
        "revenue_month": round(float(revenue_month), 2),
        "orders_by_status": orders_by_status,
        "open_damage_claims": open_damage_claims,
    }


async def list_orders(
    db: AsyncSession,
    status: str | None = None,
    page: int = 1,
    limit: int = 20,
) -> tuple[list[Order], int]:
    q = select(Order)
    count_q = select(func.count()).select_from(Order)

    if status:
        try:
            os = OrderStatus(status)
        except ValueError:
            os = None
        if os:
            q = q.where(Order.status == os)
            count_q = count_q.where(Order.status == os)

    total = (await db.execute(count_q)).scalar() or 0
    offset = (page - 1) * limit
    result = await db.execute(
        q.options(
            selectinload(Order.items).selectinload(OrderItem.product),
            selectinload(Order.user),
            selectinload(Order.address),
        )
        .order_by(Order.created_at.desc())
        .offset(offset).limit(limit)
    )
    return list(result.scalars().all()), total


async def update_order_status(db: AsyncSession, order_id: int, status: str) -> Order | None:
    result = await db.execute(
        select(Order).where(Order.id == order_id)
        .options(
            selectinload(Order.items).selectinload(OrderItem.product),
            selectinload(Order.user),
            selectinload(Order.address),
        )
    )
    order = result.scalar_one_or_none()
    if not order:
        return None
    try:
        order.status = OrderStatus(status.lower())
    except ValueError:
        return None
    await db.flush()
    return order


async def list_users(
    db: AsyncSession, page: int = 1, limit: int = 20,
) -> tuple[list[User], int]:
    total = (await db.execute(
        select(func.count()).select_from(User)
    )).scalar() or 0
    offset = (page - 1) * limit
    result = await db.execute(
        select(User).order_by(User.created_at.desc())
        .offset(offset).limit(limit)
    )
    return list(result.scalars().all()), total
