import sys

from loguru import logger

from app.core.config import settings

logger.remove()

CONSOLE_FMT = (
    "<green>{time:YYYY-MM-DD HH:mm:ss}</green> | "
    "<level>{level: <8}</level> | "
    "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - "
    "<level>{message}</level>"
)

JSON_FMT = (
    '{{"ts":"{time:YYYY-MM-DDTHH:mm:ss.SSSZ}",'
    '"level":"{level}",'
    '"logger":"{name}:{function}:{line}",'
    '"msg":"{message}"}}'
)

fmt = JSON_FMT if settings.LOG_JSON else CONSOLE_FMT

logger.add(
    sys.stderr,
    format=fmt,
    level="DEBUG",
    colorize=not settings.LOG_JSON,
)

logger.add(
    "logs/app.log",
    rotation="10 MB",
    retention="7 days",
    compression="gz",
    format=(
        "{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | "
        "{name}:{function}:{line} - {message}"
    ),
    level="INFO",
    enqueue=True,
)
