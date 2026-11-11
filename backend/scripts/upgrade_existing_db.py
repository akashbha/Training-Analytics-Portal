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


def _upgrade_messages_table(engine, dialect: str, added_items: list[str]) -> None:
    """Ensures messages table supports batch channels (nullable recipient_id/body & v2 constraints)."""
    inspector = inspect(engine)
    if not inspector.has_table("messages"):
        return

    cols_info = {col["name"]: col for col in inspector.get_columns("messages")}
    idx_names = _existing_indexes(inspector, "messages")

    if dialect == "sqlite":
        with engine.connect() as probe_conn:
            ddl_row = probe_conn.execute(
                text("SELECT sql FROM sqlite_master WHERE type='table' AND name='messages'")
            ).fetchone()
            ddl_sql = ddl_row[0] if ddl_row and ddl_row[0] else ""
            pragma_rows = probe_conn.exec_driver_sql("PRAGMA table_info(messages)").fetchall()
            # (cid, name, type, notnull, dflt_value, pk)
            pragma_map = {r[1]: r for r in pragma_rows}

        needs_rebuild = (
            "channel" not in pragma_map
            or "batch_id" not in pragma_map
            or pragma_map.get("recipient_id", (None, None, None, 1))[3] == 1
            or pragma_map.get("body", (None, None, None, 1))[3] == 1
            or "chk_message_channel_targets" not in ddl_sql
        )
        if not needs_rebuild:
            return

        channel_expr = "COALESCE(channel, 'private')" if "channel" in pragma_map else "'private'"
        batch_id_expr = "batch_id" if "batch_id" in pragma_map else "NULL"
        recipient_expr = (
            "CASE WHEN COALESCE(channel, 'private') = 'batch' AND batch_id IS NOT NULL THEN NULL ELSE recipient_id END"
            if ("channel" in pragma_map and "batch_id" in pragma_map)
            else "recipient_id"
        )

        with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
            conn.exec_driver_sql("PRAGMA foreign_keys=OFF")
            conn.exec_driver_sql("BEGIN")
            try:
                conn.exec_driver_sql("DROP TABLE IF EXISTS messages_new")
                conn.exec_driver_sql(
                    """
                    CREATE TABLE messages_new (
                        id INTEGER NOT NULL PRIMARY KEY,
                        channel VARCHAR(20) NOT NULL DEFAULT 'private',
                        sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        recipient_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                        batch_id INTEGER REFERENCES batches(id) ON DELETE CASCADE,
                        body VARCHAR(500),
                        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        read_at DATETIME,
                        CONSTRAINT chk_message_channel_targets CHECK (
                            (channel = 'private' AND recipient_id IS NOT NULL AND batch_id IS NULL)
                            OR (channel = 'batch' AND recipient_id IS NULL AND batch_id IS NOT NULL)
                        ),
                        CONSTRAINT chk_message_not_self CHECK (recipient_id IS NULL OR sender_id != recipient_id),
                        CONSTRAINT chk_message_body_non_empty CHECK (body IS NULL OR length(trim(body)) > 0),
                        CONSTRAINT chk_message_body_max_length CHECK (body IS NULL OR length(body) <= 500)
                    )
                    """
                )
                conn.exec_driver_sql(
                    f"""
                    INSERT INTO messages_new (id, channel, sender_id, recipient_id, batch_id, body, created_at, read_at)
                    SELECT id, {channel_expr}, sender_id, {recipient_expr}, {batch_id_expr}, body, created_at, read_at
                    FROM messages
                    """
                )
                conn.exec_driver_sql("DROP TABLE messages")
                conn.exec_driver_sql("ALTER TABLE messages_new RENAME TO messages")
                for stmt in (
                    "CREATE INDEX IF NOT EXISTS ix_messages_id ON messages (id)",
                    "CREATE INDEX IF NOT EXISTS ix_messages_channel ON messages (channel)",
                    "CREATE INDEX IF NOT EXISTS ix_messages_sender_id ON messages (sender_id)",
                    "CREATE INDEX IF NOT EXISTS ix_messages_recipient_id ON messages (recipient_id)",
                    "CREATE INDEX IF NOT EXISTS ix_messages_batch_id ON messages (batch_id)",
                    "CREATE INDEX IF NOT EXISTS ix_messages_created_at ON messages (created_at)",
                    "CREATE INDEX IF NOT EXISTS ix_messages_sender_recipient_created ON messages (sender_id, recipient_id, created_at)",
                    "CREATE INDEX IF NOT EXISTS ix_messages_batch_created ON messages (batch_id, created_at)",
                ):
                    conn.exec_driver_sql(stmt)
                conn.exec_driver_sql("COMMIT")
            except Exception:
                conn.exec_driver_sql("ROLLBACK")
                raise
            finally:
                conn.exec_driver_sql("PRAGMA foreign_keys=ON")
        added_items.append("messages(v2_schema_rebuild)")
        return

    # PostgreSQL / non-SQLite non-destructive alterations
    with engine.begin() as conn:
        if "channel" not in cols_info:
            conn.execute(text("ALTER TABLE messages ADD COLUMN channel VARCHAR(20) NOT NULL DEFAULT 'private'"))
            added_items.append("messages.channel")
        if "batch_id" not in cols_info:
            conn.execute(text("ALTER TABLE messages ADD COLUMN batch_id INTEGER REFERENCES batches(id) ON DELETE CASCADE"))
            added_items.append("messages.batch_id")
        if cols_info.get("recipient_id") and not cols_info["recipient_id"].get("nullable", True):
            conn.execute(text("ALTER TABLE messages ALTER COLUMN recipient_id DROP NOT NULL"))
            added_items.append("messages.recipient_id_nullable")
        if cols_info.get("body") and not cols_info["body"].get("nullable", True):
            conn.execute(text("ALTER TABLE messages ALTER COLUMN body DROP NOT NULL"))
            added_items.append("messages.body_nullable")
        if dialect == "postgresql":
            existing_chks = {c.get("name") for c in inspector.get_check_constraints("messages")}
            if "chk_message_channel_targets" not in existing_chks:
                conn.execute(text(
                    "ALTER TABLE messages ADD CONSTRAINT chk_message_channel_targets CHECK ("
                    "(channel = 'private' AND recipient_id IS NOT NULL AND batch_id IS NULL) OR "
                    "(channel = 'batch' AND recipient_id IS NULL AND batch_id IS NOT NULL))"
                ))
            if "chk_message_not_self" in existing_chks:
                conn.execute(text("ALTER TABLE messages DROP CONSTRAINT chk_message_not_self"))
            conn.execute(text(
                "ALTER TABLE messages ADD CONSTRAINT chk_message_not_self CHECK (recipient_id IS NULL OR sender_id != recipient_id)"
            ))
        for idx_name, cols_sql in (
            ("ix_messages_channel", "channel"),
            ("ix_messages_batch_id", "batch_id"),
            ("ix_messages_sender_recipient_created", "sender_id, recipient_id, created_at"),
            ("ix_messages_batch_created", "batch_id, created_at"),
        ):
            if idx_name not in idx_names:
                conn.execute(text(f"CREATE INDEX IF NOT EXISTS {idx_name} ON messages ({cols_sql})"))


def upgrade_existing_database(engine=sync_engine) -> None:
    """Creates missing tables and adds missing post-003 columns non-destructively."""
    dialect = engine.dialect.name
    dt_type = "TIMESTAMP WITH TIME ZONE" if dialect == "postgresql" else "DATETIME"
    json_type = "JSONB" if dialect == "postgresql" else "JSON"
    float_type = "DOUBLE PRECISION" if dialect == "postgresql" else "FLOAT"

    # 1. Create any entirely missing tables (batch_trainers, messages, message_attachments, remediations, etc.)
    Base.metadata.create_all(bind=engine)

    # 2. Add missing columns on pre-existing tables without modifying existing data
    inspector = inspect(engine)
    added_items: list[str] = []

    with engine.begin() as conn:
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

    _upgrade_messages_table(engine, dialect, added_items)

    final_tables = sorted(inspect(engine).get_table_names())
    print(f"Schema upgrade complete ({dialect}).")
    print(f"Added missing columns: {added_items or 'none'}")
    print(f"Verified tables ({len(final_tables)}): {', '.join(final_tables)}")


if __name__ == "__main__":
    upgrade_existing_database()
