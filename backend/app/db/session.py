"""Database session management and engine configuration.
Provides both synchronous engine and session factory for scripts, seeding, and migrations.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from app.core.config import settings

engine_kwargs = {"echo": False}
if "sqlite" in settings.sync_database_url:
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    engine_kwargs.update({
        "pool_size": settings.DB_POOL_SIZE,
        "max_overflow": settings.DB_MAX_OVERFLOW,
        "pool_timeout": settings.DB_POOL_TIMEOUT,
        "pool_recycle": settings.DB_POOL_RECYCLE,
        "pool_pre_ping": settings.DB_POOL_PRE_PING,
    })

sync_engine = create_engine(
    settings.sync_database_url,
    **engine_kwargs
)

SyncSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=sync_engine
)

def get_sync_db():
    """Yields a managed synchronous database session and guarantees cleanup upon exit."""
    db: Session = SyncSessionLocal()
    try:
        yield db
    finally:
        db.close()
