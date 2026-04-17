from pydantic import BaseModel


class CategoryCreate(BaseModel):
    name: str
    parent_id: int | None = None
    is_active: bool = True


class CategoryUpdate(BaseModel):
    name: str | None = None
    parent_id: int | None = None
    image_url: str | None = None
    is_active: bool | None = None


class CategoryResponse(BaseModel):
    id: int
    name: str
    slug: str
    parent_id: int | None
    image_url: str | None
    is_active: bool

    model_config = {"from_attributes": True}


class CategoryTree(CategoryResponse):
    children: list["CategoryTree"] = []
