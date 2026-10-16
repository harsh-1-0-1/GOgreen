from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_active_user
from app.db.models import User
from app.db.session import get_db
from app.schemas.coupon import CouponValidateRequest, CouponValidationResult
from app.services import coupon_service

router = APIRouter(prefix="/coupons", tags=["coupons"])


@router.post("/validate", response_model=CouponValidationResult)
async def validate_coupon(
    body: CouponValidateRequest,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await coupon_service.validate_coupon(db, body.code, body.subtotal)
    except coupon_service.CouponError as e:
        raise HTTPException(status_code=400, detail=str(e))
