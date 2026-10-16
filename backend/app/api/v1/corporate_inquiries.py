"""Corporate/bulk inquiry API endpoints."""
import math

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rate_limit import limiter
from app.core.security import require_admin
from app.db.models import User
from app.db.session import get_db
from app.schemas.corporate_inquiry import (
    CorporateInquiryCreate,
    CorporateInquiryListResponse,
    CorporateInquiryResponse,
    CorporateInquiryStatusUpdate,
)
from app.services import corporate_inquiry_service, email_service, whatsapp_service

router = APIRouter(prefix="/corporate-inquiries", tags=["corporate-inquiries"])


# ---------------------------------------------------------------------------
# Public route
# ---------------------------------------------------------------------------

@router.post("", response_model=CorporateInquiryResponse, status_code=201)
@limiter.limit("5/hour")
async def submit_inquiry(
    request: Request,
    body: CorporateInquiryCreate,
    db: AsyncSession = Depends(get_db),
):
    """Submit a new corporate/bulk inquiry. Rate-limited to 5/hour per IP."""
    inquiry = await corporate_inquiry_service.create_inquiry(
        db,
        full_name=body.full_name,
        phone=body.phone,
        email=body.email,
        company_name=body.company_name,
        customization_notes=body.customization_notes,
        qty_requested=body.qty_requested,
    )
    await db.commit()

    # Fire-and-forget notifications — never block the response
    try:
        await email_service.send_corporate_inquiry_emails(db, inquiry.id)
    except Exception as exc:
        logger.error("Corporate inquiry email failed for {}: {}", inquiry.ticket_id, exc)

    try:
        await whatsapp_service.send_corporate_inquiry_notification(db, inquiry.id)
    except Exception as exc:
        logger.error("Corporate inquiry WhatsApp notification failed for {}: {}", inquiry.ticket_id, exc)

    return CorporateInquiryResponse.model_validate(inquiry)


# ---------------------------------------------------------------------------
# Admin routes
# ---------------------------------------------------------------------------

@router.get("/admin", response_model=CorporateInquiryListResponse)
async def admin_list_inquiries(
    status_filter: str | None = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """List all corporate inquiries (admin only), optionally filtered by status."""
    try:
        inquiries, total = await corporate_inquiry_service.admin_list_inquiries(
            db, status=status_filter, page=page, limit=limit
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    pages = math.ceil(total / limit) if total else 0
    return CorporateInquiryListResponse(
        items=[CorporateInquiryResponse.model_validate(i) for i in inquiries],
        total=total,
        page=page,
        pages=pages,
    )


@router.get("/admin/{inquiry_id}", response_model=CorporateInquiryResponse)
async def admin_get_inquiry(
    inquiry_id: int,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Get full details for a single corporate inquiry (admin only)."""
    inquiry = await corporate_inquiry_service.admin_get_inquiry(db, inquiry_id)
    if not inquiry:
        raise HTTPException(status_code=404, detail="Inquiry not found")
    return CorporateInquiryResponse.model_validate(inquiry)


@router.patch("/admin/{inquiry_id}", response_model=CorporateInquiryResponse)
async def admin_update_inquiry(
    inquiry_id: int,
    body: CorporateInquiryStatusUpdate,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Update inquiry status, enforcing the allowed-transition map (admin only)."""
    try:
        inquiry = await corporate_inquiry_service.admin_update_inquiry_status(
            db,
            inquiry_id=inquiry_id,
            new_status=body.status,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    if not inquiry:
        raise HTTPException(status_code=404, detail="Inquiry not found")

    await db.commit()
    return CorporateInquiryResponse.model_validate(inquiry)


@router.delete("/admin/{inquiry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def admin_delete_inquiry(
    inquiry_id: int,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Hard-delete a corporate inquiry (admin cleanup)."""
    inquiry = await corporate_inquiry_service.admin_delete_inquiry(db, inquiry_id)
    if not inquiry:
        raise HTTPException(status_code=404, detail="Inquiry not found")
    await db.commit()
    return None
