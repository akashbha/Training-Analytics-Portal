"""SQLAlchemy 2.0 ORM model for private messaging between trainees and trainers.
Enforces non-self messaging check constraint, relational linkage to user accounts,
and composite indexing for high-performance thread timeline queries.
"""

from datetime import datetime
from typing import Optional, TYPE_CHECKING
from sqlalchemy import Integer, String, ForeignKey, DateTime, CheckConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User

class Message(Base):
    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    sender_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    recipient_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    body: Mapped[str] = mapped_column(String(500), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        index=True
    )
    read_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )

    sender: Mapped["User"] = relationship("User", foreign_keys=[sender_id])
    recipient: Mapped["User"] = relationship("User", foreign_keys=[recipient_id])

    __table_args__ = (
        CheckConstraint("sender_id != recipient_id", name="chk_message_not_self"),
        CheckConstraint("length(trim(body)) > 0", name="chk_message_body_non_empty"),
        CheckConstraint("length(body) <= 500", name="chk_message_body_max_length"),
        Index("ix_messages_sender_recipient_created", "sender_id", "recipient_id", "created_at"),
    )

    def __repr__(self) -> str:
        return f"<Message(id={self.id}, sender_id={self.sender_id}, recipient_id={self.recipient_id})>"

