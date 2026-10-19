from typing import Any

from pydantic import BaseModel, Field, field_serializer, model_validator


# New-format variant products send selected_options as a list of option IDs;
# old-format products send a dict of slugs. Both are normalized server-side.
SelectedOptions = list[str] | dict[str, str] | None


class CartItemCreate(BaseModel):
    product_id: int
    quantity: int = Field(ge=1, default=1)
    selected_options: SelectedOptions = None


class CartItemUpdate(BaseModel):
    quantity: int = Field(ge=0)


class CartMergeRequest(BaseModel):
    session_id: str


class CartItemProduct(BaseModel):
    id: int
    name: str
    slug: str
    price: float
    original_price: float | None
    images: list[str]
    variants: dict | None = None

    model_config = {"from_attributes": True}

    @field_serializer("images")
    def serialize_images(self, images: list[str]) -> list[str]:
        from app.utils.image_upload import resolve_image_url

        return [url for img in (images or []) if (url := resolve_image_url(img))]


class CartItemResponse(BaseModel):
    id: int
    product_id: int
    quantity: int
    selected_options: list[str] | dict[str, Any] | None = None
    product: CartItemProduct
    line_total: float
    resolved_image_url: str
    # 400px WebP of `resolved_image_url` for the small cart thumbnails. Falls back
    # to the original when the image's folder has no generated variants.
    resolved_image_thumb_url: str | None = None
    unit_price: float
    available_stock: int
    stock_warning: bool

    model_config = {"from_attributes": True}

    @model_validator(mode="after")
    def build_thumb_url(self) -> "CartItemResponse":
        from app.utils.image_upload import extract_relative_key, resolve_image_url

        # The cart service may already hand us a full CDN URL, so strip it back to
        # the storage key before asking for the variant.
        self.resolved_image_thumb_url = resolve_image_url(
            extract_relative_key(self.resolved_image_url), "thumb"
        )
        return self

    @field_serializer("resolved_image_url")
    def serialize_resolved_image_url(self, val: str) -> str | None:
        from app.utils.image_upload import resolve_image_url

        return resolve_image_url(val)


class CartResponse(BaseModel):
    id: int
    user_id: int | None
    session_id: str | None
    items: list[CartItemResponse] = []
    item_count: int
    subtotal: float
