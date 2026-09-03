from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_active_user, get_optional_user
from app.db.models import User
from app.db.session import get_db
from app.schemas.review import ReviewCreate, ReviewListResponse, ReviewResponse
from app.services import review_service
from app.utils.image_upload import upload_image_file

router = APIRouter(tags=["reviews"])


@router.get("/products/{product_id}/reviews", response_model=ReviewListResponse)
async def list_product_reviews(
    product_id: int,
    db: AsyncSession = Depends(get_db),
    page: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int, Query(ge=1, le=25)] = 10,
    sort_by: Annotated[str, Query(pattern="^(top|newest|highest|lowest)$")] = "top",
    rating: Annotated[int | None, Query(ge=1, le=5)] = None,
):
    items, summary, total, pages = await review_service.list_reviews(
        db,
        product_id,
        page=page,
        limit=limit,
        sort_by=sort_by,
        rating=rating,
    )
    return ReviewListResponse(
        items=[review_service.to_review_response(item) for item in items],
        summary=summary,
        total=total,
        page=page,
        pages=pages,
        limit=limit,
    )


@router.post(
    "/products/{product_id}/reviews",
    response_model=ReviewResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_product_review(
    product_id: int,
    rating: Annotated[int, Form(ge=1, le=5)],
    title: Annotated[str | None, Form()] = None,
    body: Annotated[str | None, Form()] = None,
    author_name: Annotated[str | None, Form()] = None,
    youtube_url: Annotated[str | None, Form()] = None,
    media: UploadFile | None = File(default=None),
    db: AsyncSession = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    # Upload media file if provided
    media_url = None
    if media and media.filename:
        media_key = await upload_image_file(media, folder="reviews", entity_id=product_id)
        media_url = media_key
    
    # Create payload
    payload = ReviewCreate(
        rating=rating,
        title=title,
        body=body,
        author_name=author_name,
        youtube_url=youtube_url,
    )
    
    try:
        review = await review_service.create_or_update_review(db, product_id, user, payload, media_url)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return review_service.to_review_response(review)


@router.post("/reviews/{review_id}/helpful", response_model=ReviewResponse)
async def mark_review_helpful(
    review_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    try:
        review = await review_service.mark_helpful(db, review_id, user)
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return review_service.to_review_response(review)
