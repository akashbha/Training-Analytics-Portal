"""Remediations, trainee goals, session notes, and help chunks.

Revision ID: 005_remediation_notes_and_goals
Revises: 004_trainee_profile_and_audit_enhancements
Create Date: 2026-11-14 22:20:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "005_remediation_notes_and_goals"
down_revision = "004_trainee_profile_and_audit_enhancements"
branch_labels = None
depends_on = None

def upgrade() -> None:
    # 1. remediations
    op.create_table(
        "remediations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("trainee_id", sa.Integer(), sa.ForeignKey("trainees.id", ondelete="CASCADE"), nullable=False),
        sa.Column("module_id", sa.Integer(), sa.ForeignKey("modules.id", ondelete="CASCADE"), nullable=False),
        sa.Column("assigned_by", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("assigned_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("note", sa.String(length=500), nullable=True),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="Pending"),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completion_notes", sa.String(length=500), nullable=True),
        sa.Column("reassessment_score", sa.Float(), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolved_by", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
    )
    op.create_index("ix_remediations_id", "remediations", ["id"])
    op.create_index("ix_remediations_trainee_id", "remediations", ["trainee_id"])
    op.create_index("ix_remediations_module_id", "remediations", ["module_id"])

    # 2. trainee_goals
    op.create_table(
        "trainee_goals",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("trainee_id", sa.Integer(), sa.ForeignKey("trainees.id", ondelete="CASCADE"), nullable=False),
        sa.Column("module_id", sa.Integer(), sa.ForeignKey("modules.id", ondelete="CASCADE"), nullable=False),
        sa.Column("target_score", sa.Float(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("trainee_id", "module_id", name="uq_trainee_module_goal"),
    )
    op.create_index("ix_trainee_goals_id", "trainee_goals", ["id"])
    op.create_index("ix_trainee_goals_trainee_id", "trainee_goals", ["trainee_id"])
    op.create_index("ix_trainee_goals_module_id", "trainee_goals", ["module_id"])

    # 3. session_notes
    op.create_table(
        "session_notes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("session_id", sa.Integer(), sa.ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("author_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("text", sa.String(length=300), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("length(text) > 0 AND length(text) <= 300", name="chk_session_note_text_length"),
    )
    op.create_index("ix_session_notes_id", "session_notes", ["id"])
    op.create_index("ix_session_notes_session_id", "session_notes", ["session_id"])
    op.create_index("ix_session_notes_author_id", "session_notes", ["author_id"])
    op.create_index("ix_session_notes_created_at", "session_notes", ["created_at"])
    op.create_index("ix_session_notes_session_created", "session_notes", ["session_id", "created_at"])

    # 4. help_chunks
    op.create_table(
        "help_chunks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("source_path", sa.String(length=255), nullable=False),
        sa.Column("heading", sa.String(length=255), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("role IN ('trainee', 'trainer', 'admin', 'common')", name="chk_help_chunk_role_valid"),
        sa.CheckConstraint("length(text) > 0", name="chk_help_chunk_text_non_empty"),
        sa.CheckConstraint("length(text) <= 5000", name="chk_help_chunk_text_max_length"),
    )
    op.create_index("ix_help_chunks_id", "help_chunks", ["id"])
    op.create_index("ix_help_chunks_source_path", "help_chunks", ["source_path"])
    op.create_index("ix_help_chunks_heading", "help_chunks", ["heading"])
    op.create_index("ix_help_chunks_role", "help_chunks", ["role"])
    op.create_index("ix_help_chunks_source_role", "help_chunks", ["source_path", "role"])

def downgrade() -> None:
    op.drop_table("help_chunks")
    op.drop_table("session_notes")
    op.drop_table("trainee_goals")
    op.drop_table("remediations")

