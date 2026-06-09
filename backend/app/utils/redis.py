import json
from typing import Any

import redis.asyncio as aioredis
from redis.exceptions import RedisError
from loguru import logger

from app.core.config import settings

redis_client: aioredis.Redis | None = None


async def _disable_redis(reason: Exception) -> None:
    global redis_client
    logger.warning("Redis unavailable; disabling cache: {}", reason)
    if redis_client:
        try:
            await redis_client.aclose()
        except Exception:
            pass
    redis_client = None


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
        await _disable_redis(e)


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
    except (OSError, RedisError) as e:
        await _disable_redis(e)
    return False


async def cache_get(key: str) -> Any | None:
    if not redis_client:
        return None
    try:
        raw = await redis_client.get(key)
    except (OSError, RedisError) as e:
        await _disable_redis(e)
        return None
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
    try:
        await redis_client.set(key, payload, ex=ttl)
    except (OSError, RedisError) as e:
        await _disable_redis(e)


async def cache_delete(key: str) -> None:
    if not redis_client:
        return
    try:
        await redis_client.delete(key)
    except (OSError, RedisError) as e:
        await _disable_redis(e)


async def cache_delete_pattern(pattern: str) -> None:
    """Delete all keys matching a glob pattern (e.g. 'products:*')."""
    if not redis_client:
        return
    cursor: int | bytes = 0
    while True:
        try:
            cursor, keys = await redis_client.scan(cursor=cursor, match=pattern, count=100)
            if keys:
                await redis_client.delete(*keys)
            if cursor == 0:
                break
        except (OSError, RedisError) as e:
            await _disable_redis(e)
            break
