"""Application configuration settings using pydantic-settings.
Provides environment-based configuration for database connection strings, JWT security, and production guards.
"""

from pydantic_settings import BaseSettings
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

    @property
    def sync_database_url(self) -> str:
        """Returns a synchronous database URL for psycopg2/SQLAlchemy sync engine."""
        url = self.DATABASE_URL
        if url.startswith("postgresql+asyncpg://"):
            return url.replace("postgresql+asyncpg://", "postgresql+psycopg2://")
        if url.startswith("postgres://"):
            return url.replace("postgres://", "postgresql+psycopg2://")
        return url

    @model_validator(mode="after")
    def validate_production_secret(self) -> "Settings":
        """Refuses to start in production if the default insecure secret key is used."""
        if self.ENVIRONMENT.lower() == "production" and (
            not self.SECRET_KEY or self.SECRET_KEY == DEFAULT_INSECURE_SECRET
        ):
            raise ValueError(
                "CRITICAL SECURITY ERROR: SECRET_KEY must be explicitly set to a strong secret in production."
            )
        return self

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
