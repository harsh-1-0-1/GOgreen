import json

from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models import Cart, CartItem, Product
from app.schemas.cart import CartItemProduct, CartItemResponse, CartResponse


OPTION_COLOR_KEY = "color"
OPTION_POT_KEY = "pot_type"


async def _load_cart(db: AsyncSession, cart: Cart) -> Cart:
    result = await db.execute(
        select(Cart)
        .where(Cart.id == cart.id)
        .options(selectinload(Cart.items).selectinload(CartItem.product))
        .execution_options(populate_existing=True)
    )
    return result.scalar_one()


def _has_variants(product: Product) -> bool:
    variants = product.variants or {}
    return bool(
        variants.get("colors")
        and variants.get("pot_types")
        and isinstance(variants.get("stock"), dict)
    )


def normalize_selected_options(options: dict | None) -> dict[str, str] | None:
    if not options:
        return None
    color = options.get(OPTION_COLOR_KEY) or options.get("color_slug")
    pot_type = options.get(OPTION_POT_KEY) or options.get("pot_slug")
    normalized: dict[str, str] = {}
    if color:
        normalized[OPTION_COLOR_KEY] = str(color)
    if pot_type:
        normalized[OPTION_POT_KEY] = str(pot_type)
    return normalized or None


def options_key(options: dict | None) -> str:
    return json.dumps(normalize_selected_options(options) or {}, sort_keys=True)


def combination_key(options: dict[str, str]) -> str:
    return f"{options[OPTION_COLOR_KEY]}__{options[OPTION_POT_KEY]}"


def _primary_image(product: Product) -> str:
    return (product.images or [None])[0] or "https://placehold.co/600x600?text=Plant"


def resolve_variant_details(
    product: Product,
    selected_options: dict | None,
    quantity: int | None = None,
    *,
    validate_stock: bool = False,
) -> dict:
    if not _has_variants(product):
        available_stock = product.stock_qty
        if validate_stock and quantity is not None and available_stock < quantity:
            raise ValueError(f"Only {available_stock} in stock")
        return {
            "selected_options": None,
            "unit_price": product.price,
            "resolved_image_url": _primary_image(product),
            "available_stock": available_stock,
            "combo_key": None,
        }

    variants = product.variants or {}
    normalized = normalize_selected_options(selected_options)
    if not normalized or OPTION_COLOR_KEY not in normalized or OPTION_POT_KEY not in normalized:
        raise ValueError("Please select a color and pot type")

    color_slugs = {c.get("slug") for c in variants.get("colors", [])}
    pot_types = variants.get("pot_types", [])
    pot_by_slug = {p.get("slug"): p for p in pot_types}
    if normalized[OPTION_COLOR_KEY] not in color_slugs:
        raise ValueError("Invalid color option")
    if normalized[OPTION_POT_KEY] not in pot_by_slug:
        raise ValueError("Invalid pot type option")

    combo = combination_key(normalized)
    stock = variants.get("stock", {})
    available_stock = int(stock.get(combo, 0) or 0)
    if validate_stock:
        if available_stock <= 0:
            raise ValueError("Selected configuration is out of stock")
        if quantity is not None and available_stock < quantity:
            raise ValueError(f"Only {available_stock} in stock for the selected configuration")

    price_modifier = float(pot_by_slug[normalized[OPTION_POT_KEY]].get("price_modifier", 0) or 0)
    image_map = variants.get("image_map", {}) or {}
    resolved_image = image_map.get(combo) or variants.get("default_image") or _primary_image(product)
    return {
        "selected_options": normalized,
        "unit_price": round(product.price + price_modifier, 2),
        "resolved_image_url": resolved_image,
        "available_stock": available_stock,
        "combo_key": combo,
    }


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
        details = resolve_variant_details(ci.product, ci.selected_options)
        unit_price = details["unit_price"]
        available_stock = details["available_stock"]
        items.append(CartItemResponse(
            id=ci.id,
            product_id=ci.product_id,
            quantity=ci.quantity,
            selected_options=details["selected_options"],
            product=CartItemProduct.model_validate(ci.product),
            line_total=round(unit_price * ci.quantity, 2),
            resolved_image_url=details["resolved_image_url"],
            unit_price=unit_price,
            available_stock=available_stock,
            stock_warning=ci.quantity > available_stock,
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
    selected_options: dict | None = None,
) -> Cart:
    product = await db.get(Product, product_id)
    if not product or not product.is_active:
        raise ValueError("Product not found")
    details = resolve_variant_details(
        product, selected_options, quantity, validate_stock=True,
    )
    normalized_options = details["selected_options"]
    desired_options_key = options_key(normalized_options)

    for item in cart.items:
        if item.product_id == product_id and options_key(item.selected_options) == desired_options_key:
            new_qty = item.quantity + quantity
            resolve_variant_details(
                product, normalized_options, new_qty, validate_stock=True,
            )
            item.quantity = new_qty
            await db.flush()
            return await _load_cart(db, cart)

    item = CartItem(
        cart_id=cart.id,
        product_id=product_id,
        quantity=quantity,
        selected_options=normalized_options,
    )
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
        if product:
            resolve_variant_details(
                product, item.selected_options, quantity, validate_stock=True,
            )
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

    existing = {
        (item.product_id, options_key(item.selected_options)): item
        for item in user_cart.items
    }

    for guest_item in guest_cart.items:
        key = (guest_item.product_id, options_key(guest_item.selected_options))
        if key in existing:
            existing[key].quantity = max(
                existing[key].quantity, guest_item.quantity,
            )
        else:
            db.add(CartItem(
                cart_id=user_cart.id,
                product_id=guest_item.product_id,
                quantity=guest_item.quantity,
                selected_options=normalize_selected_options(guest_item.selected_options),
            ))

    await db.delete(guest_cart)
    await db.flush()
    logger.info("Merged guest cart session_id={} into user_id={}", session_id, user_id)
    return await _load_cart(db, user_cart)


async def clear_cart(db: AsyncSession, cart: Cart) -> None:
    for item in list(cart.items):
        await db.delete(item)
    await db.flush()
