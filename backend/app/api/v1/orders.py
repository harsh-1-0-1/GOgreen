import math

from fastapi import APIRouter, Depends, HTTPException, Query
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_active_user
from app.db.models import User
from app.db.session import get_db
from app.schemas.order import CheckoutRequest, CheckoutResponse, DirectCheckoutRequest, OrderListResponse, OrderResponse
from app.services import email_service, order_service, whatsapp_service

router = APIRouter(prefix="/orders", tags=["orders"])


async def _send_cod_order_notifications(db: AsyncSession, order_id: int) -> None:
    try:
        await whatsapp_service.send_new_order_notification(db, order_id)
    except Exception as exc:
        logger.exception("COD WhatsApp notification failed for order {}: {}", order_id, exc)
    try:
        await email_service.send_order_emails(db, order_id)
    except Exception as exc:
        logger.exception("COD order email failed for order {}: {}", order_id, exc)


@router.post("/checkout", response_model=CheckoutResponse, status_code=201)
async def checkout(
    body: CheckoutRequest,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        order, razorpay_data = await order_service.checkout(
            db,
            user_id=user.id,
            address_id=body.address_id,
            cart_id=body.cart_id,
            email=user.email,
            full_name=user.full_name,
            phone=user.phone or "",
            payment_method=body.payment_method,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if body.payment_method == "cod":
        await db.commit()
        await _send_cod_order_notifications(db, order.id)
    return CheckoutResponse(order_id=order.id, razorpay_order_data=razorpay_data)


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
            payment_method=body.payment_method,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if body.payment_method == "cod":
        await db.commit()
        await _send_cod_order_notifications(db, order.id)
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
