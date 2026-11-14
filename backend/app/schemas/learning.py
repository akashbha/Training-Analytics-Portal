"""Pydantic v2 schemas for DevOps Learning Paths, Lessons, Video Streaming, and Capstone Assignments."""

from datetime import datetime
from typing import List, Optional, Any
from pydantic import BaseModel, Field, ConfigDict


class CompanionFileItem(BaseModel):
    title: str
    file_type: str  # pdf, txt, html, md
    relative_path: str


class LearningLessonSummary(BaseModel):
    id: int
    module_id: int
    title: str
    description: Optional[str] = None
    duration_seconds: int
    order_index: int
    requires_practice: bool
    is_completed: bool = False
    watched_seconds: int = 0
    companion_files: Optional[List[CompanionFileItem]] = None

    model_config = ConfigDict(from_attributes=True)


class LearningLessonDetail(LearningLessonSummary):
    has_video: bool = True
    has_subtitles: bool = True
    stream_url: str
    subtitles_url: Optional[str] = None


class LearningAssignmentSummary(BaseModel):
    id: int
    module_id: int
    title: str
    instructions: str
    starter_files_url: Optional[str] = None
    max_score: int
    passing_score: int
    is_required: bool

    model_config = ConfigDict(from_attributes=True)


class LearningSubmissionResponse(BaseModel):
    id: int
    assignment_id: int
    trainee_id: int
    trainee_name: Optional[str] = None
    trainee_email: Optional[str] = None
    status: str  # submitted, under_review, needs_changes, passed, failed
    commands_used: Optional[str] = None
    explanation: Optional[str] = None
    file_attachments: Optional[List[Any]] = None
    score: Optional[int] = None
    trainer_feedback: Optional[str] = None
    reviewer_id: Optional[int] = None
    reviewer_name: Optional[str] = None
    submitted_at: datetime
    reviewed_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class LearningSubmissionCreate(BaseModel):
    commands_used: Optional[str] = Field(None, max_length=10000)
    explanation: Optional[str] = Field(None, max_length=5000)


class LearningSubmissionReview(BaseModel):
    status: str = Field(..., pattern="^(passed|needs_changes|failed)$")
    score: Optional[int] = Field(None, ge=0, le=100)
    trainer_feedback: str = Field(..., min_length=5, max_length=3000)


class LearningModuleDetail(BaseModel):
    id: int
    subject_id: int
    title: str
    slug: str
    order_index: int
    description: Optional[str] = None
    is_required: bool
    total_lessons: int = 0
    completed_lessons: int = 0
    progress_pct: float = 0.0
    lessons: List[LearningLessonSummary] = []
    assignment: Optional[LearningAssignmentSummary] = None
    latest_submission: Optional[LearningSubmissionResponse] = None
    is_unlocked: bool = True

    model_config = ConfigDict(from_attributes=True)


class LearningSubjectDetail(BaseModel):
    id: int
    title: str
    slug: str
    description: Optional[str] = None
    icon: str = "terminal"
    is_active: bool = True
    total_modules: int = 0
    completed_modules: int = 0
    overall_progress_pct: float = 0.0
    modules: List[LearningModuleDetail] = []

    model_config = ConfigDict(from_attributes=True)


class LearningProgressUpdate(BaseModel):
    watched_seconds: int = Field(..., ge=0)
    is_completed: Optional[bool] = False


class LearningProgressResponse(BaseModel):
    lesson_id: int
    trainee_id: int
    watched_seconds: int
    is_completed: bool
    completed_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

