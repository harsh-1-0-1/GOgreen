import os

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    APP_NAME: str = "Plantoga"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = False

    DATABASE_URL: str = "sqlite+aiosqlite:///./gogreen.db"

    REDIS_URL: str = "redis://localhost:6379"

    SECRET_KEY: str = "change-me-to-a-random-secret-key"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    ALGORITHM: str = "HS256"

    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""

    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/api/v1/auth/google/callback"

    PAYU_KEY: str = ""
    PAYU_SALT: str = ""

    LOG_JSON: bool = False
    SLOW_QUERY_MS: int = 100

    CORS_ORIGINS: list[str] = ["http://localhost:5173"]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors(cls, v: str | list[str]) -> list[str]:
        if isinstance(v, str):
            return [origin.strip().rstrip("/") for origin in v.strip("[]").split(",")]
        return v


settings = Settings()

if os.getenv("RAILWAY_ENVIRONMENT"):
    _vol = os.getenv("RAILWAY_VOLUME_MOUNT_PATH", "/data")
    os.makedirs(_vol, exist_ok=True)
    if settings.DATABASE_URL.startswith("sqlite"):
        settings.DATABASE_URL = f"sqlite+aiosqlite:///{_vol}/gogreen.db"
