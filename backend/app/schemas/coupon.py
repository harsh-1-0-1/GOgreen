from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator


class CouponCreate(BaseModel):
    code: str = Field(min_length=1, max_length=50)
    type: Literal["percent", "fixed"] = "percent"
    value: float = Field(gt=0)
    min_amount: float = Field(ge=0, default=0)
    is_active: bool = True

    @field_validator("code")
    @classmethod
    def normalize_code(cls, v: str) -> str:
        return v.strip().upper()


class CouponUpdate(BaseModel):
    code: str | None = Field(default=None, min_length=1, max_length=50)
    type: Literal["percent", "fixed"] | None = None
    value: float | None = Field(default=None, gt=0)
    min_amount: float | None = Field(default=None, ge=0)
    is_active: bool | None = None

    @field_validator("code")
    @classmethod
    def normalize_code(cls, v: str | None) -> str | None:
        return v.strip().upper() if v is not None else v


class CouponResponse(BaseModel):
    id: int
    code: str
    type: str
    value: float
    min_amount: float
    is_active: bool
    times_used: int
    created_at: datetime

    model_config = {"from_attributes": True}


class CouponValidateRequest(BaseModel):
    code: str = Field(min_length=1, max_length=50)
    subtotal: float = Field(ge=0)

    @field_validator("code")
    @classmethod
    def normalize_code(cls, v: str) -> str:
        return v.strip().upper()


class CouponValidationResult(BaseModel):
    code: str
    type: str
    value: float
    min_amount: float
    discount_amount: float
    valid: bool = True
    message: str
