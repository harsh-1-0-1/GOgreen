import asyncio
import html
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr

from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.db.models import Order, OrderItem


def _smtp_configured() -> bool:
    return all(
        [
            settings.SMTP_HOST.strip(),
            settings.SMTP_FROM_EMAIL.strip(),
        ]
    )


def _format_money(amount: float) -> str:
    return f"Rs. {amount:.2f}"


def _payment_label(order: Order) -> str:
    if order.payment_method == "cod":
        return "Cash on Delivery"
    return "Online payment via Razorpay"


def _payment_status_label(order: Order) -> str:
    return order.payment_status.value.replace("_", " ").title()


def _address_lines(order: Order) -> list[str]:
    if not order.address:
        return ["Shipping address unavailable"]
    return [
        order.address.full_name,
        order.address.phone,
        order.address.line1,
        order.address.line2 or "",
        f"{order.address.city}, {order.address.state} - {order.address.pincode}",
    ]


def _item_rows_text(order: Order) -> str:
    rows: list[str] = []
    for item in order.items:
        product_name = item.product.name if item.product else f"Product #{item.product_id}"
        options = ""
        if item.selected_options:
            options = " (" + ", ".join(f"{key}: {value}" for key, value in item.selected_options.items()) + ")"
        rows.append(
            f"- {product_name}{options} | Qty: {item.quantity} | "
            f"Unit: {_format_money(item.unit_price)} | Total: {_format_money(item.quantity * item.unit_price)}"
        )
    return "\n".join(rows) or "- Items unavailable"


def _item_rows_html(order: Order) -> str:
    rows: list[str] = []
    for item in order.items:
        product_name = item.product.name if item.product else f"Product #{item.product_id}"
        options = ""
        if item.selected_options:
            options = "<br><span style=\"color:#6b7280;font-size:12px;\">" + html.escape(
                ", ".join(f"{key}: {value}" for key, value in item.selected_options.items())
            ) + "</span>"
        rows.append(
            "<tr>"
            f"<td style=\"padding:12px;border-bottom:1px solid #e5e7eb;\">{html.escape(product_name)}{options}</td>"
            f"<td style=\"padding:12px;border-bottom:1px solid #e5e7eb;text-align:center;\">{item.quantity}</td>"
            f"<td style=\"padding:12px;border-bottom:1px solid #e5e7eb;text-align:right;\">{html.escape(_format_money(item.unit_price))}</td>"
            f"<td style=\"padding:12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:700;\">{html.escape(_format_money(item.quantity * item.unit_price))}</td>"
            "</tr>"
        )
    return "".join(rows) or (
        "<tr><td colspan=\"4\" style=\"padding:12px;border-bottom:1px solid #e5e7eb;\">Items unavailable</td></tr>"
    )


def _build_text_template(order: Order, *, for_admin: bool) -> str:
    address = "\n".join(line for line in _address_lines(order) if line)
    greeting = "New order received." if for_admin else f"Hi {order.user.full_name}, thank you for your order."
    next_steps = (
        "Next steps: verify stock, confirm the COD/payment status, pack the items, and update the order status in admin."
        if for_admin
        else "Next steps: we will confirm your order, pack it carefully, and share updates as it moves toward delivery."
    )
    if order.payment_method == "cod":
        next_steps += " Payment will be collected at delivery."

    return f"""Plantoga Order #{order.id}

{greeting}

Order summary
Order ID: #{order.id}
Placed on: {order.created_at.strftime('%d %b %Y, %I:%M %p') if order.created_at else 'Unavailable'}
Payment method: {_payment_label(order)}
Payment status: {_payment_status_label(order)}
Order status: {order.status.value.title()}
Total: {_format_money(order.total_amount)}

Customer
Name: {order.user.full_name}
Email: {order.user.email}
Phone: {order.user.phone or 'Not provided'}

Shipping address
{address}

Items
{_item_rows_text(order)}

{next_steps}

For help, reply to this email with Order #{order.id}.
"""


