from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Coupon, CouponType
from app.schemas.coupon import CouponCreate, CouponUpdate, CouponValidationResult


class CouponError(ValueError):
    pass


def calculate_discount(coupon: Coupon, subtotal: float) -> float:
    if coupon.type == CouponType.FIXED:
        return round(min(float(coupon.value), subtotal), 2)
    return round(min(subtotal * float(coupon.value) / 100.0, subtotal), 2)


async def validate_coupon(
    db: AsyncSession, code: str, subtotal: float,
) -> CouponValidationResult:
    normalized = code.strip().upper()
    if not normalized:
        raise CouponError("Please enter a coupon code")

    result = await db.execute(select(Coupon).where(Coupon.code == normalized))
    coupon = result.scalar_one_or_none()
    if not coupon:
        raise CouponError("Invalid coupon code")
    if not coupon.is_active:
        raise CouponError("This coupon is no longer active")
    if subtotal < float(coupon.min_amount):
        raise CouponError(
            f"This coupon requires a minimum order of ₹{float(coupon.min_amount):g}"
        )

    discount = calculate_discount(coupon, subtotal)
    if discount <= 0:
        raise CouponError("This coupon does not apply to the current order")

    return CouponValidationResult(
        code=coupon.code,
        type=coupon.type.value,
        value=float(coupon.value),
        min_amount=float(coupon.min_amount),
        discount_amount=discount,
        message=f"Coupon applied! You saved ₹{discount:g}",
    )


async def apply_coupon_to_order(
    db: AsyncSession, code: str, subtotal: float,
) -> tuple[str, float]:
    """Validate a coupon and mark it used. Returns (coupon_code, discount_amount)."""
    result = await db.execute(
        select(Coupon).where(Coupon.code == code.strip().upper()).with_for_update()
    )
    coupon = result.scalar_one_or_none()
    if not coupon:
        raise CouponError("Invalid coupon code")
    if not coupon.is_active:
        raise CouponError("This coupon is no longer active")
    if subtotal < float(coupon.min_amount):
        raise CouponError(
            f"This coupon requires a minimum order of ₹{float(coupon.min_amount):g}"
        )

    discount = calculate_discount(coupon, subtotal)
    if discount <= 0:
        raise CouponError("This coupon does not apply to the current order")

    coupon.times_used += 1
    await db.flush()
    return coupon.code, discount


async def list_coupons(db: AsyncSession) -> list[Coupon]:
    result = await db.execute(select(Coupon).order_by(Coupon.created_at.desc(), Coupon.id.desc()))
    return list(result.scalars().all())


async def create_coupon(db: AsyncSession, data: CouponCreate) -> Coupon:
    normalized = data.code.strip().upper()
    existing = await db.execute(select(Coupon).where(Coupon.code == normalized))
    if existing.scalar_one_or_none():
        raise CouponError(f"A coupon with code '{normalized}' already exists")

    coupon = Coupon(
        code=normalized,
        type=CouponType(data.type),
        value=data.value,
        min_amount=data.min_amount,
        is_active=data.is_active,
        times_used=0,
    )
    db.add(coupon)
    await db.flush()
    await db.refresh(coupon)
    return coupon


async def update_coupon(db: AsyncSession, coupon_id: int, data: CouponUpdate) -> Coupon:
    result = await db.execute(select(Coupon).where(Coupon.id == coupon_id))
    coupon = result.scalar_one_or_none()
    if not coupon:
        raise CouponError("Coupon not found")

    patch = data.model_dump(exclude_unset=True)
    if "code" in patch:
        normalized = patch["code"].strip().upper()
        conflict = await db.execute(
            select(Coupon).where(Coupon.code == normalized, Coupon.id != coupon_id)
        )
        if conflict.scalar_one_or_none():
            raise CouponError(f"A coupon with code '{normalized}' already exists")
        coupon.code = normalized
        patch.pop("code")
    for field, value in patch.items():
        if field == "type":
            setattr(coupon, field, CouponType(value))
        else:
            setattr(coupon, field, value)
    await db.flush()
    await db.refresh(coupon)
    return coupon


async def delete_coupon(db: AsyncSession, coupon_id: int) -> None:
    result = await db.execute(select(Coupon).where(Coupon.id == coupon_id))
    coupon = result.scalar_one_or_none()
    if not coupon:
        raise CouponError("Coupon not found")
    await db.delete(coupon)
    await db.flush()


async def coupon_usage_count(db: AsyncSession) -> int:
    return (await db.execute(select(func.count()).select_from(Coupon))).scalar() or 0
