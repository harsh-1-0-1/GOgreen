import uuid

from fastapi import APIRouter, Cookie, Depends, Header, HTTPException, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_active_user, get_optional_user
from app.db.models import User
from app.db.session import get_db
from app.schemas.cart import (
    CartItemCreate,
    CartItemUpdate,
    CartMergeRequest,
    CartResponse,
)
from app.services import cart_service

router = APIRouter(prefix="/cart", tags=["cart"])

SESSION_COOKIE = "cart_session_id"
SESSION_HEADER = "X-Cart-Session-Id"
SESSION_MAX_AGE = 30 * 24 * 60 * 60  # 30 days


def _ensure_session_cookie(response: Response, session_id: str | None) -> str:
    if not session_id:
        session_id = str(uuid.uuid4())
    response.set_cookie(
        SESSION_COOKIE, session_id,
        max_age=SESSION_MAX_AGE, httponly=True, samesite="lax",
    )
    return session_id


def _resolve_guest_session(
    response: Response,
    cart_session_id: str | None,
    x_cart_session_id: str | None,
) -> str:
    return _ensure_session_cookie(response, cart_session_id or x_cart_session_id)


@router.get("", response_model=CartResponse)
async def get_cart(
    response: Response,
    cart_session_id: str | None = Cookie(default=None),
    x_cart_session_id: str | None = Header(default=None, alias=SESSION_HEADER),
    user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    if user:
        cart = await cart_service.get_or_create_cart(db, user_id=user.id)
    else:
        session_id = _resolve_guest_session(response, cart_session_id, x_cart_session_id)
        cart = await cart_service.get_or_create_cart(db, session_id=session_id)
    return cart_service.build_cart_response(cart)


@router.post("/items", response_model=CartResponse, status_code=201)
async def add_cart_item(
    body: CartItemCreate,
    response: Response,
    cart_session_id: str | None = Cookie(default=None),
    x_cart_session_id: str | None = Header(default=None, alias=SESSION_HEADER),
    user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    if user:
        cart = await cart_service.get_or_create_cart(db, user_id=user.id)
    else:
        session_id = _resolve_guest_session(response, cart_session_id, x_cart_session_id)
        cart = await cart_service.get_or_create_cart(db, session_id=session_id)

    try:
        cart = await cart_service.add_item(
            db, cart, body.product_id, body.quantity, body.selected_options,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return cart_service.build_cart_response(cart)


@router.put("/items/{item_id}", response_model=CartResponse)
async def update_cart_item(
    item_id: int,
    body: CartItemUpdate,
    response: Response,
    cart_session_id: str | None = Cookie(default=None),
    x_cart_session_id: str | None = Header(default=None, alias=SESSION_HEADER),
    user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    if user:
        cart = await cart_service.get_or_create_cart(db, user_id=user.id)
    else:
        session_id = _resolve_guest_session(response, cart_session_id, x_cart_session_id)
        cart = await cart_service.get_or_create_cart(db, session_id=session_id)

    try:
        cart = await cart_service.update_item(db, cart, item_id, body.quantity)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return cart_service.build_cart_response(cart)


@router.delete("/items/{item_id}", response_model=CartResponse)
async def delete_cart_item(
    item_id: int,
    response: Response,
    cart_session_id: str | None = Cookie(default=None),
    x_cart_session_id: str | None = Header(default=None, alias=SESSION_HEADER),
    user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    if user:
        cart = await cart_service.get_or_create_cart(db, user_id=user.id)
    else:
        session_id = _resolve_guest_session(response, cart_session_id, x_cart_session_id)
        cart = await cart_service.get_or_create_cart(db, session_id=session_id)

    try:
        cart = await cart_service.remove_item(db, cart, item_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return cart_service.build_cart_response(cart)


@router.post("/merge", response_model=CartResponse)
async def merge_carts(
    body: CartMergeRequest,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    cart = await cart_service.merge_guest_cart(db, user.id, body.session_id)
    return cart_service.build_cart_response(cart)
