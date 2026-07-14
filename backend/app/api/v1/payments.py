import hashlib
import hmac
import json

from fastapi import APIRouter, Depends, HTTPException, Request
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.models import WebhookEvent
from app.db.session import get_db
from app.services import email_service, order_service, whatsapp_service

router = APIRouter(prefix="/payments", tags=["payments"])


def _verify_razorpay_signature(body: bytes, signature: str, secret: str) -> bool:
    """Verify Razorpay webhook signature using HMAC-SHA256."""
    expected = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected.encode("utf-8"), signature.encode("utf-8"))


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

    from sqlalchemy import select
    from sqlalchemy.exc import IntegrityError

    try:
        # ── Idempotency: bail early if this exact event was already handled ──
        existing = await db.execute(
            select(WebhookEvent).where(WebhookEvent.razorpay_event_id == razorpay_event_id)
        )
        if existing.scalar_one_or_none():
            logger.info("Webhook event {} already processed, returning 200 early.", razorpay_event_id)
            return {"status": "ok", "message": "already processed"}

        # ── Record the event now (inside the same transaction as the order update) ──
        db.add(WebhookEvent(
            razorpay_event_id=razorpay_event_id,
            event_type=payload.get("event", "unknown"),
        ))

        event = payload.get("event", "")
        payment_entity = payload.get("payload", {}).get("payment", {}).get("entity", {})
        refund_entity  = payload.get("payload", {}).get("refund",  {}).get("entity", {})

        payment_id       = payment_entity.get("id", "") or refund_entity.get("payment_id", "")
        notes            = payment_entity.get("notes", {}) or refund_entity.get("notes", {})
        amount_paid_paise = payment_entity.get("amount", 0)

        raw_order_id = notes.get("order_id") or ""
        try:
            order_id = int(raw_order_id)
        except (ValueError, TypeError) as exc:
            logger.error("Razorpay webhook: could not parse order_id from notes: {}", notes)
            raise HTTPException(status_code=400, detail="Invalid order_id in payment notes") from exc

        logger.info("Razorpay webhook: event={} payment_id={} order_id={}", event, payment_id, order_id)

        order     = None
        refund_id = ""

        if event == "payment.captured":
            order = await order_service.mark_paid(db, order_id, payment_id, amount_paid_paise)
            if not order:
                raise HTTPException(status_code=404, detail="Order not found")

        elif event == "payment.failed":
            order = await order_service.mark_failed(db, order_id)
            if not order:
                raise HTTPException(status_code=404, detail="Order not found")

        elif event == "refund.processed":
            refund_id     = refund_entity.get("id", "")
            refund_amount = refund_entity.get("amount", 0)          # paise
            order = await order_service.record_refund(
                db, order_id, refund_id, refund_amount
            )
            if not order:
                raise HTTPException(status_code=404, detail="Order not found")

        elif event == "refund.failed":
            refund_id = refund_entity.get("id", "")
            logger.warning("Refund {} failed for order_id={}", refund_id, order_id)

        else:
            logger.debug("Razorpay webhook: unhandled event '{}' — ignoring", event)

        # ── Single commit: WebhookEvent insert + any order mutation go together ──
        await db.commit()

        if refund_id:
            return {"status": "ok", "event": event, "order_id": order_id, "refund_id": refund_id}
        if order and event == "payment.captured":
            try:
                await whatsapp_service.send_new_order_notification(db, order_id)
            except Exception as exc:
                logger.exception("New order WhatsApp notification failed for order {}: {}", order_id, exc)
            try:
                await email_service.send_order_emails(db, order_id)
            except Exception as exc:
                logger.exception("New order email notification failed for order {}: {}", order_id, exc)

        if order:
            return {"status": "ok", "event": event, "order_id": order_id,
                    "payment_status": order.payment_status.value}
        return {"status": "ignored", "event": event}

    except HTTPException:
        await db.rollback()
        raise
    except IntegrityError:
        # A concurrent worker already inserted this event_id — treat as duplicate
        await db.rollback()
        logger.info("Concurrent duplicate webhook event {} — returning 200.", razorpay_event_id)
        return {"status": "ok", "message": "already processed"}
    except Exception as exc:
        await db.rollback()
        logger.exception("Unexpected error processing webhook: {}", exc)
        raise HTTPException(status_code=500, detail="Internal server error")
