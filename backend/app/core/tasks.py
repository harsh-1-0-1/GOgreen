import asyncio
from datetime import datetime, timedelta, timezone

from loguru import logger
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db.models import Order, OrderItem, OrderStatus
from app.db.session import async_session_factory


async def cleanup_abandoned_orders():
    """
    Background task to cancel orders that remain pending for >15 minutes
    and release their reserved stock back to the inventory.
    """
    while True:
        try:
            await asyncio.sleep(60) # Run every 60 seconds

            async with async_session_factory() as db:
                cutoff_time = datetime.now(timezone.utc) - timedelta(minutes=15)

                # Find all orders that are still pending and older than 15 minutes
                result = await db.execute(
                    select(Order)
                    .where(
                        Order.status == OrderStatus.PENDING,
                        Order.created_at < cutoff_time
                    )
                    .options(selectinload(Order.items).selectinload(OrderItem.product))
                )
                abandoned_orders = result.scalars().all()

                if not abandoned_orders:
                    continue

                logger.info("Found {} abandoned pending orders. Cancelling and restoring stock...", len(abandoned_orders))

                for order in abandoned_orders:
                    # Mark order cancelled
                    order.status = OrderStatus.CANCELLED

                    # Restore stock for each item
                    for item in order.items:
                        product = item.product
                        if not product:
                            continue

                        # If simple product
                        if not item.selected_options:
                            product.stock_qty += item.quantity
                        # If variant product
                        else:
                            details = item.selected_options
                            combo_key = None
                            if "size" in details and "color" in details and "pot" in details:
                                combo_key = f"{details['size']}|{details['color']}|{details['pot']}"

                            if combo_key and product.variants and "stock" in product.variants:
                                variants = product.variants
                                current_stock = int(variants["stock"].get(combo_key, 0))
                                variants["stock"][combo_key] = current_stock + item.quantity
                                product.variants = variants
                                product.stock_qty = sum(int(v or 0) for v in variants.get("stock", {}).values())
                                from sqlalchemy.orm.attributes import flag_modified
                                flag_modified(product, "variants")

                await db.commit()
                logger.info("Successfully cancelled {} abandoned orders.", len(abandoned_orders))

        except asyncio.CancelledError:
            logger.info("Abandoned order cleanup task cancelled.")
            break
        except Exception as e:
            logger.error("Error in abandoned order cleanup task: {}", e)
            await asyncio.sleep(60) # Backoff on error
