from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_active_user
from app.db.models import User
from app.db.session import get_db
from app.schemas.address import AddressCreate, AddressResponse, AddressUpdate
from app.services import address_service

router = APIRouter(prefix="/addresses", tags=["addresses"])


@router.get("", response_model=list[AddressResponse])
async def list_addresses(
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    return await address_service.list_addresses(db, user.id)


@router.post("", response_model=AddressResponse, status_code=201)
async def create_address(
    body: AddressCreate,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    return await address_service.create_address(db, user.id, body)


@router.put("/{address_id}", response_model=AddressResponse)
async def update_address(
    address_id: int,
    body: AddressUpdate,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    addr = await address_service.update_address(db, address_id, user.id, body)
    if not addr:
        raise HTTPException(status_code=404, detail="Address not found")
    return addr


@router.delete("/{address_id}", status_code=204)
async def delete_address(
    address_id: int,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    deleted = await address_service.delete_address(db, address_id, user.id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Address not found")
