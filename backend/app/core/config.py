"""Application configuration settings using pydantic-settings.
Provides environment-based configuration for database connection strings, JWT security, and production guards.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, model_validator
import os

DEFAULT_INSECURE_SECRET = "insecure-development-default-secret-key-change-in-production"

class Settings(BaseSettings):
    PROJECT_NAME: str = "Training Analytics Portal"
    ENVIRONMENT: str = Field(default=os.getenv("ENVIRONMENT", "development"))
    DATABASE_URL: str = Field(
        default=os.getenv(
            "DATABASE_URL",
            "postgresql+psycopg2://postgres:postgres@localhost:5432/training_portal"
        )
    )
    SECRET_KEY: str = Field(
        default=os.getenv("SECRET_KEY", DEFAULT_INSECURE_SECRET)
    )
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(
        default=int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
    )
    ALLOWED_ORIGINS: str = Field(
        default=os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
    )
    MEDIA_STORAGE_PATH: str = Field(
        default=os.getenv(
            "MEDIA_STORAGE_PATH",
            os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "media", "Docker Course"))
        ),
        description="Directory containing course video and media assets"
    )

    # Production Database Connection Pooling Settings
    DB_POOL_SIZE: int = Field(default=int(os.getenv("DB_POOL_SIZE", "10")))
    DB_MAX_OVERFLOW: int = Field(default=int(os.getenv("DB_MAX_OVERFLOW", "20")))
    DB_POOL_TIMEOUT: int = Field(default=int(os.getenv("DB_POOL_TIMEOUT", "30")))
    DB_POOL_RECYCLE: int = Field(default=int(os.getenv("DB_POOL_RECYCLE", "1800")))
    DB_POOL_PRE_PING: bool = Field(default=bool(os.getenv("DB_POOL_PRE_PING", "True").lower() in ("true", "1")))

    @property
    def sync_database_url(self) -> str:
        """Returns a synchronous database URL for psycopg2/SQLAlchemy sync engine."""
        url = self.DATABASE_URL
        if "sqlite:///./training_portal.db" in url and not os.path.exists("./training_portal.db") and os.path.exists("backend/training_portal.db"):
            return "sqlite:///./backend/training_portal.db"
        if url.startswith("postgresql+asyncpg://"):
            return url.replace("postgresql+asyncpg://", "postgresql+psycopg2://")
        if url.startswith("postgres://"):
            return url.replace("postgres://", "postgresql+psycopg2://")
        return url

    @model_validator(mode="after")
    def validate_production_configuration(self) -> "Settings":
        """Enforces critical production security assertions."""
        if self.ENVIRONMENT.lower() in ("production", "staging"):
            if not self.SECRET_KEY or self.SECRET_KEY == DEFAULT_INSECURE_SECRET:
                raise ValueError(
                    "CRITICAL SECURITY ERROR: SECRET_KEY must be explicitly set to a strong secret in production."
                )
            if len(self.SECRET_KEY) < 32 or "change-me" in self.SECRET_KEY.lower():
                raise ValueError(
                    "CRITICAL SECURITY ERROR: SECRET_KEY must be at least 32 characters and not contain placeholder values."
                )
            if self.DATABASE_URL.startswith("sqlite"):
                raise ValueError(
                    "CRITICAL CONFIGURATION ERROR: SQLite is prohibited in production/staging environments. PostgreSQL is required."
                )
            if "*" in [o.strip() for o in self.ALLOWED_ORIGINS.split(",")]:
                raise ValueError(
                    "CRITICAL SECURITY ERROR: Wildcard CORS ('*') is prohibited in production."
                )
        return self

    def validate_production_secret(self) -> "Settings":
        """Backward-compatible alias for lifespan assertions."""
        return self.validate_production_configuration()

    model_config = SettingsConfigDict(
        env_file=[
            os.path.join(os.path.dirname(__file__), "..", "..", ".env"),
            ".env"
        ],
        extra="ignore"
    )

settings = Settings()
