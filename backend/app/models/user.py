"""SQLAlchemy 2.0 ORM model for user authentication and role-based access.
Stores login credentials, role constraints, active status, and optional 1-to-1 linkage to trainee profiles.
"""

from typing import Optional, TYPE_CHECKING
from sqlalchemy import Integer, String, Boolean, ForeignKey, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.db.base import Base

if TYPE_CHECKING:
    from app.models.trainee import Trainee

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, server_default=func.true())
    trainee_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("trainees.id", ondelete="SET NULL"),
        unique=True,
        nullable=True
    )

    trainee: Mapped[Optional["Trainee"]] = relationship("Trainee", back_populates="user")

    __table_args__ = (
        CheckConstraint("role IN ('admin', 'trainer', 'trainee')", name="chk_user_role_valid"),
    )

    def __repr__(self) -> str:
        return f"<User(id={self.id}, email='{self.email}', role='{self.role}', is_active={self.is_active})>"
