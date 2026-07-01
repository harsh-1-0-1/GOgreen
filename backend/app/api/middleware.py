from functools import wraps
from typing import Any, Callable

from fastapi import HTTPException, Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from app.core.config import settings


class CloudflareGateMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        if settings.REQUIRE_CLOUDFLARE:
            # If the request didn't come through Cloudflare, reject it.
            # Cloudflare always sets this header on proxied requests.
            if "CF-Connecting-IP" not in request.headers:
                # 403 Forbidden is standard, but you could also use 404
                # to hide the fact that an API even exists here.
                raise HTTPException(status_code=403, detail="Direct access forbidden")
        
        return await call_next(request)


def cache_control(directive: str = "public, max-age=300, stale-while-revalidate=60"):
    """
    Decorator to easily add Cache-Control headers to endpoint responses.
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args: Any, **kwargs: Any) -> Response:
            response: Response = await func(*args, **kwargs)
            response.headers["Cache-Control"] = directive
            return response
        return wrapper
    return decorator
