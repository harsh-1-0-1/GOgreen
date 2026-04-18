from datetime import datetime

from pydantic import BaseModel, Field


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


class BlogListResponse(BaseModel):
    items: list[BlogPostResponse]
    total: int
    page: int
    pages: int
    limit: int
