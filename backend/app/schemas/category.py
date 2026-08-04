from pydantic import BaseModel, field_serializer


class CategoryCreate(BaseModel):
    name: str
    parent_id: int | None = None
    is_active: bool = True
    image_url: str | None = None
    sort_order: int = 0


class CategoryUpdate(BaseModel):
    name: str | None = None
    parent_id: int | None = None
    image_url: str | None = None
    is_active: bool | None = None
    sort_order: int | None = None


class CategoryResponse(BaseModel):
    id: int
    name: str
    slug: str
    parent_id: int | None
    image_url: str | None
    is_active: bool
    sort_order: int

    model_config = {"from_attributes": True}

    @field_serializer("image_url")
    def serialize_image_url(self, val: str | None) -> str | None:
        from app.utils.image_upload import resolve_image_url
        return resolve_image_url(val)



class CategoryTree(CategoryResponse):
    children: list["CategoryTree"] = []
