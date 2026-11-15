"""Main FastAPI application entry point with CORS, exception handlers, and security middlewares.
Configures route dispatching, rate limit middleware, and system health status checks.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.core.config import settings
from app.core.rate_limit import limiter
from app.core.exceptions import (
    AppException,
    app_exception_handler,
    http_exception_handler,
    validation_exception_handler,
    rate_limit_handler,
    unhandled_exception_handler
)
from app.routers import auth, batches, trainees, modules, sessions, analytics, realtime, admin, remediations, messages, help, learning

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Executes startup safety assertions and lifecycle initialization.
    
    In production and staging, runtime DDL (create_all and raw SQL schema patches) is
    strictly disabled. Database schemas are managed exclusively via Alembic migrations.
    """
    settings.validate_production_configuration()

    if settings.ENVIRONMENT.lower() == "development":
        from app.db.base import Base
        from app.db.session import sync_engine
        from sqlalchemy import text
        import app.models  # noqa: F401 - ensure all models registered
        Base.metadata.create_all(bind=sync_engine)

        # Idempotent schema migration for legacy SQLite local development databases
        with sync_engine.connect() as conn:
            try:
                res = conn.execute(text("PRAGMA table_info(sessions)"))
                cols = [row[1] for row in res.fetchall()]
                if cols and "is_practice" not in cols:
                    conn.execute(text("ALTER TABLE sessions ADD COLUMN is_practice BOOLEAN NOT NULL DEFAULT 0"))
                    conn.commit()
            except Exception:
                pass
    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Backend API for Training Analytics Portal with JWT auth, CRUD operations, and live metrics.",
    version="1.0.0",
    lifespan=lifespan
)

app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)

origins = [origin.strip() for origin in settings.ALLOWED_ORIGINS.split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Uniform error handlers returning {"error": {"code": "...", "message": "..."}}
app.add_exception_handler(AppException, app_exception_handler)
app.add_exception_handler(StarletteHTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(RateLimitExceeded, rate_limit_handler)
app.add_exception_handler(Exception, unhandled_exception_handler)

# Mount Routers
app.include_router(auth.router)
app.include_router(batches.router)
app.include_router(trainees.router)
app.include_router(modules.router)
app.include_router(sessions.router)
app.include_router(analytics.router)
app.include_router(realtime.router)
app.include_router(admin.router)
app.include_router(remediations.router)
app.include_router(messages.router)
app.include_router(help.router)
app.include_router(learning.router)

@app.get("/health", tags=["System"])
def health_check():
    """System liveness probe returning application and environment status."""
    return {
        "status": "healthy",
        "project": settings.PROJECT_NAME,
        "environment": settings.ENVIRONMENT
    }
