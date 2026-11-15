"""Trainee profile and audit enhancements.

Revision ID: 004_trainee_profile_and_audit_enhancements
Revises: 003_add_admin_and_audit
Create Date: 2026-11-14 22:15:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "004_trainee_profile_and_audit_enhancements"
down_revision = "003_add_admin_and_audit"
branch_labels = None
depends_on = None

def upgrade() -> None:
    # 1. Trainee profile fields
    with op.batch_alter_table("trainees") as batch_op:
        batch_op.add_column(sa.Column("phone", sa.String(length=40), nullable=True))
        batch_op.add_column(sa.Column("bio", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("specialization", sa.String(length=120), nullable=True))
        batch_op.add_column(sa.Column("avatar_url", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("github_url", sa.String(length=255), nullable=True))

    # 2. Audit log actor and state snapshot fields
    with op.batch_alter_table("audit_logs") as batch_op:
        batch_op.add_column(
            sa.Column(
                "actor_id",
                sa.Integer(),
                sa.ForeignKey("users.id", ondelete="SET NULL", name="fk_audit_logs_actor_id"),
                nullable=True
            )
        )
        batch_op.add_column(
            sa.Column(
                "timestamp",
                sa.DateTime(timezone=True),
                server_default=sa.func.now(),
                nullable=False
            )
        )
        batch_op.add_column(sa.Column("before", sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column("after", sa.JSON(), nullable=True))
        batch_op.create_index("ix_audit_logs_actor_id", ["actor_id"])
        batch_op.create_index("ix_audit_logs_timestamp", ["timestamp"])

def downgrade() -> None:
    with op.batch_alter_table("audit_logs") as batch_op:
        batch_op.drop_index("ix_audit_logs_timestamp")
        batch_op.drop_index("ix_audit_logs_actor_id")
        batch_op.drop_column("after")
        batch_op.drop_column("before")
        batch_op.drop_column("timestamp")
        batch_op.drop_column("actor_id")

    with op.batch_alter_table("trainees") as batch_op:
        batch_op.drop_column("github_url")
        batch_op.drop_column("avatar_url")
        batch_op.drop_column("specialization")
        batch_op.drop_column("bio")
        batch_op.drop_column("phone")
