import hashlib
import hmac
import json

from fastapi import APIRouter, Depends, HTTPException, Request
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.models import WebhookEvent
from app.db.session import get_db
from app.services import order_service

router = APIRouter(prefix="/payments", tags=["payments"])


def _verify_razorpay_signature(body: bytes, signature: str, secret: str) -> bool:
    """Verify Razorpay webhook signature using HMAC-SHA256."""
    expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


@router.post("/razorpay/webhook")
async def razorpay_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Razorpay sends a POST with JSON body and X-Razorpay-Signature header.
    We verify the HMAC-SHA256 signature, then update the order status.

    Supported events:
      - payment.captured  → mark order PAID / CONFIRMED
      - payment.failed    → mark order FAILED / CANCELLED
    """
    body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")

    # Verify signature BEFORE parsing JSON to protect against tampering/attacks
    if settings.RAZORPAY_WEBHOOK_SECRET:
        if not signature:
            logger.warning("Razorpay webhook received without X-Razorpay-Signature header")
            raise HTTPException(status_code=400, detail="Missing webhook signature")
        if not _verify_razorpay_signature(body, signature, settings.RAZORPAY_WEBHOOK_SECRET):
            logger.warning("Razorpay webhook signature mismatch")
            raise HTTPException(status_code=400, detail="Webhook signature verification failed")
    else:
        logger.warning(
            "RAZORPAY_WEBHOOK_SECRET is not set — skipping signature verification. "
            "Set it in production for security."
        )

    try:
        payload = json.loads(body)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Invalid JSON payload") from exc

    razorpay_event_id = request.headers.get("x-razorpay-event-id") or payload.get("id")
    if not razorpay_event_id:
        raise HTTPException(status_code=400, detail="Missing webhook event ID")

    # Idempotency check: see if we've processed this exact Razorpay event already
    from sqlalchemy import select
    existing_event = await db.execute(
        select(WebhookEvent).where(WebhookEvent.razorpay_event_id == razorpay_event_id)
    )
    if existing_event.scalar_one_or_none():
        logger.info("Webhook event {} already processed, returning 200 early.", razorpay_event_id)
        return {"status": "ok", "message": "already processed"}

    # Insert the event into DB to prevent future duplicate processing
    new_event = WebhookEvent(
        razorpay_event_id=razorpay_event_id,
        event_type=payload.get("event", "unknown")
    )
    db.add(new_event)
    # We don't flush yet — we want the event insertion to commit in the same
    # transaction as the order status update.

    event = payload.get("event", "")
    payment_entity = payload.get("payload", {}).get("payment", {}).get("entity", {})
    refund_entity = payload.get("payload", {}).get("refund", {}).get("entity", {})

    # Extract data depending on event
    payment_id = payment_entity.get("id", "") or refund_entity.get("payment_id", "")
    notes = payment_entity.get("notes", {}) or refund_entity.get("notes", {})
    amount_paid_paise = payment_entity.get("amount", 0)

    # Extract order_id from notes (set when creating the Razorpay order)
    raw_order_id = notes.get("order_id") or ""
    try:
        order_id = int(raw_order_id)
    except (ValueError, TypeError) as exc:
        logger.error("Razorpay webhook: could not parse order_id from notes: {}", notes)
        raise HTTPException(status_code=400, detail="Invalid order_id in payment notes") from exc

    logger.info(
        "Razorpay webhook: event={} payment_id={} order_id={}", event, payment_id, order_id
    )

    if event == "payment.captured":
        order = await order_service.mark_paid(db, order_id, payment_id, amount_paid_paise)
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        await db.commit() # Commit order + webhook event
        return {
            "status": "ok",
            "event": event,
            "order_id": order_id,
            "payment_status": order.payment_status.value,
        }

    if event == "payment.failed":
        order = await order_service.mark_failed(db, order_id)
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        await db.commit()
        return {
            "status": "ok",
            "event": event,
            "order_id": order_id,
            "payment_status": order.payment_status.value,
        }

    if event in ("refund.processed", "refund.failed"):
        refund_id = refund_entity.get("id", "")
        # For simplicity, we just mark the DB as refunded on processed.
        # In a real app, you might want to handle failures specifically.
        if event == "refund.processed":
            order = await order_service.mark_refunded(db, order_id, refund_id)
            if not order:
                raise HTTPException(status_code=404, detail="Order not found")
        await db.commit()
        return {
            "status": "ok",
            "event": event,
            "order_id": order_id,
            "refund_id": refund_id,
        }

    # Acknowledge other events gracefully
    logger.debug("Razorpay webhook: unhandled event '{}' — ignoring", event)
    await db.commit()
    return {"status": "ignored", "event": event}
