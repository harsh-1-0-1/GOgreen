from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.rate_limit import limiter
from app.db.session import get_db
from app.schemas.health import HealthResponse
from app.utils.redis import ping_redis

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
@limiter.exempt
async def health_check(db: AsyncSession = Depends(get_db)) -> HealthResponse:
    db_status = "ok"
    try:
        await db.execute(text("SELECT 1"))
    except Exception:
        db_status = "unavailable"

    redis_ok = await ping_redis()

    return HealthResponse(
        status="ok" if db_status == "ok" else "degraded",
        db=db_status,
        redis="ok" if redis_ok else "unavailable",
        version=settings.APP_VERSION,
    )
