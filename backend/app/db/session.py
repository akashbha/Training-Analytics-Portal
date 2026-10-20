"""Database session management and engine configuration.
Provides both synchronous engine and session factory for scripts, seeding, and migrations.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from app.core.config import settings

sync_engine = create_engine(
    settings.sync_database_url,
    pool_pre_ping=True,
    echo=False
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
