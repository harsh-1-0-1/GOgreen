import asyncio
from datetime import datetime, timedelta, timezone

from loguru import logger
from sqlalchemy import select
from sqlalchemy.orm import selectinload

import uuid

from app.db.models import Order, OrderItem, OrderStatus, PaymentStatus
from app.db.session import async_session_factory
from app.services import order_service
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


async def cleanup_abandoned_orders_once() -> int:
    affected_product_slugs: list[str] = []
    restored_orders = 0
    async with async_session_factory() as db:
        cutoff_time = datetime.now(timezone.utc) - timedelta(minutes=15)

        result = await db.execute(
            select(Order.id)
            .where(
                Order.status == OrderStatus.PENDING,
                Order.created_at < cutoff_time
            )
        )
        abandoned_order_ids = result.scalars().all()
        await db.rollback()

        if not abandoned_order_ids:
            return 0

        logger.info(
            "Found {} abandoned pending orders. Cancelling and restoring stock...",
            len(abandoned_order_ids),
        )

        for order_id in abandoned_order_ids:
            try:
                async with db.begin():
                    result = await db.execute(
                        select(Order)
                        .where(
                            Order.id == order_id,
                            Order.status == OrderStatus.PENDING,
                            Order.created_at < cutoff_time,
                        )
                        .options(selectinload(Order.items).selectinload(OrderItem.product))
                        .with_for_update()
                    )
                    order = result.scalar_one_or_none()
                    if not order:
                        continue

                    order.status = OrderStatus.CANCELLED
                    order.payment_status = PaymentStatus.FAILED
                    affected_product_slugs.extend(
                        await order_service.restore_order_stock(db, order)
                    )
                    restored_orders += 1
            except Exception as e:
                logger.exception(
                    "Failed to cancel abandoned order {}; continuing cleanup batch: {}",
                    order_id,
                    e,
                )
                if db.in_transaction():
                    await db.rollback()
                continue

        logger.info("Finished abandoned-order cleanup batch.")

    if affected_product_slugs:
        await order_service.invalidate_product_caches(affected_product_slugs)
    return restored_orders


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
                await cleanup_abandoned_orders_once()
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
