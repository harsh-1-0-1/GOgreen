from datetime import datetime

from pydantic import BaseModel


class TagCreate(BaseModel):
    name: str
    color: str | None = None
    is_active: bool = True
    sort_order: int = 0


class TagUpdate(BaseModel):
    name: str | None = None
    color: str | None = None
    is_active: bool | None = None
    sort_order: int | None = None


class TagResponse(BaseModel):
    id: int
    name: str
    slug: str
    color: str | None
    is_active: bool
    sort_order: int
    created_at: datetime

    model_config = {"from_attributes": True}