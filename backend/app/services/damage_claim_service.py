import math

from fastapi import UploadFile
from loguru import logger
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models import (
    DamageClaim,
    DamageClaimStatus,
    Order,
    OrderItem,
    OrderStatus,
)
from app.utils.image_upload import resolve_image_url, upload_image_file

# Maximum photos per claim and per-upload size enforced at the route layer,
# but constants are defined here for easy tuning.
MAX_PHOTOS = 5
PHOTO_FOLDER = "damage-claims"

VALID_STATUSES = {s.value for s in DamageClaimStatus}


def _generate_ticket_id(claim_id: int) -> str:
    """Generate a deterministic, human-readable ticket ID from the DB primary key."""
    return f"PLG-DR-{claim_id:06d}"


def _resolve_photo_urls(photo_keys: list) -> list[str]:
    return [resolve_image_url(k) for k in (photo_keys or []) if k]


async def _load_claim(db: AsyncSession, claim_id: int) -> DamageClaim | None:
    result = await db.execute(
        select(DamageClaim)
        .where(DamageClaim.id == claim_id)
        .options(
            selectinload(DamageClaim.user),
            selectinload(DamageClaim.order).selectinload(Order.items).selectinload(OrderItem.product),
            selectinload(DamageClaim.order).selectinload(Order.address),
        )
    )
    return result.scalar_one_or_none()


# ---------------------------------------------------------------------------
# Customer-facing operations
# ---------------------------------------------------------------------------

async def create_claim(
    db: AsyncSession,
    *,
    user_id: int,
    order_id: int,
    order_item_id: int | None,
    issue_type: str,
    description: str,
    photo_files: list[UploadFile],
) -> DamageClaim:
    """
    Create a new damage claim.

    Validations:
    - Order must exist and belong to this user.
    - Order status must be DELIVERED.
    - No active (non-closed/rejected) claim may already exist for this order.
    """
    # Ownership + status check
    order_result = await db.execute(
        select(Order)
        .where(Order.id == order_id, Order.user_id == user_id)
        .options(
            selectinload(Order.items).selectinload(OrderItem.product),
            selectinload(Order.address),
        )
    )
    order = order_result.scalar_one_or_none()
    if not order:
        raise ValueError("Order not found")
    if order.status != OrderStatus.DELIVERED:
        raise ValueError("Damage claims can only be submitted for delivered orders")

    # Duplicate-claim guard (one active claim per order)
    existing_result = await db.execute(
        select(DamageClaim).where(
            DamageClaim.order_id == order_id,
            DamageClaim.status.notin_([
                DamageClaimStatus.CLOSED,
                DamageClaimStatus.REJECTED,
            ]),
        )
    )
    if existing_result.scalar_one_or_none():
        raise ValueError("An active damage claim already exists for this order")

    # Upload photos
    photo_keys: list[str] = []
    for photo in photo_files[:MAX_PHOTOS]:
        try:
            key = await upload_image_file(photo, PHOTO_FOLDER, f"order-{order_id}")
            photo_keys.append(key)
        except Exception as exc:
            logger.error("Failed to upload damage claim photo for order {}: {}", order_id, exc)
            raise ValueError("Failed to upload one or more photos. Please try again.") from exc

    # Insert claim row — ticket_id set after flush gives us the PK
    claim = DamageClaim(
        ticket_id="PENDING",  # placeholder; replaced right after flush
        user_id=user_id,
        order_id=order_id,
        order_item_id=order_item_id,
        issue_type=issue_type,
        description=description,
        photo_keys=photo_keys,
        status=DamageClaimStatus.SUBMITTED,
    )
    db.add(claim)
    await db.flush()  # populates claim.id

    claim.ticket_id = _generate_ticket_id(claim.id)
    await db.flush()

    logger.info(
        "Damage claim created: ticket_id={} order_id={} user_id={}",
        claim.ticket_id, order_id, user_id,
    )
    return await _load_claim(db, claim.id) or claim


