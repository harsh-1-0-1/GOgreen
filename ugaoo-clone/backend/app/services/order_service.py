import math

from loguru import logger
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models import (
    Address,
    Cart,
    CartItem,
    Order,
    OrderItem,
    OrderStatus,
    PaymentStatus,
    Product,
)
from app.services.payu import get_payu_form_data


async def checkout(
    db: AsyncSession, user_id: int, address_id: int, cart_id: int,
    email: str, full_name: str, phone: str,
) -> tuple[Order, dict]:
    """
    1. Validate cart + stock
    2. Create order & order items (snapshot prices)
    3. Decrement stock with row-level locking
    4. Clear cart
    5. Generate PayU form data
    """
    address = await db.execute(
        select(Address).where(Address.id == address_id, Address.user_id == user_id)
    )
    address = address.scalar_one_or_none()
    if not address:
        raise ValueError("Address not found")

    cart_result = await db.execute(
        select(Cart).where(Cart.id == cart_id, Cart.user_id == user_id)
        .options(selectinload(Cart.items).selectinload(CartItem.product))
    )
    cart = cart_result.scalar_one_or_none()
    if not cart or not cart.items:
        raise ValueError("Cart is empty or not found")

    total_amount = 0.0
    order_items_data: list[dict] = []

    for ci in cart.items:
        # Row-level lock: SELECT ... FOR UPDATE
        # SQLite doesn't support FOR UPDATE, so we use a normal select + flush
        product_result = await db.execute(
            select(Product).where(Product.id == ci.product_id).with_for_update()
        )
        product = product_result.scalar_one_or_none()
        if not product or not product.is_active:
            raise ValueError(f"Product '{ci.product_id}' is unavailable")
        if product.stock_qty < ci.quantity:
            raise ValueError(
                f"Insufficient stock for '{product.name}': "
                f"requested {ci.quantity}, available {product.stock_qty}"
            )
        product.stock_qty -= ci.quantity
        line = round(product.price * ci.quantity, 2)
        total_amount += line
        order_items_data.append({
            "product_id": product.id,
            "quantity": ci.quantity,
            "unit_price": product.price,
        })

    total_amount = round(total_amount, 2)

    order = Order(
        user_id=user_id,
        status=OrderStatus.PENDING,
        total_amount=total_amount,
        payment_status=PaymentStatus.PENDING,
        address_id=address_id,
    )
    db.add(order)
    await db.flush()

    for oi_data in order_items_data:
        db.add(OrderItem(order_id=order.id, **oi_data))
    await db.flush()

    for ci in list(cart.items):
        await db.delete(ci)
    await db.flush()

    payu_data = get_payu_form_data(
        order_id=order.id,
        amount=total_amount,
        firstname=full_name,
        email=email,
        phone=phone or "",
    )

    logger.info("Checkout complete: order_id={} amount={}", order.id, total_amount)
    return order, payu_data


async def list_orders(
    db: AsyncSession, user_id: int, page: int = 1, limit: int = 20,
) -> tuple[list[Order], int]:
    count_q = select(func.count()).select_from(Order).where(Order.user_id == user_id)
    total = (await db.execute(count_q)).scalar() or 0
    offset = (page - 1) * limit
    result = await db.execute(
        select(Order).where(Order.user_id == user_id)
        .options(selectinload(Order.items))
        .order_by(Order.created_at.desc())
        .offset(offset).limit(limit)
    )
    return list(result.scalars().all()), total


async def get_order(db: AsyncSession, order_id: int, user_id: int) -> Order | None:
    result = await db.execute(
        select(Order).where(Order.id == order_id, Order.user_id == user_id)
        .options(selectinload(Order.items).selectinload(OrderItem.product))
    )
    return result.scalar_one_or_none()


async def mark_paid(db: AsyncSession, order_id: int, payment_id: str) -> Order | None:
    """Mark order as paid from PayU webhook."""
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        return None
    order.payment_status = PaymentStatus.PAID
    order.status = OrderStatus.CONFIRMED
    order.payment_id = payment_id
    await db.flush()
    logger.info("Order {} marked PAID, payment_id={}", order_id, payment_id)
    return order


async def mark_failed(db: AsyncSession, order_id: int) -> Order | None:
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        return None
    order.payment_status = PaymentStatus.FAILED
    order.status = OrderStatus.CANCELLED
    await db.flush()
    logger.info("Order {} marked FAILED", order_id)
    return order
