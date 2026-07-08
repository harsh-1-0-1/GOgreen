from pydantic import field_validator, model_validator
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
    ENVIRONMENT: str = "development"

    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_REGION: str = "us-east-1"
    AWS_S3_BUCKET: str = ""
    CDN_BASE_URL: str = ""

    DATABASE_URL: str = "sqlite+aiosqlite:///./plantoga.db"
    REDIS_URL: str = "redis://localhost:6379"
    BACKEND_PUBLIC_URL: str = "http://localhost:8000"

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

    RAZORPAY_KEY_ID: str = ""
    RAZORPAY_KEY_SECRET: str = ""
    RAZORPAY_WEBHOOK_SECRET: str = ""

    LOG_JSON: bool = False
    SLOW_QUERY_MS: int = 100

    CORS_ORIGINS: str = "http://localhost:5173"
    CORS_ORIGIN_REGEX: str = ""
    REQUIRE_CLOUDFRONT: bool = False
    CLOUDFRONT_SECRET: str = ""

    @field_validator("DEBUG", mode="before")
    @classmethod
    def parse_debug(cls, v: bool | str) -> bool:
        if isinstance(v, str):
            value = v.strip().lower()
            if value in {"release", "prod", "production", "false", "0", "no", "off"}:
                return False
            if value in {"debug", "dev", "development", "true", "1", "yes", "on"}:
                return True
        return v

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def parse_database_url(cls, v: str) -> str:
        if isinstance(v, str):
            if v.startswith("postgresql://"):
                return v.replace("postgresql://", "postgresql+asyncpg://", 1)
            if v.startswith("postgres://"):
                return v.replace("postgres://", "postgresql+asyncpg://", 1)
        return v

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors(cls, v: str | list[str]) -> str:
        if isinstance(v, list):
            return ",".join(v)
        return v or ""

    @model_validator(mode="after")
    def validate_cloudfront_secret(self) -> "Settings":
        if self.REQUIRE_CLOUDFRONT and not self.CLOUDFRONT_SECRET.strip():
            raise ValueError(
                "CLOUDFRONT_SECRET must be set when REQUIRE_CLOUDFRONT=true"
            )
        return self

    @property
    def cors_origins_list(self) -> list[str]:
        raw_origins = self.CORS_ORIGINS.strip()
        if raw_origins.startswith("[") and raw_origins.endswith("]"):
            raw_origins = raw_origins[1:-1]
        return [
            origin.strip().strip('"').strip("'")
            for origin in raw_origins.split(",")
            if origin.strip().strip('"').strip("'")
        ]


settings = Settings()
