from datetime import datetime

from pydantic import BaseModel, Field


class ReviewCreate(BaseModel):
    rating: int = Field(ge=1, le=5)
    title: str | None = Field(default=None, max_length=140)
    body: str | None = Field(default=None, max_length=4000)
    author_name: str | None = Field(default=None, max_length=255)


class ReviewResponse(BaseModel):
    id: int
    product_id: int
    user_id: int | None
    author_name: str
    rating: int
    title: str | None
    body: str | None
    is_verified_purchase: bool
    helpful_count: int
    created_at: datetime
    updated_at: datetime


class ReviewSummary(BaseModel):
    average_rating: float
    review_count: int
    rating_counts: dict[int, int]


class ReviewListResponse(BaseModel):
    items: list[ReviewResponse]
    summary: ReviewSummary
    total: int
    page: int
    pages: int
    limit: int