def _build_html_template(order: Order, *, for_admin: bool) -> str:
    customer_name = html.escape(order.user.full_name)
    address_html = "<br>".join(html.escape(line) for line in _address_lines(order) if line)
    greeting = "New order received." if for_admin else f"Hi {customer_name}, thank you for your order."
    next_steps = (
        "Verify stock, confirm the COD/payment status, pack the items, and update the order status in admin."
        if for_admin
        else "We will confirm your order, pack it carefully, and share updates as it moves toward delivery."
    )
    if order.payment_method == "cod":
        next_steps += " Payment will be collected at delivery."

    return f"""<!doctype html>
<html>
  <body style="margin:0;background:#f6f7f4;font-family:Arial,sans-serif;color:#111827;">
    <div style="max-width:680px;margin:0 auto;padding:24px;">
      <div style="background:#1B4332;color:#ffffff;padding:22px;border-radius:10px 10px 0 0;">
        <div style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#d8f3dc;">Plantoga</div>
        <h1 style="margin:8px 0 0;font-size:24px;">Order #{order.id}</h1>
      </div>
      <div style="background:#ffffff;padding:24px;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 10px 10px;">
        <p style="font-size:16px;line-height:1.5;margin:0 0 18px;">{greeting}</p>

        <table style="width:100%;border-collapse:collapse;margin:0 0 20px;background:#f9fafb;border-radius:8px;overflow:hidden;">
          <tr><td style="padding:10px;color:#6b7280;">Order ID</td><td style="padding:10px;text-align:right;font-weight:700;">#{order.id}</td></tr>
          <tr><td style="padding:10px;color:#6b7280;">Payment method</td><td style="padding:10px;text-align:right;">{html.escape(_payment_label(order))}</td></tr>
          <tr><td style="padding:10px;color:#6b7280;">Payment status</td><td style="padding:10px;text-align:right;">{html.escape(_payment_status_label(order))}</td></tr>
          <tr><td style="padding:10px;color:#6b7280;">Order status</td><td style="padding:10px;text-align:right;">{html.escape(order.status.value.title())}</td></tr>
          <tr><td style="padding:10px;color:#6b7280;">Total</td><td style="padding:10px;text-align:right;font-size:18px;font-weight:700;color:#15945b;">{html.escape(_format_money(order.total_amount))}</td></tr>
        </table>

        <h2 style="font-size:16px;margin:22px 0 10px;">Items</h2>
        <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;">
          <thead>
            <tr style="background:#f3f4f6;">
              <th style="padding:10px;text-align:left;">Product</th>
              <th style="padding:10px;text-align:center;">Qty</th>
              <th style="padding:10px;text-align:right;">Unit</th>
              <th style="padding:10px;text-align:right;">Line total</th>
            </tr>
          </thead>
          <tbody>{_item_rows_html(order)}</tbody>
        </table>

        <h2 style="font-size:16px;margin:22px 0 10px;">Customer</h2>
        <p style="line-height:1.6;margin:0;">
          {customer_name}<br>
          {html.escape(order.user.email)}<br>
          {html.escape(order.user.phone or 'Not provided')}
        </p>

        <h2 style="font-size:16px;margin:22px 0 10px;">Shipping Address</h2>
        <p style="line-height:1.6;margin:0;">{address_html}</p>

        <div style="margin-top:22px;padding:14px;background:#ecfdf5;border:1px solid #bbf7d0;border-radius:8px;color:#065f46;">
          {html.escape(next_steps)}
        </div>

        <p style="margin-top:22px;color:#6b7280;font-size:13px;">For help, reply to this email with Order #{order.id}.</p>
      </div>
    </div>
  </body>
</html>"""


def _send_email_sync(to_email: str, subject: str, text_body: str, html_body: str) -> None:
    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = formataddr((settings.SMTP_FROM_NAME, settings.SMTP_FROM_EMAIL))
    message["To"] = to_email
    message.set_content(text_body)
    message.add_alternative(html_body, subtype="html")

    if settings.SMTP_USE_SSL:
        context = ssl.create_default_context()
        with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, context=context, timeout=20) as smtp:
            if settings.SMTP_USERNAME:
                smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            smtp.send_message(message)
        return

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=20) as smtp:
        if settings.SMTP_USE_TLS:
            smtp.starttls(context=ssl.create_default_context())
        if settings.SMTP_USERNAME:
            smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
        smtp.send_message(message)


