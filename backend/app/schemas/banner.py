from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class BannerBase(BaseModel):
    title: str = Field(..., max_length=100)
    subtitle: Optional[str] = Field(None, max_length=255)
    cta_text: Optional[str] = Field(None, max_length=50)
    cta_link: Optional[str] = Field(None, max_length=255)
    badge_text: Optional[str] = Field(None, max_length=100)
    bg_color: str = Field(default="#F5F0E8")
    text_color: str = Field(default="#1B4332")
    position: int = 0
    placement: str = Field(
        default="hero",
        pattern=r"^(hero|announcement|themed|strip|highlight|collection)$",
    )
    is_active: bool = True
    valid_from: Optional[datetime] = None
    valid_until: Optional[datetime] = None

    model_config = {"from_attributes": True}


class BannerCreate(BannerBase):
    pass


class BannerUpdate(BannerBase):
    title: Optional[str] = Field(None, max_length=100)
    placement: Optional[str] = None
    image_url_manual: Optional[str] = Field(None, max_length=512)


class BannerOut(BannerBase):
    id: int
    image_url: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None


class BannerReorderItem(BaseModel):
    id: int
    position: int


class BannerReorderRequest(BaseModel):
    items: list[BannerReorderItem]
