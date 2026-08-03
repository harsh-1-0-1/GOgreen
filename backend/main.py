import asyncio
import os
import time
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from loguru import logger
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from sqlalchemy.exc import IntegrityError

import app.core.logging as _  # noqa: F401 – initialise loguru sinks
from app.api.middleware import CloudFrontGateMiddleware
from app.api.v1.router import api_router
from app.core.config import settings
from app.core.rate_limit import limiter
from app.core.tasks import cleanup_abandoned_orders
from app.utils.image_upload import ImageStorageUnavailableError
from app.utils.redis import close_redis, init_redis
from app.utils.variant_pricing import StockMapMissingError


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncGenerator[None, None]:
    logger.info("Starting up {}", settings.APP_NAME)
    await init_redis()

    # Start background tasks
    cleanup_task = asyncio.create_task(cleanup_abandoned_orders())

    yield

    logger.info("Shutting down {}", settings.APP_NAME)
    cleanup_task.cancel()
    try:
        await cleanup_task
    except asyncio.CancelledError:
        pass

    await close_redis()


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(SlowAPIMiddleware)
app.add_middleware(CloudFrontGateMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_origin_regex=settings.CORS_ORIGIN_REGEX or None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    duration_ms = (time.perf_counter() - start) * 1000
    logger.info(
        "{method} {path} → {status} ({dur:.1f}ms)",
        method=request.method,
        path=request.url.path,
        status=response.status_code,
        dur=duration_ms,
    )
    return response


@app.exception_handler(HTTPException)
async def http_exception_handler(_request: Request, exc: HTTPException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
    )


@app.exception_handler(ImageStorageUnavailableError)
async def image_storage_unavailable_handler(
    _request: Request, exc: ImageStorageUnavailableError
) -> JSONResponse:
    logger.error("Image storage unavailable: {}", exc)
    return JSONResponse(
        status_code=503,
        content={"error": "Image upload service unavailable"},
    )


@app.exception_handler(IntegrityError)
async def integrity_error_handler(_request: Request, exc: IntegrityError) -> JSONResponse:
    # This handler is a backstop for any IntegrityError that isn't caught at the
    # endpoint level (e.g. from routers that don't have explicit IntegrityError handling).
    # Product endpoints catch it themselves first so the session rollback happens
    # at the right layer — this handler will never fire for those routes unless
    # something slips through after all retries are exhausted.
    orig = str(exc.orig) if exc.orig else str(exc)
    logger.warning("IntegrityError on {}: {}", _request.url.path, orig)

    # Only surface constraint/column names for slug violations, which are safe to
    # expose (no schema detail, just the duplicate value the client already sent).
    # Everything else gets a generic message — column names and FK targets stay
    # server-side in the log.
    if "ix_products_slug" in orig or ("unique" in orig.lower() and "slug" in orig.lower()):
        first_line = orig.split("\n")[0]
        return JSONResponse(status_code=409, content={"detail": first_line})

    return JSONResponse(
        status_code=409,
        content={"detail": "A database constraint was violated. Check your input and try again."},
    )


@app.exception_handler(StockMapMissingError)
async def stock_map_missing_handler(_request: Request, exc: StockMapMissingError) -> JSONResponse:
    # A variant_groups product is missing its stock_map / combo row. This is a
    # deployment/migration bug, not a client error — surface a distinct, greppable
    # error code instead of a generic trace or a silent wrong-answer path.
    logger.error("Stock map missing: {}", exc)
    return JSONResponse(
        status_code=500,
        content={"detail": StockMapMissingError.error_code},
    )


@app.exception_handler(Exception)
async def general_exception_handler(_request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled exception: {}", exc)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


os.makedirs("static/banners", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

app.include_router(api_router)
