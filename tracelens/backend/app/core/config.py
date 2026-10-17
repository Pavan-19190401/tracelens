"""Application configuration and environment settings for TraceLens backend."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "TraceLens"
    API_V1_STR: str = "/v1"
    SECRET_KEY: str = "dev_secret_key_change_in_production_tracelens_observability"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./tracelens_dev.db"
    # For Postgres: "postgresql+asyncpg://postgres:postgres@localhost:5432/tracelens"

    # Redis
    REDIS_URL: str | None = "redis://localhost:6379/0"
    REDIS_INGEST_KEY: str = "tracelens:ingest:queue"

    # Rate Limiting
    RATE_LIMIT_PER_MINUTE: int = 10000

    # CORS
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
    ]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()
