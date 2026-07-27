import re

import httpx
from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.db.models import Order, OrderItem


def _normalize_phone_number(phone: str) -> str:
    return re.sub(r"\D", "", phone or "")


def _notifications_configured() -> bool:
    return all(
        [
            settings.WHATSAPP_ACCESS_TOKEN.strip(),
            settings.WHATSAPP_PHONE_NUMBER_ID.strip(),
            settings.WHATSAPP_ADMIN_RECIPIENT.strip(),
            settings.WHATSAPP_ORDER_TEMPLATE_NAME.strip(),
        ]
    )


def _build_item_summary(order: Order) -> str:
    item_labels: list[str] = []
    for item in order.items[:4]:
        product_name = item.product.name if item.product else f"Product #{item.product_id}"
        item_labels.append(f"{product_name} x {item.quantity}")

    if len(order.items) > 4:
        item_labels.append(f"+{len(order.items) - 4} more")

    return ", ".join(item_labels) or "Items unavailable"


async def send_new_order_notification(db: AsyncSession, order_id: int) -> None:
    if not _notifications_configured():
        logger.info("WhatsApp order notification skipped: WhatsApp settings are not configured.")
        return

    result = await db.execute(
        select(Order)
        .where(Order.id == order_id)
        .options(
            selectinload(Order.user),
            selectinload(Order.address),
            selectinload(Order.items).selectinload(OrderItem.product),
        )
    )
    order = result.scalar_one_or_none()
    if not order:
        logger.warning("WhatsApp order notification skipped: order {} not found.", order_id)
        return

    recipient = _normalize_phone_number(settings.WHATSAPP_ADMIN_RECIPIENT)
    if not recipient:
        logger.warning("WhatsApp order notification skipped: admin recipient number is invalid.")
        return

    customer_name = order.address.full_name if order.address else order.user.full_name
    customer_phone = order.address.phone if order.address else (order.user.phone or "Not provided")
    item_summary = _build_item_summary(order)

    payload = {
        "messaging_product": "whatsapp",
        "to": recipient,
        "type": "template",
        "template": {
            "name": settings.WHATSAPP_ORDER_TEMPLATE_NAME,
            "language": {"code": settings.WHATSAPP_ORDER_TEMPLATE_LANGUAGE},
            "components": [
                {
                    "type": "body",
                    "parameters": [
                        {"type": "text", "text": str(order.id)},
                        {"type": "text", "text": f"{order.total_amount:.2f}"},
                        {"type": "text", "text": customer_name},
                        {"type": "text", "text": customer_phone},
                        {"type": "text", "text": item_summary[:900]},
                    ],
                }
            ],
        },
    }

    url = (
        f"https://graph.facebook.com/{settings.WHATSAPP_API_VERSION}/"
        f"{settings.WHATSAPP_PHONE_NUMBER_ID}/messages"
    )

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(
                url,
                headers={"Authorization": f"Bearer {settings.WHATSAPP_ACCESS_TOKEN}"},
                json=payload,
            )
            response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        logger.error(
            "WhatsApp order notification failed for order {}: status={} body={}",
            order.id,
            exc.response.status_code,
            exc.response.text[:500],
        )
        return
    except httpx.HTTPError as exc:
        logger.error("WhatsApp order notification failed for order {}: {}", order.id, exc)
        return

    logger.info("WhatsApp order notification sent for order {}.", order.id)


async def send_damage_claim_notification(db: AsyncSession, claim_id: int) -> None:
    """Send WhatsApp notification to admin when a new damage claim is submitted."""
    if not _notifications_configured():
        logger.info("WhatsApp damage claim notification skipped: WhatsApp settings are not configured.")
        return

    from app.db.models import DamageClaim

    result = await db.execute(
        select(DamageClaim)
        .where(DamageClaim.id == claim_id)
        .options(selectinload(DamageClaim.user))
    )
    claim = result.scalar_one_or_none()
    if not claim:
        logger.warning("WhatsApp damage claim notification skipped: claim {} not found.", claim_id)
        return

    recipient = _normalize_phone_number(settings.WHATSAPP_ADMIN_RECIPIENT)
    if not recipient:
        logger.warning("WhatsApp damage claim notification skipped: admin recipient number is invalid.")
        return

    # Reuse the same order template with adapted parameter values.
    # Template body params: [order_id, amount, customer_name, customer_phone, item_summary]
    # We repurpose them to convey claim details since adding new templates requires WhatsApp approval.
    payload = {
        "messaging_product": "whatsapp",
        "to": recipient,
        "type": "template",
        "template": {
            "name": settings.WHATSAPP_ORDER_TEMPLATE_NAME,
            "language": {"code": settings.WHATSAPP_ORDER_TEMPLATE_LANGUAGE},
            "components": [
                {
                    "type": "body",
                    "parameters": [
                        {"type": "text", "text": claim.ticket_id},
                        {"type": "text", "text": f"Damage Claim"},
                        {"type": "text", "text": claim.user.full_name},
                        {"type": "text", "text": claim.user.email},
                        {"type": "text", "text": f"Order #{claim.order_id} | {claim.issue_type}"},
                    ],
                }
            ],
        },
    }

    url = (
        f"https://graph.facebook.com/{settings.WHATSAPP_API_VERSION}/"
        f"{settings.WHATSAPP_PHONE_NUMBER_ID}/messages"
    )

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(
                url,
                headers={"Authorization": f"Bearer {settings.WHATSAPP_ACCESS_TOKEN}"},
                json=payload,
            )
            response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        logger.error(
            "WhatsApp damage claim notification failed for {}: status={} body={}",
            claim.ticket_id,
            exc.response.status_code,
            exc.response.text[:500],
        )
        return
    except httpx.HTTPError as exc:
        logger.error("WhatsApp damage claim notification failed for {}: {}", claim.ticket_id, exc)
        return

    logger.info("WhatsApp damage claim notification sent for claim {}.", claim.ticket_id)
