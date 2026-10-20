"""Central export registry for all SQLAlchemy ORM models.
Ensures unified metadata discovery for Alembic migrations, test harnesses, and seed scripts.
"""

from app.db.base import Base
from app.models.batch import Batch
from app.models.trainee import Trainee
from app.models.module import Module
from app.models.session import Session
from app.models.user import User
from app.models.audit_log import AuditLog

__all__ = ["Base", "Batch", "Trainee", "Module", "Session", "User", "AuditLog"]