async def _load_order(db: AsyncSession, order_id: int) -> Order | None:
    result = await db.execute(
        select(Order)
        .where(Order.id == order_id)
        .options(
            selectinload(Order.user),
            selectinload(Order.address),
            selectinload(Order.items).selectinload(OrderItem.product),
        )
    )
    return result.scalar_one_or_none()


async def send_order_emails(db: AsyncSession, order_id: int) -> None:
    if not _smtp_configured():
        logger.info("Order email skipped: SMTP settings are not configured.")
        return

    order = await _load_order(db, order_id)
    if not order:
        logger.warning("Order email skipped: order {} not found.", order_id)
        return

    emails: list[tuple[str, str, bool]] = [
        (order.user.email, f"Your Plantoga order #{order.id}", False),
    ]
    if settings.ADMIN_ORDER_EMAIL.strip():
        emails.append((settings.ADMIN_ORDER_EMAIL, f"New order received: #{order.id}", True))

    for to_email, subject, for_admin in emails:
        try:
            await asyncio.to_thread(
                _send_email_sync,
                to_email,
                subject,
                _build_text_template(order, for_admin=for_admin),
                _build_html_template(order, for_admin=for_admin),
            )
        except Exception as exc:
            logger.error("Order email failed for order {} recipient {}: {}", order.id, to_email, exc)
        else:
            logger.info("Order email sent for order {} recipient {}.", order.id, to_email)


# ---------------------------------------------------------------------------
# Damage Claim Emails
# ---------------------------------------------------------------------------

