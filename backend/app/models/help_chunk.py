"""SQLAlchemy 2.0 ORM model for documentation chunks used in the grounded help assistant.
Stores segmented markdown sections, evaluation metrics, and grading constants with role tags.
"""

from datetime import datetime
from sqlalchemy import Integer, String, Text, DateTime, CheckConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from app.db.base import Base

class HelpChunk(Base):
    __tablename__ = "help_chunks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    source_path: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    heading: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="all", index=True)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now()
    )

    __table_args__ = (
        CheckConstraint("length(trim(text)) > 0", name="chk_help_chunk_text_non_empty"),
        CheckConstraint("length(text) <= 2000", name="chk_help_chunk_text_max_length"),
        CheckConstraint("role IN ('trainer', 'trainee', 'admin', 'all')", name="chk_help_chunk_role_valid"),
        Index("ix_help_chunks_source_role", "source_path", "role"),
    )

    def __repr__(self) -> str:
        return f"<HelpChunk(id={self.id}, source='{self.source_path}', heading='{self.heading}', role='{self.role}')>"

