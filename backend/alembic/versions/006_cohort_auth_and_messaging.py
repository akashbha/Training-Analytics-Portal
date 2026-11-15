"""Cohort authorization, batch trainers, messages, and token revocation.

Revision ID: 006_cohort_auth_and_messaging
Revises: 005_remediation_notes_and_goals
Create Date: 2026-11-14 22:25:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "006_cohort_auth_and_messaging"
down_revision = "005_remediation_notes_and_goals"
branch_labels = None
depends_on = None

def upgrade() -> None:
    # 1. batch_trainers
    op.create_table(
        "batch_trainers",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("batch_id", sa.Integer(), sa.ForeignKey("batches.id", ondelete="CASCADE"), nullable=False),
        sa.Column("trainer_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("assigned_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("batch_id", "trainer_id", name="uq_batch_trainer"),
    )
    op.create_index("ix_batch_trainers_id", "batch_trainers", ["id"])
    op.create_index("ix_batch_trainers_batch_id", "batch_trainers", ["batch_id"])
    op.create_index("ix_batch_trainers_trainer_id", "batch_trainers", ["trainer_id"])
    op.create_index("ix_batch_trainers_batch_trainer", "batch_trainers", ["batch_id", "trainer_id"])

    # 2. messages
    op.create_table(
        "messages",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("channel", sa.String(length=20), nullable=False),
        sa.Column("sender_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("recipient_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=True),
        sa.Column("batch_id", sa.Integer(), sa.ForeignKey("batches.id", ondelete="CASCADE"), nullable=True),
        sa.Column("body", sa.String(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "(channel = 'private' AND recipient_id IS NOT NULL AND batch_id IS NULL) OR "
            "(channel = 'batch' AND recipient_id IS NULL AND batch_id IS NOT NULL)",
            name="chk_message_channel_targets"
        ),
        sa.CheckConstraint("recipient_id IS NULL OR sender_id != recipient_id", name="chk_message_not_self"),
        sa.CheckConstraint("body IS NULL OR length(trim(body)) > 0", name="chk_message_body_non_empty"),
        sa.CheckConstraint("body IS NULL OR length(body) <= 500", name="chk_message_body_max_length"),
    )
    op.create_index("ix_messages_id", "messages", ["id"])
    op.create_index("ix_messages_channel", "messages", ["channel"])
    op.create_index("ix_messages_sender_id", "messages", ["sender_id"])
    op.create_index("ix_messages_recipient_id", "messages", ["recipient_id"])
    op.create_index("ix_messages_batch_id", "messages", ["batch_id"])
    op.create_index("ix_messages_created_at", "messages", ["created_at"])
    op.create_index("ix_messages_batch_created", "messages", ["batch_id", "created_at"])
    op.create_index("ix_messages_sender_recipient_created", "messages", ["sender_id", "recipient_id", "created_at"])

    # 3. message_attachments
    op.create_table(
        "message_attachments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("message_id", sa.Integer(), sa.ForeignKey("messages.id", ondelete="CASCADE"), nullable=False),
        sa.Column("original_filename", sa.String(length=255), nullable=False),
        sa.Column("stored_path", sa.String(length=500), nullable=False),
        sa.Column("mime_type", sa.String(length=100), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("uploaded_by", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_message_attachments_id", "message_attachments", ["id"])
    op.create_index("ix_message_attachments_message_id", "message_attachments", ["message_id"])

    # 4. revoked_tokens
    op.create_table(
        "revoked_tokens",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("jti", sa.String(length=64), unique=True, nullable=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("revoked_at", sa.DateTime(), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=True),
        sa.Column("reason", sa.String(length=50), nullable=False, server_default="logout"),
    )
    op.create_index("ix_revoked_tokens_id", "revoked_tokens", ["id"])
    op.create_index("ix_revoked_tokens_jti", "revoked_tokens", ["jti"])
    op.create_index("ix_revoked_tokens_user_id", "revoked_tokens", ["user_id"])
    op.create_index("ix_revoked_tokens_expires_at", "revoked_tokens", ["expires_at"])

def downgrade() -> None:
    op.drop_table("revoked_tokens")
    op.drop_table("message_attachments")
    op.drop_table("messages")
    op.drop_table("batch_trainers")