async def send_damage_claim_submitted_emails(
    db: AsyncSession, claim_id: int
) -> None:
    """Send emails to customer and admin when a damage claim is submitted."""
    if not _smtp_configured():
        logger.info("Damage claim email skipped: SMTP settings are not configured.")
        return

    from app.db.models import DamageClaim, OrderItem

    result = await db.execute(
        select(DamageClaim)
        .where(DamageClaim.id == claim_id)
        .options(
            selectinload(DamageClaim.user),
            selectinload(DamageClaim.order).selectinload(Order.items).selectinload(OrderItem.product),
            selectinload(DamageClaim.order).selectinload(Order.address),
        )
    )
    claim = result.scalar_one_or_none()
    if not claim:
        logger.warning("Damage claim email skipped: claim {} not found.", claim_id)
        return

    # Customer email
    customer_text = f"""Damage Claim Submitted — {claim.ticket_id}

Hi {claim.user.full_name}, we've received your damage claim.

Claim Reference: {claim.ticket_id}
Order ID: #{claim.order_id}
Issue Type: {claim.issue_type}
Description: {claim.description}

Our team will review your claim within 24-48 hours and contact you via email with next steps.

For any questions, reply to this email with your ticket reference {claim.ticket_id}.
"""

    customer_html = f"""<!doctype html>
<html>
<body style="margin:0;background:#f6f7f4;font-family:Arial,sans-serif;color:#111827;">
  <div style="max-width:680px;margin:0 auto;padding:24px;">
    <div style="background:#1B4332;color:#ffffff;padding:22px;border-radius:10px 10px 0 0;">
      <div style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#d8f3dc;">Plantoga Damage Claim</div>
      <h1 style="margin:8px 0 0;font-size:24px;">Claim Submitted</h1>
    </div>
    <div style="background:#ffffff;padding:24px;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 10px 10px;">
      <p style="font-size:16px;line-height:1.5;margin:0 0 18px;">Hi {html.escape(claim.user.full_name)}, we've received your damage claim.</p>
      
      <table style="width:100%;border-collapse:collapse;margin:0 0 20px;background:#f9fafb;border-radius:8px;overflow:hidden;">
        <tr><td style="padding:10px;color:#6b7280;">Ticket Reference</td><td style="padding:10px;text-align:right;font-weight:700;">{html.escape(claim.ticket_id)}</td></tr>
        <tr><td style="padding:10px;color:#6b7280;">Order ID</td><td style="padding:10px;text-align:right;">#{claim.order_id}</td></tr>
        <tr><td style="padding:10px;color:#6b7280;">Issue Type</td><td style="padding:10px;text-align:right;">{html.escape(claim.issue_type)}</td></tr>
      </table>

      <div style="margin-top:22px;padding:14px;background:#ecfdf5;border:1px solid #bbf7d0;border-radius:8px;color:#065f46;">
        Our team will review your claim within 24-48 hours and contact you via email with next steps.
      </div>

      <p style="margin-top:22px;color:#6b7280;font-size:13px;">For any questions, reply to this email with your ticket reference {html.escape(claim.ticket_id)}.</p>
    </div>
  </div>
</body>
</html>"""

    # Admin email
    item_list = ", ".join(
        (item.product.name if item.product else f"Product #{item.product_id}")
        for item in claim.order.items[:3]
    )
    if len(claim.order.items) > 3:
        item_list += f" +{len(claim.order.items) - 3} more"

    admin_text = f"""🚨 New Damage Claim Received

Ticket ID: {claim.ticket_id}
Order ID: #{claim.order_id}
Customer: {claim.user.full_name} ({claim.user.email})
Issue Type: {claim.issue_type}

Description:
{claim.description}

Order Items: {item_list}

Photos uploaded: {len(claim.photo_keys)} file(s)

Review and respond in the admin panel.
"""

    admin_html = f"""<!doctype html>
<html>
<body style="margin:0;background:#fef2f2;font-family:Arial,sans-serif;color:#111827;">
  <div style="max-width:680px;margin:0 auto;padding:24px;">
    <div style="background:#dc2626;color:#ffffff;padding:22px;border-radius:10px 10px 0 0;">
      <h1 style="margin:0;font-size:24px;">🚨 New Damage Claim</h1>
    </div>
    <div style="background:#ffffff;padding:24px;border:1px solid #fee2e2;border-top:0;border-radius:0 0 10px 10px;">
      <table style="width:100%;border-collapse:collapse;margin:0 0 20px;">
        <tr><td style="padding:8px 0;color:#6b7280;font-weight:600;">Ticket ID</td><td style="padding:8px 0;text-align:right;font-weight:700;color:#dc2626;">{html.escape(claim.ticket_id)}</td></tr>
        <tr><td style="padding:8px 0;color:#6b7280;font-weight:600;">Order ID</td><td style="padding:8px 0;text-align:right;">#{claim.order_id}</td></tr>
        <tr><td style="padding:8px 0;color:#6b7280;font-weight:600;">Customer</td><td style="padding:8px 0;text-align:right;">{html.escape(claim.user.full_name)}<br><span style="color:#9ca3af;font-size:13px;">{html.escape(claim.user.email)}</span></td></tr>
        <tr><td style="padding:8px 0;color:#6b7280;font-weight:600;">Issue Type</td><td style="padding:8px 0;text-align:right;">{html.escape(claim.issue_type)}</td></tr>
        <tr><td style="padding:8px 0;color:#6b7280;font-weight:600;">Photos</td><td style="padding:8px 0;text-align:right;">{len(claim.photo_keys)} file(s)</td></tr>
      </table>

      <div style="background:#f9fafb;padding:14px;border-radius:8px;margin-bottom:20px;">
        <div style="font-weight:600;color:#6b7280;margin-bottom:6px;">Description:</div>
        <div style="line-height:1.6;">{html.escape(claim.description)}</div>
      </div>

      <div style="background:#f9fafb;padding:14px;border-radius:8px;">
        <div style="font-weight:600;color:#6b7280;margin-bottom:6px;">Order Items:</div>
        <div style="line-height:1.6;">{html.escape(item_list)}</div>
      </div>

      <p style="margin-top:22px;color:#6b7280;font-size:13px;">Review and respond in the admin panel.</p>
    </div>
  </div>
</body>
</html>"""

    # Send customer email
    try:
        await asyncio.to_thread(
            _send_email_sync,
            claim.user.email,
            f"Damage Claim {claim.ticket_id} — Under Review",
            customer_text,
            customer_html,
        )
        logger.info("Damage claim customer email sent for claim {}.", claim.ticket_id)
    except Exception as exc:
        logger.error("Damage claim customer email failed for {}: {}", claim.ticket_id, exc)

    # Send admin email
    if settings.ADMIN_ORDER_EMAIL.strip():
        try:
            await asyncio.to_thread(
                _send_email_sync,
                settings.ADMIN_ORDER_EMAIL,
                f"🚨 New Damage Claim — {claim.ticket_id}",
                admin_text,
                admin_html,
            )
            logger.info("Damage claim admin email sent for claim {}.", claim.ticket_id)
        except Exception as exc:
            logger.error("Damage claim admin email failed for {}: {}", claim.ticket_id, exc)


