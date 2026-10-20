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
from app.routers import auth, batches, trainees, modules, sessions, analytics, realtime, admin

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Executes startup safety assertions and graceful shutdown actions."""
    settings.validate_production_secret()
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

@app.get("/health", tags=["System"])
def health_check():
    """System liveness probe returning application and environment status."""
    return {
        "status": "healthy",
        "project": settings.PROJECT_NAME,
        "environment": settings.ENVIRONMENT
    }
