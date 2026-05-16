from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models import Cart, CartItem, Product
from app.schemas.cart import CartItemProduct, CartItemResponse, CartResponse


async def _load_cart(db: AsyncSession, cart: Cart) -> Cart:
    result = await db.execute(
        select(Cart)
        .where(Cart.id == cart.id)
        .options(selectinload(Cart.items).selectinload(CartItem.product))
        .execution_options(populate_existing=True)
    )
    return result.scalar_one()


async def get_or_create_cart(
    db: AsyncSession, *, user_id: int | None = None, session_id: str | None = None,
) -> Cart:
    if user_id:
        result = await db.execute(
            select(Cart).where(Cart.user_id == user_id)
            .options(selectinload(Cart.items).selectinload(CartItem.product))
        )
    elif session_id:
        result = await db.execute(
            select(Cart).where(Cart.session_id == session_id)
            .options(selectinload(Cart.items).selectinload(CartItem.product))
        )
    else:
        raise ValueError("Either user_id or session_id is required")

    cart = result.scalar_one_or_none()
    if not cart:
        cart = Cart(user_id=user_id, session_id=session_id)
        db.add(cart)
        await db.flush()
        cart = await _load_cart(db, cart)
    return cart


def build_cart_response(cart: Cart) -> CartResponse:
    items: list[CartItemResponse] = []
    for ci in cart.items:
        items.append(CartItemResponse(
            id=ci.id,
            product_id=ci.product_id,
            quantity=ci.quantity,
            product=CartItemProduct.model_validate(ci.product),
            line_total=round(ci.product.price * ci.quantity, 2),
        ))
    subtotal = round(sum(i.line_total for i in items), 2)
    return CartResponse(
        id=cart.id,
        user_id=cart.user_id,
        session_id=cart.session_id,
        items=items,
        item_count=sum(i.quantity for i in items),
        subtotal=subtotal,
    )


async def add_item(
    db: AsyncSession, cart: Cart, product_id: int, quantity: int,
) -> Cart:
    product = await db.get(Product, product_id)
    if not product or not product.is_active:
        raise ValueError("Product not found")
    if product.stock_qty < quantity:
        raise ValueError(f"Only {product.stock_qty} in stock")

    for item in cart.items:
        if item.product_id == product_id:
            new_qty = item.quantity + quantity
            if product.stock_qty < new_qty:
                raise ValueError(f"Only {product.stock_qty} in stock")
            item.quantity = new_qty
            await db.flush()
            return await _load_cart(db, cart)

    item = CartItem(cart_id=cart.id, product_id=product_id, quantity=quantity)
    cart.items.append(item)
    db.add(item)
    await db.flush()
    return await _load_cart(db, cart)


async def update_item(db: AsyncSession, cart: Cart, item_id: int, quantity: int) -> Cart:
    item = next((i for i in cart.items if i.id == item_id), None)
    if not item:
        raise ValueError("Cart item not found")

    if quantity == 0:
        cart.items.remove(item)
        await db.delete(item)
    else:
        product = await db.get(Product, item.product_id)
        if product and product.stock_qty < quantity:
            raise ValueError(f"Only {product.stock_qty} in stock")
        item.quantity = quantity

    await db.flush()
    return await _load_cart(db, cart)


async def remove_item(db: AsyncSession, cart: Cart, item_id: int) -> Cart:
    item = next((i for i in cart.items if i.id == item_id), None)
    if not item:
        raise ValueError("Cart item not found")
    cart.items.remove(item)
    await db.delete(item)
    await db.flush()
    return await _load_cart(db, cart)


async def merge_guest_cart(db: AsyncSession, user_id: int, session_id: str) -> Cart:
    """Merge guest cart into user cart. On conflict keep higher qty."""
    guest_result = await db.execute(
        select(Cart).where(Cart.session_id == session_id)
        .options(selectinload(Cart.items))
    )
    guest_cart = guest_result.scalar_one_or_none()

    user_cart = await get_or_create_cart(db, user_id=user_id)

    if not guest_cart or not guest_cart.items:
        return user_cart

    existing = {item.product_id: item for item in user_cart.items}

    for guest_item in guest_cart.items:
        if guest_item.product_id in existing:
            existing[guest_item.product_id].quantity = max(
                existing[guest_item.product_id].quantity, guest_item.quantity,
            )
        else:
            db.add(CartItem(
                cart_id=user_cart.id,
                product_id=guest_item.product_id,
                quantity=guest_item.quantity,
            ))

    await db.delete(guest_cart)
    await db.flush()
    logger.info("Merged guest cart session_id={} into user_id={}", session_id, user_id)
    return await _load_cart(db, user_cart)


async def clear_cart(db: AsyncSession, cart: Cart) -> None:
    for item in list(cart.items):
        await db.delete(item)
    await db.flush()
