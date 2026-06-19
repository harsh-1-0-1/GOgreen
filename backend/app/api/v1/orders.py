import math

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_active_user
from app.db.models import User
from app.db.session import get_db
from app.schemas.order import CheckoutRequest, CheckoutResponse, DirectCheckoutRequest, OrderListResponse, OrderResponse
from app.services import order_service

router = APIRouter(prefix="/orders", tags=["orders"])


@router.post("/checkout", response_model=CheckoutResponse, status_code=201)
async def checkout(
    body: CheckoutRequest,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        order, payu_data = await order_service.checkout(
            db,
            user_id=user.id,
            address_id=body.address_id,
            cart_id=body.cart_id,
            email=user.email,
            full_name=user.full_name,
            phone=user.phone or "",
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return CheckoutResponse(order_id=order.id, payu_form_data=payu_data)


@router.post("/direct-checkout", response_model=CheckoutResponse, status_code=201)
async def direct_checkout(
    body: DirectCheckoutRequest,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        order, razorpay_data = await order_service.direct_checkout(
            db,
            user_id=user.id,
            address_id=body.address_id,
            items=body.items,
            email=user.email,
            full_name=user.full_name,
            phone=user.phone or "",
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return CheckoutResponse(order_id=order.id, razorpay_order_data=razorpay_data)


@router.get("", response_model=OrderListResponse)
async def list_orders(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    orders, total = await order_service.list_orders(db, user.id, page, limit)
    pages = math.ceil(total / limit) if total else 0
    return OrderListResponse(
        items=[OrderResponse.model_validate(o) for o in orders],
        total=total, page=page, pages=pages,
    )


@router.get("/{order_id}", response_model=OrderResponse)
async def get_order(
    order_id: int,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    order = await order_service.get_order(db, order_id, user.id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return OrderResponse.model_validate(order)
