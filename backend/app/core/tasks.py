import asyncio
from datetime import datetime, timedelta, timezone

from loguru import logger
from sqlalchemy import select
from sqlalchemy.orm import selectinload

import uuid

from app.db.models import Order, OrderItem, OrderStatus
from app.db.session import async_session_factory
from app.utils.redis import redis_client


async def _extend_lock(lock_key: str, lock_token: str, lock_expiry: int, stop_event: asyncio.Event):
    """Periodically extend the Redis lock lease while the task runs."""
    while not stop_event.is_set():
        try:
            # Sleep for a fraction of the expiry time
            await asyncio.sleep(lock_expiry / 3)
            if stop_event.is_set():
                break

            # Lua script ensures we only extend if the key still matches our token
            lua_extend = """
            if redis.call('get', KEYS[1]) == ARGV[1] then
                return redis.call('expire', KEYS[1], ARGV[2])
            else
                return 0
            end
            """
            if redis_client:
                res = await redis_client.eval(lua_extend, 1, lock_key, lock_token, str(lock_expiry))
                if not res or int(res) == 0:
                    logger.warning("Failed to extend Redis lock {}; key expired or ownership lost", lock_key)
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.warning("Error extending Redis lock: {}", e)


async def cleanup_abandoned_orders():
    """
    Background task to cancel orders that remain pending for >15 minutes
    and release their reserved stock back to the inventory.
    """
    while True:
        try:
            await asyncio.sleep(60) # Run every 60 seconds

            # 1. Try process-level serialization via Redis lock
            lock_acquired = False
            lock_token = str(uuid.uuid4())
            lock_key = "lock:cleanup_abandoned_orders"
            lock_expiry = 30  # seconds

            if redis_client:
                try:
                    lock_acquired = await redis_client.set(
                        lock_key, lock_token, ex=lock_expiry, nx=True
                    )
                    if not lock_acquired:
                        continue
                except Exception as e:
                    logger.warning("Redis lock acquisition failed: {}", e)

            extend_task = None
            stop_extend = asyncio.Event()
            if lock_acquired and redis_client:
                extend_task = asyncio.create_task(
                    _extend_lock(lock_key, lock_token, lock_expiry, stop_extend)
                )

            try:
                async with async_session_factory() as db:
                    # Use explicit transaction block to ensure all changes commit or rollback together
                    async with db.begin():
                        cutoff_time = datetime.now(timezone.utc) - timedelta(minutes=15)

                        # Find all orders that are still pending and older than 15 minutes, lock rows
                        result = await db.execute(
                            select(Order)
                            .where(
                                Order.status == OrderStatus.PENDING,
                                Order.created_at < cutoff_time
                            )
                            .options(selectinload(Order.items).selectinload(OrderItem.product))
                            .with_for_update()
                        )
                        abandoned_orders = result.scalars().all()

                        if not abandoned_orders:
                            continue

                        logger.info("Found {} abandoned pending orders. Cancelling and restoring stock...", len(abandoned_orders))

                        for order in abandoned_orders:
                            # Double check status to prevent race condition updates
                            if order.status != OrderStatus.PENDING:
                                continue

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

                        logger.info("Successfully cancelled {} abandoned orders.", len(abandoned_orders))
            finally:
                if extend_task:
                    stop_extend.set()
                    extend_task.cancel()
                    try:
                        await extend_task
                    except asyncio.CancelledError:
                        pass

                if lock_acquired and redis_client:
                    try:
                        lua_release = """
                        if redis.call('get', KEYS[1]) == ARGV[1] then
                            return redis.call('del', KEYS[1])
                        else
                            return 0
                        end
                        """
                        await redis_client.eval(lua_release, 1, lock_key, lock_token)
                    except Exception as e:
                        logger.warning("Failed to release Redis lock: {}", e)

        except asyncio.CancelledError:
            logger.info("Abandoned order cleanup task cancelled.")
            break
        except Exception as e:
            logger.error("Error in abandoned order cleanup task: {}", e)
            await asyncio.sleep(10) # Backoff on error
