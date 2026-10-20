"""SQLAlchemy 2.0 ORM model for curriculum training modules.
Defines assessment modules with unique names and enforced positive maximum scores.
"""

from typing import List, TYPE_CHECKING
from sqlalchemy import Integer, String, Float, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

if TYPE_CHECKING:
    from app.models.session import Session

class Module(Base):
    __tablename__ = "modules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(150), unique=True, nullable=False, index=True)
    max_score: Mapped[float] = mapped_column(Float, nullable=False)

    sessions: Mapped[List["Session"]] = relationship(
        "Session",
        back_populates="module",
        cascade="all, delete-orphan"
    )

    __table_args__ = (
        CheckConstraint("max_score > 0", name="chk_module_max_score_positive"),
    )

    def __repr__(self) -> str:
        return f"<Module(id={self.id}, name='{self.name}', max_score={self.max_score})>"
