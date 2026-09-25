from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class DisplaySectionCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        normalized = " ".join(value.split())
        if not normalized:
            raise ValueError("Section name is required")
        return normalized


class DisplaySectionUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = " ".join(value.split())
        if not normalized:
            raise ValueError("Section name is required")
        return normalized


class DisplaySectionActiveUpdate(BaseModel):
    is_active: bool


class DisplaySectionResponse(BaseModel):
    id: int
    name: str
    key: str
    sort_order: int
    is_active: bool
    is_system: bool
    created_at: datetime
    updated_at: datetime | None

    model_config = ConfigDict(from_attributes=True)


class DisplaySectionAdminResponse(DisplaySectionResponse):
    product_count: int = 0


class DisplaySectionReorderItem(BaseModel):
    id: int
    sort_order: int = Field(..., ge=0)


class DisplaySectionReorderRequest(BaseModel):
    items: list[DisplaySectionReorderItem] = Field(..., min_length=1)
