from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import require_admin
from app.db.session import get_db
from app.schemas.settings import ShippingSettingsOut, StoreSettingsOut, StoreSettingsUpdate
from app.services.settings_service import get_or_create_settings

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("/shipping", response_model=ShippingSettingsOut)
async def get_shipping_settings(
    db: AsyncSession = Depends(get_db),
):
    return await get_or_create_settings(db)


@router.get("", response_model=StoreSettingsOut)
async def get_settings(
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    return await get_or_create_settings(db)


@router.patch("", response_model=StoreSettingsOut)
async def update_settings(
    body: StoreSettingsUpdate,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    row = await get_or_create_settings(db)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(row, field, value)
    await db.flush()
    await db.refresh(row)
    return row
