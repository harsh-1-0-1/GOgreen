import re
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class MenuItemCreate(BaseModel):
    label: str = Field(..., min_length=1, max_length=255)
    href: str = Field(..., min_length=1, max_length=512)
    parent_id: int | None = None
    image_url: str | None = None
    accent_color: str | None = None
    highlight: bool = False
    sort_order: int = 0
    is_active: bool = True

    @field_validator("href")
    @classmethod
    def validate_href(cls, v: str) -> str:
        if v.startswith("//") or not (v.startswith("/") or v.startswith("https://")):
            raise ValueError(
                "URL must start with / or https:// (protocol-relative // URLs are not allowed)"
            )
        return v

    @field_validator("accent_color")
    @classmethod
    def validate_accent_color(cls, v: str | None) -> str | None:
        if v is not None and not re.match(r"^#[0-9A-Fa-f]{6}$", v):
            raise ValueError("Must be a valid hex color (e.g. #FF5733)")
        return v


class MenuItemUpdate(BaseModel):
    label: str | None = Field(None, min_length=1, max_length=255)
    href: str | None = Field(None, min_length=1, max_length=512)
    parent_id: int | None = None
    image_url: str | None = None
    accent_color: str | None = None
    highlight: bool | None = None
    sort_order: int | None = None
    is_active: bool | None = None

    @field_validator("href")
    @classmethod
    def validate_href(cls, v: str | None) -> str | None:
        if v is not None and (
            v.startswith("//") or not (v.startswith("/") or v.startswith("https://"))
        ):
            raise ValueError(
                "URL must start with / or https:// (protocol-relative // URLs are not allowed)"
            )
        return v

    @field_validator("accent_color")
    @classmethod
    def validate_accent_color(cls, v: str | None) -> str | None:
        if v is not None and not re.match(r"^#[0-9A-Fa-f]{6}$", v):
            raise ValueError("Must be a valid hex color (e.g. #FF5733)")
        return v


class MenuItemOut(BaseModel):
    id: int
    label: str
    href: str
    parent_id: int | None
    image_url: str | None
    accent_color: str | None
    highlight: bool
    sort_order: int
    is_active: bool
    created_at: datetime
    updated_at: datetime | None

    model_config = ConfigDict(from_attributes=True)


class MenuItemReorderItem(BaseModel):
    id: int
    sort_order: int


class MenuItemReorderRequest(BaseModel):
    items: list[MenuItemReorderItem]
