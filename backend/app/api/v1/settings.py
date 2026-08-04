from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import require_admin
from app.db.models import StoreSettings
from app.db.session import get_db
from app.schemas.settings import StoreSettingsOut, StoreSettingsUpdate

router = APIRouter(prefix="/settings", tags=["settings"])

SETTINGS_ID = 1


async def _get_or_create(db: AsyncSession) -> StoreSettings:
    """Return the single settings row, creating it with defaults if absent."""
    row = await db.get(StoreSettings, SETTINGS_ID)
    if row is None:
        row = StoreSettings(id=SETTINGS_ID)
        db.add(row)
        await db.flush()
        await db.refresh(row)
    return row


@router.get("", response_model=StoreSettingsOut)
async def get_settings(
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    return await _get_or_create(db)


@router.patch("", response_model=StoreSettingsOut)
async def update_settings(
    body: StoreSettingsUpdate,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_admin),
):
    row = await _get_or_create(db)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(row, field, value)
    await db.flush()
    await db.refresh(row)
    return row
