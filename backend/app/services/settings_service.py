from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import StoreSettings

SETTINGS_ID = 1
DEFAULT_FREE_SHIPPING_THRESHOLD = 999
DEFAULT_FLAT_SHIPPING_RATE = 75


async def get_or_create_settings(db: AsyncSession) -> StoreSettings:
    row = await db.get(StoreSettings, SETTINGS_ID)
    if row is None:
        row = StoreSettings(id=SETTINGS_ID)
        db.add(row)
        await db.flush()
        await db.refresh(row)
    return row


def calculate_shipping_fee(
    subtotal: float,
    free_shipping_threshold: int = DEFAULT_FREE_SHIPPING_THRESHOLD,
    flat_shipping_rate: int = DEFAULT_FLAT_SHIPPING_RATE,
) -> float:
    if subtotal >= free_shipping_threshold:
        return 0.0
    return round(max(0.0, float(flat_shipping_rate)), 2)
