from slowapi import Limiter

from app.core.cdn import get_real_client_ip
from app.core.config import settings

limiter = Limiter(
    key_func=get_real_client_ip,
    default_limits=["60/minute"],
    storage_uri=settings.REDIS_URL,
    in_memory_fallback_enabled=True,
)
