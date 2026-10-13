from pydantic import BaseModel, Field, field_serializer, model_validator


class CategoryCreate(BaseModel):
    name: str
    parent_id: int | None = None
    is_active: bool = True
    image_url: str | None = None
    mobile_image_url: str | None = None
    sort_order: int = 0


class CategoryUpdate(BaseModel):
    name: str | None = None
    parent_id: int | None = None
    image_url: str | None = None
    mobile_image_url: str | None = None
    is_active: bool | None = None
    sort_order: int | None = None


class CategoryBrief(BaseModel):
    """Trimmed category shape embedded in product payloads.

    A product is returned inside lists, carts and order previews; pulling whole
    CategoryResponse objects (with both image URLs resolved to CDN links) into
    those payloads is wasted bytes, so only the identity fields travel.
    """

    id: int
    name: str
    slug: str
    parent_id: int | None = None


class CategoryResponse(BaseModel):
    id: int
    name: str
    slug: str
    parent_id: int | None
    image_url: str | None
    mobile_image_url: str | None
    # Generated WebP variants per image: {original, thumb, card}. Empty when the
    # image is external or not yet migrated.
    image_urls: dict[str, str] = Field(default_factory=dict)
    mobile_image_urls: dict[str, str] = Field(default_factory=dict)
    is_active: bool
    sort_order: int

    model_config = {"from_attributes": True}

    @model_validator(mode="after")
    def build_variant_maps(self) -> "CategoryResponse":
        from app.utils.image_upload import resolve_image_url

        def _map(val: str | None) -> dict[str, str]:
            if not val:
                return {}
            return {
                "original": resolve_image_url(val),
                "thumb": resolve_image_url(val, "thumb"),
                "card": resolve_image_url(val, "card"),
            }

        self.image_urls = _map(self.image_url)
        self.mobile_image_urls = _map(self.mobile_image_url)
        return self

    @field_serializer("image_url")
    def serialize_image_url(self, val: str | None) -> str | None:
        from app.utils.image_upload import resolve_image_url
        return resolve_image_url(val)

    @field_serializer("mobile_image_url")
    def serialize_mobile_image_url(self, val: str | None) -> str | None:
        from app.utils.image_upload import resolve_image_url
        return resolve_image_url(val)


class CategoryTree(CategoryResponse):
    children: list["CategoryTree"] = []
