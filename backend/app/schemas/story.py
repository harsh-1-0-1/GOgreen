from typing import Optional
from pydantic import BaseModel, ConfigDict, field_serializer

from app.utils.image_upload import resolve_image_url


class StoryBase(BaseModel):
    caption: Optional[str] = None
    linked_product_id: Optional[int] = None
    display_order: int = 0
    is_active: bool = True


class StoryCreate(StoryBase):
    pass  # video and thumbnail files are handled via multipart form


class StoryUpdate(BaseModel):
    caption: Optional[str] = None
    linked_product_id: Optional[int] = None
    display_order: Optional[int] = None
    is_active: Optional[bool] = None


class StoryProductInfo(BaseModel):
    id: int
    name: str
    price: float
    original_price: Optional[float] = None
    thumbnail: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class StoryResponse(StoryBase):
    id: int
    video: str
    thumbnail: Optional[str] = None
    linked_product: Optional[StoryProductInfo] = None

    model_config = ConfigDict(from_attributes=True)

    @field_serializer("video", "thumbnail")
    def serialize_media(self, key: str | None) -> str | None:
        return resolve_image_url(key) if key else None