async def send_damage_claim_status_update_email(
    db: AsyncSession, claim_id: int, new_status: str
) -> None:
    """Send email to customer when claim status changes (approved, rejected, etc)."""
    if not _smtp_configured():
        logger.info("Damage claim status email skipped: SMTP settings are not configured.")
        return

    from app.db.models import DamageClaim

    result = await db.execute(
        select(DamageClaim)
        .where(DamageClaim.id == claim_id)
        .options(selectinload(DamageClaim.user))
    )
    claim = result.scalar_one_or_none()
    if not claim:
        logger.warning("Damage claim status email skipped: claim {} not found.", claim_id)
        return

    status_messages = {
        "approved": ("✅ Claim Approved", "Great news! Your damage claim has been approved.", "We'll ship your replacement or process your refund soon."),
        "rejected": ("❌ Claim Rejected", "We've reviewed your damage claim.", f"Unfortunately, we cannot approve it at this time. {claim.admin_notes or 'Please contact us for more details.'}"),
        "replacement_shipped": ("📦 Replacement Shipped", "Your replacement has shipped!", "You'll receive tracking details shortly."),
        "refund_issued": ("💵 Refund Issued", "Your refund has been processed.", "The amount will reflect in your account within 5-7 business days."),
        "closed": ("🔒 Claim Closed", "Your damage claim has been closed.", "Thank you for your patience."),
    }

    if new_status not in status_messages:
        logger.info("No email template for status {}. Skipping notification.", new_status)
        return

    subject_suffix, heading, body = status_messages[new_status]
    
    text_body = f"""Damage Claim Update — {claim.ticket_id}

{heading}

Ticket Reference: {claim.ticket_id}
Order ID: #{claim.order_id}
New Status: {new_status.replace('_', ' ').title()}

{body}

For questions, reply to this email with your ticket reference {claim.ticket_id}.
"""

    html_body = f"""<!doctype html>
<html>
<body style="margin:0;background:#f6f7f4;font-family:Arial,sans-serif;color:#111827;">
  <div style="max-width:680px;margin:0 auto;padding:24px;">
    <div style="background:#1B4332;color:#ffffff;padding:22px;border-radius:10px 10px 0 0;">
      <div style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#d8f3dc;">Plantoga Damage Claim</div>
      <h1 style="margin:8px 0 0;font-size:24px;">{subject_suffix}</h1>
    </div>
    <div style="background:#ffffff;padding:24px;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 10px 10px;">
      <p style="font-size:16px;line-height:1.5;margin:0 0 18px;">{html.escape(heading)}</p>
      
      <table style="width:100%;border-collapse:collapse;margin:0 0 20px;background:#f9fafb;border-radius:8px;overflow:hidden;">
        <tr><td style="padding:10px;color:#6b7280;">Ticket Reference</td><td style="padding:10px;text-align:right;font-weight:700;">{html.escape(claim.ticket_id)}</td></tr>
        <tr><td style="padding:10px;color:#6b7280;">Order ID</td><td style="padding:10px;text-align:right;">#{claim.order_id}</td></tr>
        <tr><td style="padding:10px;color:#6b7280;">New Status</td><td style="padding:10px;text-align:right;font-weight:700;">{html.escape(new_status.replace('_', ' ').title())}</td></tr>
      </table>

      <div style="margin-top:22px;padding:14px;background:#ecfdf5;border:1px solid #bbf7d0;border-radius:8px;color:#065f46;">
        {html.escape(body)}
      </div>

      <p style="margin-top:22px;color:#6b7280;font-size:13px;">For questions, reply to this email with your ticket reference {html.escape(claim.ticket_id)}.</p>
    </div>
  </div>
</body>
</html>"""

    try:
        await asyncio.to_thread(
            _send_email_sync,
            claim.user.email,
            f"Damage Claim {claim.ticket_id} — {subject_suffix}",
            text_body,
            html_body,
        )
        logger.info("Damage claim status update email sent for claim {} status {}.", claim.ticket_id, new_status)
    except Exception as exc:
        logger.error("Damage claim status email failed for {} status {}: {}", claim.ticket_id, new_status, exc)
