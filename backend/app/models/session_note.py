"""SQLAlchemy 2.0 ORM model for trainer feedback notes on assessment sessions.
Stores session notes with author attribution, timestamp, and length constraint.
"""

from datetime import datetime
from typing import TYPE_CHECKING
from sqlalchemy import Integer, String, ForeignKey, DateTime, CheckConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.db.base import Base

if TYPE_CHECKING:
    from app.models.session import Session
    from app.models.user import User

class SessionNote(Base):
    __tablename__ = "session_notes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    session_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    author_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    text: Mapped[str] = mapped_column(String(300), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        index=True
    )

    session: Mapped["Session"] = relationship("Session", back_populates="notes")
    author: Mapped["User"] = relationship("User", foreign_keys=[author_id])

    __table_args__ = (
        CheckConstraint("length(text) <= 300", name="chk_session_note_text_length"),
        Index("ix_session_notes_session_created", "session_id", "created_at"),
    )

    def __repr__(self) -> str:
        return f"<SessionNote(id={self.id}, session_id={self.session_id}, author_id={self.author_id})>"
