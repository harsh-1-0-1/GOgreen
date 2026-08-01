from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.order import OrderResponse, OrderUserResponse


class DamageClaimCreate(BaseModel):
    """Request body for customer submitting a damage claim."""
    order_id: int
    order_item_id: int | None = None
    issue_type: str = Field(..., min_length=1, max_length=50)
    description: str = Field(..., min_length=10, max_length=2000)
    # Photo keys are sent after upload, or included as multipart files
    photo_keys: list[str] = Field(default_factory=list)


class DamageClaimStatusUpdate(BaseModel):
    """Request body for admin updating claim status."""
    status: str = Field(..., min_length=1)
    admin_notes: str | None = Field(None, max_length=5000)


class DamageClaimResponse(BaseModel):
    """Response schema for a damage claim."""
    id: int
    ticket_id: str
    user_id: int
    order_id: int
    order_item_id: int | None
    issue_type: str
    description: str
    photo_urls: list[str]  # Resolved full URLs
    status: str
    admin_notes: str | None
    created_at: datetime
    updated_at: datetime
    # Nested details (loaded via selectinload in service queries)
    user: OrderUserResponse | None = None
    order: OrderResponse | None = None

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_with_resolved_urls(cls, claim, photo_urls: list[str]):
        """Factory method to construct response with resolved photo URLs."""
        user = OrderUserResponse.model_validate(claim.user) if claim.user is not None else None
        order = OrderResponse.model_validate(claim.order) if claim.order is not None else None
        return cls(
            id=claim.id,
            ticket_id=claim.ticket_id,
            user_id=claim.user_id,
            order_id=claim.order_id,
            order_item_id=claim.order_item_id,
            issue_type=claim.issue_type,
            description=claim.description,
            photo_urls=photo_urls,
            status=claim.status.value,
            admin_notes=claim.admin_notes,
            created_at=claim.created_at,
            updated_at=claim.updated_at,
            user=user,
            order=order,
        )


class DamageClaimListResponse(BaseModel):
    """Paginated list of damage claims."""
    items: list[DamageClaimResponse]
    total: int
    page: int
    pages: int
