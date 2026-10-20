"""Add admin role, is_active flag, sessions.created_by, and audit_logs table.

Revision ID: 003_add_admin_and_audit
Revises: 002_analytics_indexes
Create Date: 2026-10-07 10:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "003_add_admin_and_audit"
down_revision = "002_analytics_indexes"
branch_labels = None
depends_on = None

def upgrade() -> None:
    # 1. Update users table: role constraint check and add is_active column
    with op.batch_alter_table("users") as batch_op:
        try:
            batch_op.drop_constraint("chk_user_role_valid", type_="check")
        except Exception:
            pass
        batch_op.create_check_constraint(
            "chk_user_role_valid",
            "role IN ('admin', 'trainer', 'trainee')"
        )
        batch_op.add_column(
            sa.Column(
                "is_active",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("true")
            )
        )

    # 2. Update sessions table: add created_by nullable foreign key to users
    with op.batch_alter_table("sessions") as batch_op:
        batch_op.add_column(
            sa.Column(
                "created_by",
                sa.Integer(),
                sa.ForeignKey("users.id", ondelete="SET NULL"),
                nullable=True
            )
        )
        batch_op.create_index("ix_sessions_created_by", ["created_by"])

    # 3. Create audit_logs table
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("action", sa.String(length=100), nullable=False),
        sa.Column("entity_type", sa.String(length=50), nullable=False),
        sa.Column("entity_id", sa.Integer(), nullable=True),
        sa.Column("details", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_audit_logs_id", "audit_logs", ["id"])
    op.create_index("ix_audit_logs_user_id", "audit_logs", ["user_id"])
    op.create_index("ix_audit_logs_action", "audit_logs", ["action"])
    op.create_index("ix_audit_logs_entity_type", "audit_logs", ["entity_type"])
    op.create_index("ix_audit_logs_created_at", "audit_logs", ["created_at"])

def downgrade() -> None:
    op.drop_table("audit_logs")

    with op.batch_alter_table("sessions") as batch_op:
        batch_op.drop_index("ix_sessions_created_by")
        batch_op.drop_column("created_by")

    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_column("is_active")
        try:
            batch_op.drop_constraint("chk_user_role_valid", type_="check")
        except Exception:
            pass
        batch_op.create_check_constraint(
            "chk_user_role_valid",
            "role IN ('trainer', 'trainee')"
        )
