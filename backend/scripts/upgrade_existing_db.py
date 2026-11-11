"""Idempotent non-destructive schema upgrade script for existing databases.

Applies missing tables registered in app.models and safely adds post-003 columns
on audit_logs and remediations without dropping or resetting existing data.
Works from either the repository root or the backend/ directory.
"""

from pathlib import Path
import sys

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy import inspect, text
import app.models  # noqa: F401 - registers all ORM models with Base.metadata
from app.db.base import Base
from app.db.session import sync_engine


def _existing_columns(inspector, table_name: str) -> set[str]:
    if not inspector.has_table(table_name):
        return set()
    return {col["name"] for col in inspector.get_columns(table_name)}


def _existing_indexes(inspector, table_name: str) -> set[str]:
    if not inspector.has_table(table_name):
        return set()
    return {idx["name"] for idx in inspector.get_indexes(table_name) if idx.get("name")}


def upgrade_existing_database() -> None:
    """Creates missing tables and adds missing post-003 columns non-destructively."""
    dialect = sync_engine.dialect.name
    dt_type = "TIMESTAMP WITH TIME ZONE" if dialect == "postgresql" else "DATETIME"
    json_type = "JSONB" if dialect == "postgresql" else "JSON"
    float_type = "DOUBLE PRECISION" if dialect == "postgresql" else "FLOAT"

    # 1. Create any entirely missing tables (batch_trainers, messages, message_attachments, remediations, etc.)
    Base.metadata.create_all(bind=sync_engine)

    # 2. Add missing columns on pre-existing tables without modifying existing data
    inspector = inspect(sync_engine)
    added_items: list[str] = []

    with sync_engine.begin() as conn:
        audit_cols = _existing_columns(inspector, "audit_logs")
        audit_idx = _existing_indexes(inspector, "audit_logs")
        audit_additions = [
            ("actor_id", "INTEGER REFERENCES users(id) ON DELETE SET NULL"),
            ("timestamp", dt_type),
            ("before", json_type),
            ("after", json_type),
        ]
        for col_name, col_type in audit_additions:
            if audit_cols and col_name not in audit_cols:
                conn.execute(text(f"ALTER TABLE audit_logs ADD COLUMN {col_name} {col_type}"))
                added_items.append(f"audit_logs.{col_name}")

        if "timestamp" not in audit_cols and "created_at" in audit_cols:
            conn.execute(
                text("UPDATE audit_logs SET timestamp = created_at WHERE timestamp IS NULL")
            )
        if "actor_id" not in audit_cols and "user_id" in audit_cols:
            conn.execute(
                text("UPDATE audit_logs SET actor_id = user_id WHERE actor_id IS NULL")
            )

        if inspector.has_table("audit_logs"):
            if "ix_audit_logs_actor_id" not in audit_idx:
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_audit_logs_actor_id ON audit_logs (actor_id)"))
            if "ix_audit_logs_timestamp" not in audit_idx:
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_audit_logs_timestamp ON audit_logs (timestamp)"))

        rem_cols = _existing_columns(inspector, "remediations")
        rem_additions = [
            ("status", "VARCHAR(50) NOT NULL DEFAULT 'Pending'"),
            ("completed_at", dt_type),
            ("completion_notes", "VARCHAR(500)"),
            ("reassessment_score", float_type),
            ("resolved_at", dt_type),
            ("resolved_by", "INTEGER REFERENCES users(id) ON DELETE SET NULL"),
        ]
        for col_name, col_type in rem_additions:
            if rem_cols and col_name not in rem_cols:
                conn.execute(text(f"ALTER TABLE remediations ADD COLUMN {col_name} {col_type}"))
                added_items.append(f"remediations.{col_name}")

    final_tables = sorted(inspect(sync_engine).get_table_names())
    print(f"Schema upgrade complete ({dialect}).")
    print(f"Added missing columns: {added_items or 'none'}")
    print(f"Verified tables ({len(final_tables)}): {', '.join(final_tables)}")


if __name__ == "__main__":
    upgrade_existing_database()
