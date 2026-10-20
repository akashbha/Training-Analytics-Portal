"""SQLAlchemy 2.0 ORM model for training batches.
Tracks batch cohorts with unique names, scheduled start dates, and projected end dates.
"""

from datetime import date
from typing import List, TYPE_CHECKING
from sqlalchemy import Integer, String, Date
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

if TYPE_CHECKING:
    from app.models.trainee import Trainee

class Batch(Base):
    __tablename__ = "batches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)

    trainees: Mapped[List["Trainee"]] = relationship(
        "Trainee",
        back_populates="batch",
        cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Batch(id={self.id}, name='{self.name}')>"
