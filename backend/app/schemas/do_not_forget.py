"""Schemas for Do Not Forget to Buy products."""
from pydantic import BaseModel, Field
from datetime import datetime


class DoNotForgetProductBase(BaseModel):
    """Base schema for do not forget products."""
    product_id: int
    sort_order: int = 0
    is_active: bool = True


class DoNotForgetProductCreate(DoNotForgetProductBase):
    """Schema for creating a do not forget product."""
    pass


class DoNotForgetProductUpdate(BaseModel):
    """Schema for updating a do not forget product."""
    sort_order: int | None = None
    is_active: bool | None = None


class DoNotForgetProductResponse(DoNotForgetProductBase):
    """Schema for do not forget product response."""
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DoNotForgetProductWithDetails(BaseModel):
    """Do not forget product with full product details."""
    id: int
    product_id: int
    sort_order: int
    is_active: bool
    created_at: datetime
    updated_at: datetime
    product: dict  # Full product data

    class Config:
        from_attributes = True


class DoNotForgetListResponse(BaseModel):
    """List of do not forget products."""
    items: list[DoNotForgetProductWithDetails]
    total: int
