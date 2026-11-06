"""SQLAlchemy 2.0 ORM model for batch-to-trainer assignments.
Establishes the link between training batches and assigned instructional staff.
"""

from datetime import datetime
from typing import TYPE_CHECKING
from sqlalchemy import Integer, ForeignKey, DateTime, UniqueConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.db.base import Base

if TYPE_CHECKING:
    from app.models.batch import Batch
    from app.models.user import User

class BatchTrainer(Base):
    __tablename__ = "batch_trainers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    batch_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("batches.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    trainer_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now()
    )

    batch: Mapped["Batch"] = relationship("Batch", back_populates="trainer_assignments")
    trainer: Mapped["User"] = relationship("User", foreign_keys=[trainer_id])

    __table_args__ = (
        UniqueConstraint("batch_id", "trainer_id", name="uq_batch_trainer"),
        Index("ix_batch_trainers_batch_trainer", "batch_id", "trainer_id"),
    )

    def __repr__(self) -> str:
        return f"<BatchTrainer(id={self.id}, batch_id={self.batch_id}, trainer_id={self.trainer_id})>"

