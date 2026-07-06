from datetime import datetime

from pydantic import BaseModel, Field, field_serializer


class ProductCreate(BaseModel):
    name: str
    description: str | None = None
    price: float = Field(gt=0)
    original_price: float | None = None
    stock_qty: int = 0
    category_id: int
    tags: list[str] = []
    care_tips: list[str] = []
    how_to_guide: str | None = None
    sunlight: str | None = None
    watering: str | None = None
    badge: str | None = None
    is_active: bool = True
    variants: dict | None = None


class ProductUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    price: float | None = Field(default=None, gt=0)
    original_price: float | None = None
    stock_qty: int | None = None
    category_id: int | None = None
    images: list[str] | None = None
    tags: list[str] | None = None
    care_tips: list[str] | None = None
    how_to_guide: str | None = None
    sunlight: str | None = None
    watering: str | None = None
    badge: str | None = None
    is_active: bool | None = None
    variants: dict | None = None


class ProductResponse(BaseModel):
    id: int
    name: str
    slug: str
    description: str | None
    price: float
    original_price: float | None
    stock_qty: int
    category_id: int
    images: list[str]
    tags: list[str]
    care_tips: list[str]
    how_to_guide: str | None
    sunlight: str | None
    watering: str | None
    badge: str | None
    is_active: bool
    created_at: datetime
    variants: dict | None = None

    model_config = {"from_attributes": True}

    @field_serializer("images")
    def serialize_images(self, images: list[str]) -> list[str]:
        from app.utils.image_upload import resolve_image_url
        return [resolve_image_url(img) for img in images] if images else []

    @field_serializer("variants")
    def serialize_variants(self, variants: dict | None) -> dict | None:
        from app.utils.image_upload import resolve_variants_images
        return resolve_variants_images(variants)



class ProductListResponse(BaseModel):
    items: list[ProductResponse]
    total: int
    page: int
    pages: int
    limit: int
