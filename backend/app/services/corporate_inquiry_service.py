"""Service layer for corporate/bulk inquiry operations."""
import math
from datetime import datetime, timedelta, timezone

from loguru import logger
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import CorporateInquiry, CorporateInquiryStatus
from app.utils.ticket_ids import make_ticket_id

VALID_STATUSES = {s.value for s in CorporateInquiryStatus}

# Duplicate/spam guard window + threshold (plan 1.6)
DUPLICATE_WINDOW_HOURS = 24
DUPLICATE_THRESHOLD = 3

# Server-side imposed transitions (plan 1.3). `approved` and `cancelled` are terminal.
ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    CorporateInquiryStatus.NEW.value: {
        CorporateInquiryStatus.REVIEW.value,
        CorporateInquiryStatus.QUOTED.value,
        CorporateInquiryStatus.CANCELLED.value,
    },
    CorporateInquiryStatus.REVIEW.value: {
        CorporateInquiryStatus.QUOTED.value,
        CorporateInquiryStatus.CANCELLED.value,
    },
    CorporateInquiryStatus.QUOTED.value: {
        CorporateInquiryStatus.APPROVED.value,
        CorporateInquiryStatus.CANCELLED.value,
    },
    CorporateInquiryStatus.APPROVED.value: set(),
    CorporateInquiryStatus.CANCELLED.value: set(),
}


def _normalize(value: str | None) -> str:
    """Normalize string for duplicate detection (lowercase, trimmed)."""
    return (value or "").strip().lower()


async def create_inquiry(
    db: AsyncSession,
    *,
    full_name: str,
    phone: str,
    email: str,
    company_name: str,
    customization_notes: str | None,
    qty_requested: int | None,
) -> CorporateInquiry:
    """Create a corporate inquiry, generate its ticket ID, and run the duplicate guard.

    is_duplicate is a signal, not a verdict: if the same normalized email OR phone
    already appears >= DUPLICATE_THRESHOLD times within DUPLICATE_WINDOW_HOURS, the
    submission is flagged but never blocked (a repeat customer must still get through).
    """
    since = datetime.now(timezone.utc) - timedelta(hours=DUPLICATE_WINDOW_HOURS)

    normalized_email = _normalize(email)
    normalized_phone = _normalize(phone)
    dup_count_q = (
        select(func.count())
        .select_from(CorporateInquiry)
        .where(
            CorporateInquiry.created_at >= since,
            or_(
                func.lower(CorporateInquiry.email) == normalized_email,
                func.lower(CorporateInquiry.phone) == normalized_phone,
            ),
        )
    )
    dup_count = (await db.execute(dup_count_q)).scalar() or 0
    is_duplicate = dup_count >= DUPLICATE_THRESHOLD

    # Insert inquiry row — ticket_id set after flush gives us the PK
    inquiry = CorporateInquiry(
        ticket_id="PENDING",  # placeholder; replaced right after flush
        full_name=full_name,
        phone=phone,
        email=email,
        company_name=company_name,
        customization_notes=customization_notes,
        qty_requested=qty_requested,
        is_duplicate=is_duplicate,
        status=CorporateInquiryStatus.NEW,
    )
    db.add(inquiry)
    await db.flush()  # populates inquiry.id

    inquiry.ticket_id = make_ticket_id("INQ", inquiry.id)
    await db.flush()

    logger.info(
        "Corporate inquiry created: ticket_id={} email={} phone={} is_duplicate={}",
        inquiry.ticket_id, email, phone, is_duplicate,
    )
    return inquiry


async def admin_list_inquiries(
    db: AsyncSession,
    status: str | None = None,
    page: int = 1,
    limit: int = 20,
) -> tuple[list[CorporateInquiry], int]:
    """Return paginated corporate inquiries for admin, optionally filtered by status."""
    base = select(CorporateInquiry)
    count_base = select(func.count()).select_from(CorporateInquiry)

    if status:
        if status not in VALID_STATUSES:
            raise ValueError(f"Invalid status filter: {status}")
        base = base.where(CorporateInquiry.status == CorporateInquiryStatus(status))
        count_base = count_base.where(CorporateInquiry.status == CorporateInquiryStatus(status))

    total = (await db.execute(count_base)).scalar() or 0
    offset = (page - 1) * limit
    result = await db.execute(
        base
        .order_by(CorporateInquiry.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    return list(result.scalars().all()), total


async def admin_get_inquiry(db: AsyncSession, inquiry_id: int) -> CorporateInquiry | None:
    """Fetch a single corporate inquiry by DB id for admin detail view."""
    return await db.get(CorporateInquiry, inquiry_id)


async def admin_update_inquiry_status(
    db: AsyncSession,
    inquiry_id: int,
    new_status: str,
) -> CorporateInquiry | None:
    """Update inquiry status, enforcing the allowed-transition map. Returns None if not found."""
    if new_status not in VALID_STATUSES:
        raise ValueError(f"Invalid status: {new_status}")

    inquiry = await db.get(CorporateInquiry, inquiry_id)
    if not inquiry:
        return None

    old_status = inquiry.status.value
    allowed = ALLOWED_TRANSITIONS.get(old_status, set())
    if new_status not in allowed:
        raise ValueError(
            f"Cannot transition inquiry {inquiry.ticket_id} from '{old_status}' to '{new_status}'"
        )

    inquiry.status = CorporateInquiryStatus(new_status)
    await db.flush()

    logger.info(
        "Corporate inquiry {} status updated: {} -> {} by admin",
        inquiry.ticket_id, old_status, new_status,
    )
    return inquiry


async def admin_delete_inquiry(db: AsyncSession, inquiry_id: int) -> CorporateInquiry | None:
    """Hard-delete a corporate inquiry (admin cleanup). Returns the deleted row or None."""
    inquiry = await db.get(CorporateInquiry, inquiry_id)
    if not inquiry:
        return None

    ticket_id = inquiry.ticket_id
    await db.delete(inquiry)
    await db.flush()

    logger.info("Corporate inquiry {} deleted by admin.", ticket_id)
    return inquiry


def pages_count(total: int, limit: int) -> int:
    """Calculate total pages for pagination."""
    return math.ceil(total / limit) if total else 0
