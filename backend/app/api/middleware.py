import secrets
from typing import Callable

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse, Response

from app.core.config import settings

ORIGIN_VERIFY_HEADER = "X-Origin-Verify"
EXEMPT_PATHS = frozenset({"/api/v1/health"})


class CloudFrontGateMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        if not settings.REQUIRE_CLOUDFRONT or request.url.path in EXEMPT_PATHS:
            return await call_next(request)

        supplied_secret = request.headers.get(ORIGIN_VERIFY_HEADER, "")
        if not secrets.compare_digest(supplied_secret, settings.CLOUDFRONT_SECRET):
            return JSONResponse(
                status_code=403,
                content={"detail": "Direct access forbidden"},
            )

        return await call_next(request)
