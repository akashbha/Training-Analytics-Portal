"""SQLAlchemy 2.0 ORM model for private and batch messaging.
Enforces non-self messaging, channel target integrity check constraints,
relational linkage to user accounts, and composite indexing.
"""

from datetime import datetime
from typing import Optional, TYPE_CHECKING
from sqlalchemy import Integer, String, ForeignKey, DateTime, CheckConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.batch import Batch
    from app.models.message_attachment import MessageAttachment

class Message(Base):
    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    channel: Mapped[str] = mapped_column(
        String(20),
        default="private",
        server_default="private",
        nullable=False,
        index=True
    )
    sender_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    recipient_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True,
        index=True
    )
    batch_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("batches.id", ondelete="CASCADE"),
        nullable=True,
        index=True
    )
    body: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
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
    recipient: Mapped[Optional["User"]] = relationship("User", foreign_keys=[recipient_id])
    batch: Mapped[Optional["Batch"]] = relationship("Batch", foreign_keys=[batch_id])
    attachments: Mapped[list["MessageAttachment"]] = relationship(
        "MessageAttachment",
        back_populates="message",
        cascade="all, delete-orphan",
        order_by="MessageAttachment.created_at.asc()"
    )

    __table_args__ = (
        CheckConstraint(
            "(channel = 'private' AND recipient_id IS NOT NULL AND batch_id IS NULL) OR "
            "(channel = 'batch' AND recipient_id IS NULL AND batch_id IS NOT NULL)",
            name="chk_message_channel_targets"
        ),
        CheckConstraint(
            "recipient_id IS NULL OR sender_id != recipient_id",
            name="chk_message_not_self"
        ),
        CheckConstraint(
            "body IS NULL OR length(trim(body)) > 0",
            name="chk_message_body_non_empty"
        ),
        CheckConstraint(
            "body IS NULL OR length(body) <= 500",
            name="chk_message_body_max_length"
        ),
        Index("ix_messages_sender_recipient_created", "sender_id", "recipient_id", "created_at"),
        Index("ix_messages_batch_created", "batch_id", "created_at"),
    )

    def __repr__(self) -> str:
        return f"<Message(id={self.id}, channel='{self.channel}', sender_id={self.sender_id}, recipient_id={self.recipient_id}, batch_id={self.batch_id})>"