async def list_claims_for_user(
    db: AsyncSession,
    user_id: int,
    page: int = 1,
    limit: int = 20,
) -> tuple[list[DamageClaim], int]:
    """Return paginated damage claims for a specific user."""
    count_q = (
        select(func.count())
        .select_from(DamageClaim)
        .where(DamageClaim.user_id == user_id)
    )
    total = (await db.execute(count_q)).scalar() or 0
    offset = (page - 1) * limit
    result = await db.execute(
        select(DamageClaim)
        .where(DamageClaim.user_id == user_id)
        .options(
            selectinload(DamageClaim.user),
            selectinload(DamageClaim.order).selectinload(Order.items).selectinload(OrderItem.product),
            selectinload(DamageClaim.order).selectinload(Order.address),
        )
        .order_by(DamageClaim.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    return list(result.scalars().all()), total


async def get_claim_by_ticket(
    db: AsyncSession,
    ticket_id: str,
    user_id: int,
) -> DamageClaim | None:
    """Fetch a single claim by ticket ID, scoped to the requesting user."""
    result = await db.execute(
        select(DamageClaim).where(
            DamageClaim.ticket_id == ticket_id,
            DamageClaim.user_id == user_id,
        ).options(
            selectinload(DamageClaim.user),
            selectinload(DamageClaim.order).selectinload(Order.items).selectinload(OrderItem.product),
            selectinload(DamageClaim.order).selectinload(Order.address),
        )
    )
    return result.scalar_one_or_none()


# ---------------------------------------------------------------------------
# Admin operations
# ---------------------------------------------------------------------------

async def admin_list_claims(
    db: AsyncSession,
    status: str | None = None,
    page: int = 1,
    limit: int = 20,
) -> tuple[list[DamageClaim], int]:
    """Return paginated damage claims for admin, optionally filtered by status."""
    base = select(DamageClaim)
    count_base = select(func.count()).select_from(DamageClaim)

    if status:
        if status not in VALID_STATUSES:
            raise ValueError(f"Invalid status filter: {status}")
        base = base.where(DamageClaim.status == DamageClaimStatus(status))
        count_base = count_base.where(DamageClaim.status == DamageClaimStatus(status))

    total = (await db.execute(count_base)).scalar() or 0
    offset = (page - 1) * limit
    result = await db.execute(
        base
        .options(
            selectinload(DamageClaim.user),
            selectinload(DamageClaim.order).selectinload(Order.items).selectinload(OrderItem.product),
            selectinload(DamageClaim.order).selectinload(Order.address),
        )
        .order_by(DamageClaim.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    return list(result.scalars().all()), total


async def admin_get_claim(db: AsyncSession, claim_id: int) -> DamageClaim | None:
    """Fetch a fully-loaded claim by DB id for admin detail view."""
    return await _load_claim(db, claim_id)


async def admin_update_claim(
    db: AsyncSession,
    claim_id: int,
    new_status: str,
    admin_notes: str | None,
) -> DamageClaim | None:
    """Update claim status and admin notes. Returns updated claim or None if not found."""
    if new_status not in VALID_STATUSES:
        raise ValueError(f"Invalid status: {new_status}")

    claim = await _load_claim(db, claim_id)
    if not claim:
        return None

    old_status = claim.status.value
    claim.status = DamageClaimStatus(new_status)
    if admin_notes is not None:
        claim.admin_notes = admin_notes

    await db.flush()
    logger.info(
        "Damage claim {} status updated: {} → {} by admin",
        claim.ticket_id, old_status, new_status,
    )
    return claim


def resolve_claim_photo_urls(claim: DamageClaim) -> list[str]:
    """Resolve storage keys to full public URLs."""
    return _resolve_photo_urls(claim.photo_keys)


def pages_count(total: int, limit: int) -> int:
    return math.ceil(total / limit) if total else 0
