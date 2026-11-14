"""SQLAlchemy 2.0 ORM models for structured DevOps Learning Paths and Curriculum.
Enforces decoupled domain tracking for subjects, modules, lessons, video playback progress,
and trainer-reviewed capstone assignments.
"""

from datetime import datetime
from typing import List, Optional, TYPE_CHECKING
from sqlalchemy import Integer, String, Text, Boolean, ForeignKey, DateTime, Index, UniqueConstraint, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.db.base import Base

if TYPE_CHECKING:
    from app.models.trainee import Trainee
    from app.models.user import User


class LearningSubject(Base):
    __tablename__ = "learning_subjects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(150), nullable=False)
    slug: Mapped[str] = mapped_column(String(150), unique=True, index=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    icon: Mapped[str] = mapped_column(String(50), default="terminal", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now()
    )

    modules: Mapped[List["LearningModule"]] = relationship(
        "LearningModule",
        back_populates="subject",
        cascade="all, delete-orphan",
        order_by="LearningModule.order_index"
    )

    def __repr__(self) -> str:
        return f"<LearningSubject(id={self.id}, title='{self.title}', slug='{self.slug}')>"


class LearningModule(Base):
    __tablename__ = "learning_modules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    subject_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("learning_subjects.id", ondelete="CASCADE"),
        nullable=False
    )
    title: Mapped[str] = mapped_column(String(150), nullable=False)
    slug: Mapped[str] = mapped_column(String(150), nullable=False, index=True)
    order_index: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_required: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    subject: Mapped["LearningSubject"] = relationship("LearningSubject", back_populates="modules")
    lessons: Mapped[List["LearningLesson"]] = relationship(
        "LearningLesson",
        back_populates="module",
        cascade="all, delete-orphan",
        order_by="LearningLesson.order_index"
    )
    assignment: Mapped[Optional["LearningAssignment"]] = relationship(
        "LearningAssignment",
        back_populates="module",
        uselist=False,
        cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_learning_modules_subject_order", "subject_id", "order_index"),
    )

    def __repr__(self) -> str:
        return f"<LearningModule(id={self.id}, title='{self.title}', order={self.order_index})>"


class LearningLesson(Base):
    __tablename__ = "learning_lessons"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    module_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("learning_modules.id", ondelete="CASCADE"),
        nullable=False
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    video_relative_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    subtitle_relative_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    duration_seconds: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    companion_files: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    requires_practice: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    module: Mapped["LearningModule"] = relationship("LearningModule", back_populates="lessons")
    progress_records: Mapped[List["LearningProgress"]] = relationship(
        "LearningProgress",
        back_populates="lesson",
        cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_learning_lessons_module_order", "module_id", "order_index"),
    )

    def __repr__(self) -> str:
        return f"<LearningLesson(id={self.id}, title='{self.title}', order={self.order_index})>"


class LearningProgress(Base):
    __tablename__ = "learning_progress"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    trainee_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("trainees.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    lesson_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("learning_lessons.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    watched_seconds: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    last_watched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now()
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )

    trainee: Mapped["Trainee"] = relationship("Trainee")
    lesson: Mapped["LearningLesson"] = relationship("LearningLesson", back_populates="progress_records")

    __table_args__ = (
        UniqueConstraint("trainee_id", "lesson_id", name="uq_trainee_lesson_progress"),
        Index("ix_learning_progress_trainee_completed", "trainee_id", "is_completed"),
    )


class LearningAssignment(Base):
    __tablename__ = "learning_assignments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    module_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("learning_modules.id", ondelete="CASCADE"),
        unique=True,
        nullable=False
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    instructions: Mapped[str] = mapped_column(Text, nullable=False)
    starter_files_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    max_score: Mapped[int] = mapped_column(Integer, default=100, nullable=False)
    passing_score: Mapped[int] = mapped_column(Integer, default=70, nullable=False)
    is_required: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    module: Mapped["LearningModule"] = relationship("LearningModule", back_populates="assignment")
    submissions: Mapped[List["LearningSubmission"]] = relationship(
        "LearningSubmission",
        back_populates="assignment",
        cascade="all, delete-orphan"
    )


class LearningSubmission(Base):
    __tablename__ = "learning_submissions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    assignment_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("learning_assignments.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    trainee_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("trainees.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    status: Mapped[str] = mapped_column(String(30), default="submitted", nullable=False)  # submitted, under_review, needs_changes, passed, failed
    commands_used: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    explanation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    file_attachments: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    trainer_feedback: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    reviewer_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True
    )
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now()
    )
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )

    assignment: Mapped["LearningAssignment"] = relationship("LearningAssignment", back_populates="submissions")
    trainee: Mapped["Trainee"] = relationship("Trainee")
    reviewer: Mapped[Optional["User"]] = relationship("User")

    __table_args__ = (
        Index("ix_learning_submission_trainee_assignment", "trainee_id", "assignment_id"),
        Index("ix_learning_submission_status", "status"),
    )

