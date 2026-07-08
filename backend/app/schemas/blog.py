from datetime import datetime

from pydantic import BaseModel, Field, field_serializer


class BlogPostCreate(BaseModel):
    title: str
    excerpt: str = Field(max_length=200)
    content: str
    category: str
    author_name: str
    is_published: bool = False


class BlogPostUpdate(BaseModel):
    title: str | None = None
    excerpt: str | None = Field(default=None, max_length=200)
    content: str | None = None
    category: str | None = None
    author_name: str | None = None
    is_published: bool | None = None
    cover_image_url: str | None = None


class BlogPostResponse(BaseModel):
    id: int
    title: str
    slug: str
    excerpt: str
    content: str
    cover_image_url: str | None
    category: str
    author_name: str
    is_published: bool
    published_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}

    @field_serializer("cover_image_url")
    def serialize_cover_image_url(self, val: str | None) -> str | None:
        from app.utils.image_upload import resolve_image_url
        return resolve_image_url(val)


class BlogListResponse(BaseModel):
    items: list[BlogPostResponse]
    total: int
    page: int
    pages: int
    limit: int
