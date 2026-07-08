
from loguru import logger
import httpx
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified
from sqlalchemy.orm import selectinload

from app.core.config import settings
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
from app.schemas.order import DirectCheckoutItem

from app.services.cart_service import resolve_variant_details


async def _create_razorpay_order(order: Order, email: str, full_name: str, phone: str) -> dict:
    amount_paise = int(round(order.total_amount * 100))
    data = {
        "key_id": settings.RAZORPAY_KEY_ID,
        "order_id": None,
        "amount": amount_paise,
        "currency": "INR",
        "name": settings.APP_NAME,
        "description": f"Plantoga order #{order.id}",
        "prefill": {"name": full_name, "email": email, "contact": phone or ""},
        "notes": {"order_id": str(order.id), "source": "direct_checkout"},
    }
    if not settings.RAZORPAY_KEY_ID or not settings.RAZORPAY_KEY_SECRET:
        logger.warning("Razorpay credentials missing; returning local checkout metadata for order_id={}", order.id)
        return data

    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.post(
            "https://api.razorpay.com/v1/orders",
            auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET),
            json={
                "amount": amount_paise,
                "currency": "INR",
                "receipt": f"plantoga-{order.id}",
                "notes": data["notes"],
            },
        )
        response.raise_for_status()
        razorpay_order = response.json()
    data["order_id"] = razorpay_order.get("id")
    return data


async def _reserve_product_for_order(
    db: AsyncSession,
    product_id: int,
    quantity: int,
    selected_options: dict | None,
) -> dict:
    product_result = await db.execute(
        select(Product).where(Product.id == product_id).with_for_update()
    )
    product = product_result.scalar_one_or_none()
    if not product or not product.is_active:
        raise ValueError(f"Product '{product_id}' is unavailable")

    details = resolve_variant_details(
        product, selected_options, quantity, validate_stock=True,
    )
    combo_key = details["combo_key"]
    if combo_key:
        variants = product.variants or {}
        variants["stock"][combo_key] = int(variants["stock"].get(combo_key, 0)) - quantity
        product.variants = variants
        product.stock_qty = sum(int(v or 0) for v in variants.get("stock", {}).values())
        flag_modified(product, "variants")
    else:
        if product.stock_qty < quantity:
            raise ValueError(
                f"Insufficient stock for '{product.name}': requested {quantity}, available {product.stock_qty}"
            )
        product.stock_qty -= quantity

    return {
        "product_id": product.id,
        "quantity": quantity,
        "unit_price": details["unit_price"],
        "selected_options": details["selected_options"],
        "resolved_image_url": details["resolved_image_url"],
    }


async def checkout(
    db: AsyncSession, user_id: int, address_id: int, cart_id: int,
    email: str, full_name: str, phone: str,
) -> tuple[Order, dict]:
    """
    1. Validate cart + stock
    2. Create order & order items (snapshot prices)
    3. Decrement stock with row-level locking
    4. Clear cart
    5. Create Razorpay order
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
        item_data = await _reserve_product_for_order(
            db, ci.product_id, ci.quantity, ci.selected_options,
        )
        line = round(item_data["unit_price"] * item_data["quantity"], 2)
        total_amount += line
        order_items_data.append(item_data)

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

    razorpay_data = await _create_razorpay_order(order, email, full_name, phone)

    logger.info("Checkout complete: order_id={} amount={}", order.id, total_amount)
    return order, razorpay_data


async def direct_checkout(
    db: AsyncSession, user_id: int, address_id: int, items: list[DirectCheckoutItem],
    email: str, full_name: str, phone: str,
) -> tuple[Order, dict]:
    address = await db.execute(
        select(Address).where(Address.id == address_id, Address.user_id == user_id)
    )
    address = address.scalar_one_or_none()
    if not address:
        raise ValueError("Address not found")
    if not items:
        raise ValueError("Checkout session is empty")

    total_amount = 0.0
    order_items_data: list[dict] = []
    for item in items:
        item_data = await _reserve_product_for_order(
            db, item.product_id, item.quantity, item.selected_options,
        )
        total_amount += round(item_data["unit_price"] * item_data["quantity"], 2)
        order_items_data.append(item_data)

    order = Order(
        user_id=user_id,
        status=OrderStatus.PENDING,
        total_amount=round(total_amount, 2),
        payment_status=PaymentStatus.PENDING,
        address_id=address_id,
    )
    db.add(order)
    await db.flush()

    for oi_data in order_items_data:
        db.add(OrderItem(order_id=order.id, **oi_data))
    await db.flush()

    razorpay_data = await _create_razorpay_order(order, email, full_name, phone)
    logger.info("Direct checkout complete: order_id={} amount={}", order.id, order.total_amount)
    return order, razorpay_data


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
    """Mark order as paid from Razorpay webhook."""
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
