import math

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_active_user, require_admin
from app.db.models import User
from app.db.session import get_db
from app.schemas.damage_claim import (
    DamageClaimListResponse,
    DamageClaimResponse,
    DamageClaimStatusUpdate,
)
from app.services import damage_claim_service, email_service, whatsapp_service

router = APIRouter(prefix="/damage-claims", tags=["damage-claims"])

# Photo constraints
_MAX_PHOTOS = 5
_MAX_PHOTO_BYTES = 5 * 1024 * 1024  # 5 MB
_ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp"}


def _make_response(claim) -> DamageClaimResponse:
    return DamageClaimResponse.from_orm_with_resolved_urls(
        claim,
        damage_claim_service.resolve_claim_photo_urls(claim),
    )


def _validate_photos(photos: list[UploadFile]) -> None:
    if len(photos) > _MAX_PHOTOS:
        raise HTTPException(
            status_code=422,
            detail=f"Maximum {_MAX_PHOTOS} photos allowed per claim",
        )
    for photo in photos:
        if photo.content_type and photo.content_type not in _ALLOWED_CONTENT_TYPES:
            raise HTTPException(
                status_code=422,
                detail=f"Unsupported file type '{photo.content_type}'. Allowed: JPEG, PNG, WebP",
            )
        if photo.size and photo.size > _MAX_PHOTO_BYTES:
            raise HTTPException(
                status_code=422,
                detail=f"Each photo must be under 5 MB",
            )


# ---------------------------------------------------------------------------
# Customer routes
# ---------------------------------------------------------------------------

@router.post("", response_model=DamageClaimResponse, status_code=201)
async def submit_claim(
    order_id: int = Form(...),
    issue_type: str = Form(..., min_length=1, max_length=50),
    description: str = Form(..., min_length=10, max_length=2000),
    photos: list[UploadFile] = File(default=[]),
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Submit a new damage claim. Requires authentication.
    Accepts multipart/form-data with up to 5 photos (JPEG/PNG/WebP, max 5 MB each).
    """
    _validate_photos(photos)

    try:
        claim = await damage_claim_service.create_claim(
            db,
            user_id=user.id,
            order_id=order_id,
            order_item_id=None,  # v1: one claim per order
            issue_type=issue_type,
            description=description,
            photo_files=photos,
        )
        await db.commit()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    # Fire-and-forget notifications — never block the response
    try:
        await email_service.send_damage_claim_submitted_emails(db, claim.id)
    except Exception as exc:
        logger.error("Damage claim submission email failed for {}: {}", claim.ticket_id, exc)

    try:
        await whatsapp_service.send_damage_claim_notification(db, claim.id)
    except Exception as exc:
        logger.error("Damage claim WhatsApp notification failed for {}: {}", claim.ticket_id, exc)

    return _make_response(claim)


@router.get("/my", response_model=DamageClaimListResponse)
async def list_my_claims(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """List all damage claims for the authenticated user."""
    claims, total = await damage_claim_service.list_claims_for_user(
        db, user.id, page=page, limit=limit
    )
    pages = math.ceil(total / limit) if total else 0
    return DamageClaimListResponse(
        items=[_make_response(c) for c in claims],
        total=total,
        page=page,
        pages=pages,
    )


@router.get("/ticket/{ticket_id}", response_model=DamageClaimResponse)
async def get_claim_by_ticket(
    ticket_id: str,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Fetch a single claim by ticket ID. Scoped to the authenticated user."""
    claim = await damage_claim_service.get_claim_by_ticket(db, ticket_id, user.id)
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    return _make_response(claim)


# ---------------------------------------------------------------------------
# Admin routes
# ---------------------------------------------------------------------------

@router.get("/admin", response_model=DamageClaimListResponse)
async def admin_list_claims(
    status: str | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """List all damage claims (admin only), optionally filtered by status."""
    try:
        claims, total = await damage_claim_service.admin_list_claims(
            db, status=status, page=page, limit=limit
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    pages = math.ceil(total / limit) if total else 0
    return DamageClaimListResponse(
        items=[_make_response(c) for c in claims],
        total=total,
        page=page,
        pages=pages,
    )


@router.get("/admin/{claim_id}", response_model=DamageClaimResponse)
async def admin_get_claim(
    claim_id: int,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Get full details for a single damage claim (admin only)."""
    claim = await damage_claim_service.admin_get_claim(db, claim_id)
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    return _make_response(claim)


@router.patch("/admin/{claim_id}", response_model=DamageClaimResponse)
async def admin_update_claim(
    claim_id: int,
    body: DamageClaimStatusUpdate,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Update claim status and optional admin notes (admin only)."""
    try:
        claim = await damage_claim_service.admin_update_claim(
            db,
            claim_id=claim_id,
            new_status=body.status,
            admin_notes=body.admin_notes,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    await db.commit()

    # Notify customer of meaningful status changes
    try:
        await email_service.send_damage_claim_status_update_email(db, claim.id, body.status)
    except Exception as exc:
        logger.error(
            "Damage claim status update email failed for {} status {}: {}",
            claim.ticket_id, body.status, exc,
        )

    return _make_response(claim)
