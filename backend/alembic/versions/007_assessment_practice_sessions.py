"""Assessment practice sessions flag and filtering indexes.

Revision ID: 007_assessment_practice_sessions
Revises: 006_cohort_auth_and_messaging
Create Date: 2026-11-14 22:30:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "007_assessment_practice_sessions"
down_revision = "006_cohort_auth_and_messaging"
branch_labels = None
depends_on = None

def upgrade() -> None:
    with op.batch_alter_table("sessions") as batch_op:
        batch_op.add_column(
            sa.Column(
                "is_practice",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("false")
            )
        )
        batch_op.create_index("ix_sessions_trainee_is_practice", ["trainee_id", "is_practice"])

def downgrade() -> None:
    with op.batch_alter_table("sessions") as batch_op:
        batch_op.drop_index("ix_sessions_trainee_is_practice")
        batch_op.drop_column("is_practice")

