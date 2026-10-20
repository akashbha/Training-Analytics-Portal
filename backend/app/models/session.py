"""SQLAlchemy 2.0 ORM model for trainee assessment sessions.
Records performance metrics with strict check constraints and composite indexing for timeline analytics.
"""

from datetime import datetime
from typing import Optional, TYPE_CHECKING
from sqlalchemy import Integer, Float, ForeignKey, DateTime, Index, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.db.base import Base

if TYPE_CHECKING:
    from app.models.trainee import Trainee
    from app.models.module import Module
    from app.models.user import User

class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    trainee_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("trainees.id", ondelete="CASCADE"),
        nullable=False
    )
    module_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("modules.id", ondelete="CASCADE"),
        nullable=False
    )
    score: Mapped[float] = mapped_column(Float, nullable=False)
    errors: Mapped[int] = mapped_column(Integer, nullable=False)
    time_seconds: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now()
    )
    created_by: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )

    trainee: Mapped["Trainee"] = relationship("Trainee", back_populates="sessions")
    module: Mapped["Module"] = relationship("Module", back_populates="sessions")
    creator: Mapped[Optional["User"]] = relationship("User", foreign_keys=[created_by])

    __table_args__ = (
        CheckConstraint("score >= 0", name="chk_session_score_non_negative"),
        CheckConstraint("errors >= 0", name="chk_session_errors_non_negative"),
        CheckConstraint("time_seconds > 0", name="chk_session_time_positive"),
        Index("ix_sessions_trainee_id_created_at", "trainee_id", "created_at"),
        Index("ix_sessions_module_id", "module_id"),
        Index("ix_sessions_created_at", "created_at"),
        Index("ix_sessions_trainee_module_created", "trainee_id", "module_id", "created_at"),
        Index("ix_sessions_created_by", "created_by"),
    )

    def __repr__(self) -> str:
        return f"<Session(id={self.id}, trainee_id={self.trainee_id}, score={self.score}, created_by={self.created_by})>"
