"""Initial schema revision creating batches, modules, trainees, sessions, and users tables.
Enforces foreign key relationships, cascade behaviors, and initial core performance indexes.
"""

from alembic import op
import sqlalchemy as sa

revision = "001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None

def upgrade() -> None:
    # 1. Batches table
    op.create_table(
        "batches",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=100), nullable=False, unique=True),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
    )
    op.create_index("ix_batches_id", "batches", ["id"])
    op.create_index("ix_batches_name", "batches", ["name"])

    # 2. Modules table
    op.create_table(
        "modules",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=150), nullable=False, unique=True),
        sa.Column("max_score", sa.Float(), nullable=False),
        sa.CheckConstraint("max_score > 0", name="chk_module_max_score_positive")
    )
    op.create_index("ix_modules_id", "modules", ["id"])
    op.create_index("ix_modules_name", "modules", ["name"])

    # 3. Trainees table
    op.create_table(
        "trainees",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False, unique=True),
        sa.Column("batch_id", sa.Integer(), sa.ForeignKey("batches.id", ondelete="CASCADE"), nullable=False),
    )
    op.create_index("ix_trainees_id", "trainees", ["id"])
    op.create_index("ix_trainees_email", "trainees", ["email"])
    op.create_index("ix_trainees_batch_id", "trainees", ["batch_id"])

    # 4. Sessions table
    op.create_table(
        "sessions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("trainee_id", sa.Integer(), sa.ForeignKey("trainees.id", ondelete="CASCADE"), nullable=False),
        sa.Column("module_id", sa.Integer(), sa.ForeignKey("modules.id", ondelete="CASCADE"), nullable=False),
        sa.Column("score", sa.Float(), nullable=False),
        sa.Column("errors", sa.Integer(), nullable=False),
        sa.Column("time_seconds", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("score >= 0", name="chk_session_score_non_negative"),
        sa.CheckConstraint("errors >= 0", name="chk_session_errors_non_negative"),
        sa.CheckConstraint("time_seconds > 0", name="chk_session_time_positive"),
    )
    op.create_index("ix_sessions_id", "sessions", ["id"])
    op.create_index("ix_sessions_trainee_id_created_at", "sessions", ["trainee_id", "created_at"])

    # 5. Users table
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("email", sa.String(length=255), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("trainee_id", sa.Integer(), sa.ForeignKey("trainees.id", ondelete="SET NULL"), unique=True, nullable=True),
        sa.CheckConstraint("role IN ('trainer', 'trainee')", name="chk_user_role_valid")
    )
    op.create_index("ix_users_id", "users", ["id"])
    op.create_index("ix_users_email", "users", ["email"])

def downgrade() -> None:
    op.drop_table("users")
    op.drop_table("sessions")
    op.drop_table("trainees")
    op.drop_table("modules")
    op.drop_table("batches")
