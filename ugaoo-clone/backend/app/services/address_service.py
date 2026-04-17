from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Address
from app.schemas.address import AddressCreate, AddressUpdate


async def list_addresses(db: AsyncSession, user_id: int) -> list[Address]:
    result = await db.execute(
        select(Address).where(Address.user_id == user_id).order_by(Address.is_default.desc(), Address.id)
    )
    return list(result.scalars().all())


async def get_address(db: AsyncSession, address_id: int, user_id: int) -> Address | None:
    result = await db.execute(
        select(Address).where(Address.id == address_id, Address.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def create_address(db: AsyncSession, user_id: int, data: AddressCreate) -> Address:
    if data.is_default:
        await db.execute(
            update(Address).where(Address.user_id == user_id).values(is_default=False)
        )
    addr = Address(user_id=user_id, **data.model_dump())
    db.add(addr)
    await db.flush()
    await db.refresh(addr)
    return addr


async def update_address(
    db: AsyncSession, address_id: int, user_id: int, data: AddressUpdate,
) -> Address | None:
    addr = await get_address(db, address_id, user_id)
    if not addr:
        return None
    updates = data.model_dump(exclude_unset=True)
    if updates.get("is_default"):
        await db.execute(
            update(Address).where(Address.user_id == user_id).values(is_default=False)
        )
    for k, v in updates.items():
        setattr(addr, k, v)
    await db.flush()
    await db.refresh(addr)
    return addr


async def delete_address(db: AsyncSession, address_id: int, user_id: int) -> bool:
    addr = await get_address(db, address_id, user_id)
    if not addr:
        return False
    await db.delete(addr)
    await db.flush()
    return True
