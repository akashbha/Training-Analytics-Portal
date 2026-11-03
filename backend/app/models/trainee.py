"""SQLAlchemy 2.0 ORM model for trainees enrolled in batches.
Represents individual learners linked to a cohort, indexed on batch_id for fast analytics filtering.
Includes personal details (phone, bio, specialization, avatar_url, github_url).
"""

from typing import List, Optional, TYPE_CHECKING
from sqlalchemy import Integer, String, Text, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

if TYPE_CHECKING:
    from app.models.batch import Batch
    from app.models.session import Session
    from app.models.user import User

class Trainee(Base):
    __tablename__ = "trainees"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    batch_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("batches.id", ondelete="CASCADE"),
        nullable=False
    )
    phone: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    bio: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    specialization: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    avatar_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    github_url: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    batch: Mapped["Batch"] = relationship("Batch", back_populates="trainees")
    sessions: Mapped[List["Session"]] = relationship(
        "Session",
        back_populates="trainee",
        cascade="all, delete-orphan"
    )
    user: Mapped[Optional["User"]] = relationship(
        "User",
        back_populates="trainee",
        uselist=False
    )

    __table_args__ = (
        Index("ix_trainees_batch_id", "batch_id"),
    )

    def __repr__(self) -> str:
        return f"<Trainee(id={self.id}, name='{self.name}', batch_id={self.batch_id})>"
