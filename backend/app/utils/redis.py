import json
from typing import Any

import redis.asyncio as aioredis
from loguru import logger

from app.core.config import settings

redis_client: aioredis.Redis | None = None


async def init_redis() -> None:
    global redis_client
    try:
        redis_client = aioredis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
        )
        await redis_client.ping()
        logger.info("Redis connection pool initialised")
    except Exception as e:
        logger.warning(f"Redis connection failed: {e}. Running without cache.")
        redis_client = None


async def close_redis() -> None:
    global redis_client
    if redis_client:
        await redis_client.aclose()
        redis_client = None
        logger.info("Redis connection closed")


async def ping_redis() -> bool:
    try:
        if redis_client:
            return await redis_client.ping()
    except Exception:
        logger.warning("Redis ping failed")
    return False


async def cache_get(key: str) -> Any | None:
    if not redis_client:
        return None
    raw = await redis_client.get(key)
    if raw is None:
        return None
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return raw


async def cache_set(key: str, value: Any, ttl: int = 300) -> None:
    if not redis_client:
        return
    payload = json.dumps(value) if not isinstance(value, str) else value
    await redis_client.set(key, payload, ex=ttl)


async def cache_delete(key: str) -> None:
    if not redis_client:
        return
    await redis_client.delete(key)


async def cache_delete_pattern(pattern: str) -> None:
    """Delete all keys matching a glob pattern (e.g. 'products:*')."""
    if not redis_client:
        return
    cursor: int | bytes = 0
    while True:
        cursor, keys = await redis_client.scan(cursor=cursor, match=pattern, count=100)
        if keys:
            await redis_client.delete(*keys)
        if cursor == 0:
            break
