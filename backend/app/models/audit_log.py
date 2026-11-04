"""SQLAlchemy 2.0 ORM model for security audit logs.
Tracks administrative lifecycle actions, user modifications, and entity mutations for compliance audits.
Strictly append-only at the application layer with actor_id, before, and after state snapshots.
"""

from datetime import datetime
from typing import Optional, Any
from sqlalchemy import Integer, String, ForeignKey, DateTime, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.db.base import Base

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    actor_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    user_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True,
        index=True
    )
    action: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    entity_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, index=True)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        index=True
    )
    before: Mapped[Optional[Any]] = mapped_column(JSON, nullable=True)
    after: Mapped[Optional[Any]] = mapped_column(JSON, nullable=True)
    details: Mapped[Optional[Any]] = mapped_column(JSON, nullable=True)

    user = relationship("User", foreign_keys=[actor_id])

    def __repr__(self) -> str:
        return f"<AuditLog(id={self.id}, actor_id={self.actor_id}, action='{self.action}', entity='{self.entity_type}#{self.entity_id}')>"

