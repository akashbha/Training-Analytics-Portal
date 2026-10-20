"""Analytics optimization migration introducing EXPLAIN-friendly covering indexes.
Accelerates module joins, date range aggregations, and multi-criteria window functions.
"""

from alembic import op

revision = "002_analytics_indexes"
down_revision = "001_initial_schema"
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Index on sessions(module_id) to optimize joins with modules
    op.create_index(
        "ix_sessions_module_id",
        "sessions",
        ["module_id"]
    )
    # Index on sessions(created_at) to optimize date truncation and timeline filtering
    op.create_index(
        "ix_sessions_created_at",
        "sessions",
        ["created_at"]
    )
    # Composite covering index on (trainee_id, module_id, created_at) for trainee analytics
    op.create_index(
        "ix_sessions_trainee_module_created",
        "sessions",
        ["trainee_id", "module_id", "created_at"]
    )

def downgrade() -> None:
    op.drop_index("ix_sessions_trainee_module_created", table_name="sessions")
    op.drop_index("ix_sessions_created_at", table_name="sessions")
    op.drop_index("ix_sessions_module_id", table_name="sessions")
