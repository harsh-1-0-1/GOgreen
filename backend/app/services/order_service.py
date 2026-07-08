
import httpx
from loguru import logger
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy.orm.attributes import flag_modified

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
    Refund,
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
        # Atomic SQL update for simple products
        update_stmt = (
            update(Product)
            .where(Product.id == product_id, Product.stock_qty >= quantity)
            .values(stock_qty=Product.stock_qty - quantity)
        )
        res = await db.execute(update_stmt)
        if res.rowcount == 0:
            raise ValueError(
                f"Insufficient stock for '{product.name}': requested {quantity}"
            )
        # Refresh ORM object from DB to sync with the atomic SQL update.
        # Manually adjusting the attribute would use a stale base value,
        # causing SQLAlchemy to overwrite the correct DB value on next flush.
        await db.refresh(product, ["stock_qty"])

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

    # Sort by product_id to guarantee a consistent lock-acquisition order across
    # concurrent checkouts and prevent deadlocks on the FOR UPDATE rows.
    for ci in sorted(cart.items, key=lambda ci: ci.product_id):
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

    try:
        razorpay_data = await _create_razorpay_order(order, email, full_name, phone)
    except Exception as e:
        logger.error("Razorpay order creation failed during checkout for order {}: {}", order.id, e)
        await db.rollback()
        raise ValueError(f"Failed to initialize payment gateway: {str(e)}")

    order.razorpay_order_id = razorpay_data.get("order_id")
    await db.flush()

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

    # Sort by product_id to guarantee a consistent lock-acquisition order across
    # concurrent checkouts and prevent deadlocks on the FOR UPDATE rows.
    for item in sorted(items, key=lambda i: i.product_id):
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

    try:
        razorpay_data = await _create_razorpay_order(order, email, full_name, phone)
    except Exception as e:
        logger.error("Razorpay order creation failed during direct checkout for order {}: {}", order.id, e)
        await db.rollback()
        raise ValueError(f"Failed to initialize payment gateway: {str(e)}")

    order.razorpay_order_id = razorpay_data.get("order_id")
    await db.flush()

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


async def mark_paid(db: AsyncSession, order_id: int, payment_id: str, amount_paid_paise: int) -> Order | None:
    """Mark order as paid from Razorpay webhook, with amount verification and idempotency."""
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        return None

    if order.payment_status == PaymentStatus.PAID:
        logger.info("Idempotency guard: Order {} is already PAID. Ignoring.", order_id)
        return order

    expected_paise = int(round(order.total_amount * 100))
    if amount_paid_paise != expected_paise:
        logger.critical(
            "Amount mismatch for order_id={}. Expected: {} paise, Received: {} paise. Flagging for manual review.",
            order_id, expected_paise, amount_paid_paise
        )
        return order

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

    if order.status == OrderStatus.CANCELLED:
        return order

    order.payment_status = PaymentStatus.FAILED
    order.status = OrderStatus.CANCELLED
    await db.flush()
    logger.info("Order {} marked FAILED", order_id)
    return order


async def record_refund(
    db: AsyncSession,
    order_id: int,
    refund_id: str,
    refund_amount_paise: int,
) -> Order | None:
    """
    Record a (potentially partial) refund for an order.
    - Creates a Refund row for every individual refund event.
    - Accumulates partial_refund_amount on the Order.
    - Sets payment_status to PARTIALLY_REFUNDED or REFUNDED based on total.
    """
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        return None

    # Idempotency: skip if this exact Razorpay refund_id was already recorded
    existing = await db.execute(select(Refund).where(Refund.razorpay_refund_id == refund_id))
    if existing.scalar_one_or_none():
        logger.info("Refund {} already recorded for order {}. Ignoring.", refund_id, order_id)
        return order

    refund_amount_rupees = refund_amount_paise / 100.0

    # Prevent total refunded amount from exceeding order total_amount
    remaining_refundable = round(order.total_amount - (order.partial_refund_amount or 0.0), 2)
    if remaining_refundable <= 0:
        logger.warning(
            "Order {} is already fully refunded. Ignoring new refund {} of ₹{}.",
            order_id, refund_id, refund_amount_rupees
        )
        return order

    actual_refund_amount = min(refund_amount_rupees, remaining_refundable)

    # Insert the individual refund record
    db.add(Refund(
        order_id=order_id,
        razorpay_refund_id=refund_id,
        amount=actual_refund_amount,
    ))

    # Accumulate the running total on the order
    order.partial_refund_amount = round(
        (order.partial_refund_amount or 0.0) + actual_refund_amount, 2
    )

    # Determine the correct status
    if order.partial_refund_amount >= order.total_amount:
        order.payment_status = PaymentStatus.REFUNDED
        logger.info(
            "Order {} fully refunded. Total refunded: {}",
            order_id, order.partial_refund_amount
        )
    else:
        order.payment_status = PaymentStatus.PARTIALLY_REFUNDED
        logger.info(
            "Order {} partially refunded. Refunded so far: {} / {}",
            order_id, order.partial_refund_amount, order.total_amount
        )

    await db.flush()
    return order
