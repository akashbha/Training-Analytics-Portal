"""Learning path foundation: subjects, modules, lessons, progress, assignments, submissions.

Revision ID: 008_learning_path_foundation
Revises: 007_assessment_practice_sessions
Create Date: 2026-11-14 22:35:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "008_learning_path_foundation"
down_revision = "007_assessment_practice_sessions"
branch_labels = None
depends_on = None

def upgrade() -> None:
    # 1. learning_subjects
    op.create_table(
        "learning_subjects",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("title", sa.String(length=150), nullable=False),
        sa.Column("slug", sa.String(length=150), nullable=False, unique=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("icon", sa.String(length=50), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_learning_subjects_id", "learning_subjects", ["id"])
    op.create_index("ix_learning_subjects_slug", "learning_subjects", ["slug"])

    # 2. learning_modules
    op.create_table(
        "learning_modules",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("subject_id", sa.Integer(), sa.ForeignKey("learning_subjects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("slug", sa.String(length=200), nullable=False),
        sa.Column("order_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_required", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )
    op.create_index("ix_learning_modules_id", "learning_modules", ["id"])
    op.create_index("ix_learning_modules_slug", "learning_modules", ["slug"])
    op.create_index("ix_learning_modules_subject_order", "learning_modules", ["subject_id", "order_index"])

    # 3. learning_lessons
    op.create_table(
        "learning_lessons",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("module_id", sa.Integer(), sa.ForeignKey("learning_modules.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("video_relative_path", sa.String(length=500), nullable=True),
        sa.Column("subtitle_relative_path", sa.String(length=500), nullable=True),
        sa.Column("duration_seconds", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("order_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("companion_files", sa.JSON(), nullable=True),
        sa.Column("requires_practice", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.create_index("ix_learning_lessons_id", "learning_lessons", ["id"])
    op.create_index("ix_learning_lessons_module_order", "learning_lessons", ["module_id", "order_index"])

    # 4. learning_progress
    op.create_table(
        "learning_progress",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("trainee_id", sa.Integer(), sa.ForeignKey("trainees.id", ondelete="CASCADE"), nullable=False),
        sa.Column("lesson_id", sa.Integer(), sa.ForeignKey("learning_lessons.id", ondelete="CASCADE"), nullable=False),
        sa.Column("watched_seconds", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_completed", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("last_watched_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("trainee_id", "lesson_id", name="uq_trainee_lesson_progress"),
    )
    op.create_index("ix_learning_progress_id", "learning_progress", ["id"])
    op.create_index("ix_learning_progress_trainee_id", "learning_progress", ["trainee_id"])
    op.create_index("ix_learning_progress_lesson_id", "learning_progress", ["lesson_id"])
    op.create_index("ix_learning_progress_trainee_completed", "learning_progress", ["trainee_id", "is_completed"])

    # 5. learning_assignments
    op.create_table(
        "learning_assignments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("module_id", sa.Integer(), sa.ForeignKey("learning_modules.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("instructions", sa.Text(), nullable=False),
        sa.Column("starter_files_url", sa.String(length=500), nullable=True),
        sa.Column("max_score", sa.Integer(), nullable=False, server_default="100"),
        sa.Column("passing_score", sa.Integer(), nullable=False, server_default="70"),
        sa.Column("is_required", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.UniqueConstraint("module_id", "title", name="uq_learning_assignment_module_title"),
    )
    op.create_index("ix_learning_assignments_id", "learning_assignments", ["id"])

    # 6. learning_submissions
    op.create_table(
        "learning_submissions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("assignment_id", sa.Integer(), sa.ForeignKey("learning_assignments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("trainee_id", sa.Integer(), sa.ForeignKey("trainees.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="submitted"),
        sa.Column("commands_used", sa.Text(), nullable=True),
        sa.Column("explanation", sa.Text(), nullable=True),
        sa.Column("file_attachments", sa.JSON(), nullable=True),
        sa.Column("score", sa.Integer(), nullable=True),
        sa.Column("trainer_feedback", sa.Text(), nullable=True),
        sa.Column("reviewer_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("submitted_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_learning_submissions_id", "learning_submissions", ["id"])
    op.create_index("ix_learning_submissions_assignment_id", "learning_submissions", ["assignment_id"])
    op.create_index("ix_learning_submissions_trainee_id", "learning_submissions", ["trainee_id"])
    op.create_index("ix_learning_submission_status", "learning_submissions", ["status"])
    op.create_index("ix_learning_submission_trainee_assignment", "learning_submissions", ["trainee_id", "assignment_id"])

def downgrade() -> None:
    op.drop_table("learning_submissions")
    op.drop_table("learning_assignments")
    op.drop_table("learning_progress")
    op.drop_table("learning_lessons")
    op.drop_table("learning_modules")
    op.drop_table("learning_subjects")

