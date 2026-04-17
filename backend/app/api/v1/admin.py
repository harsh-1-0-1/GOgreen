import math

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import require_admin
from app.db.models import User
from app.db.session import get_db
from app.schemas.order import OrderResponse
from app.services import admin_service

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/stats")
async def get_stats(
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    return await admin_service.get_stats(db)


@router.get("/orders")
async def list_orders(
    status: str | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    orders, total = await admin_service.list_orders(db, status=status, page=page, limit=limit)
    pages = math.ceil(total / limit) if total else 0
    return {
        "items": [OrderResponse.model_validate(o) for o in orders],
        "total": total,
        "page": page,
        "pages": pages,
    }


@router.put("/orders/{order_id}/status")
async def update_order_status(
    order_id: int,
    body: dict,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    new_status = body.get("status")
    if not new_status:
        raise HTTPException(status_code=400, detail="status is required")
    order = await admin_service.update_order_status(db, order_id, new_status)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found or invalid status")
    return OrderResponse.model_validate(order)


@router.get("/users")
async def list_users(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    users, total = await admin_service.list_users(db, page=page, limit=limit)
    pages = math.ceil(total / limit) if total else 0
    return {
        "items": [
            {
                "id": u.id, "email": u.email, "full_name": u.full_name,
                "phone": u.phone, "is_active": u.is_active, "is_admin": u.is_admin,
                "created_at": u.created_at.isoformat() if u.created_at else None,
            }
            for u in users
        ],
        "total": total,
        "page": page,
        "pages": pages,
    }
