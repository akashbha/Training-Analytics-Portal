"""Automated regression suite verifying Alembic migrations and database operations.
Tests fresh installation, stepwise upgrade/downgrade, legacy upgrade, PostgreSQL DDL generation,
and production startup security assertions.
"""

import os
import sqlite3
import subprocess
import tempfile
import pytest
from app.core.config import Settings, DEFAULT_INSECURE_SECRET
from app.db.base import Base
import app.models  # noqa: F401 - ensure all models loaded

ALEMBIC_INI_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "alembic.ini"))
PYTHON_EXE = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "venv", "Scripts", "python.exe"))
ALEMBIC_EXE = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "venv", "Scripts", "alembic.exe"))

# Fallback to sys.executable if venv path differs
if not os.path.exists(ALEMBIC_EXE):
    import sys
    PYTHON_EXE = sys.executable
    ALEMBIC_EXE = "alembic"


def run_alembic_command(*args):
    """Executes an alembic CLI command with alembic.ini configured."""
    cmd = [ALEMBIC_EXE, "-c", ALEMBIC_INI_PATH] + list(args)
    res = subprocess.run(cmd, capture_output=True, text=True)
    return res


def test_alembic_single_head():
    """Verifies Alembic history has a single head and no branching."""
    res = run_alembic_command("heads")
    assert res.returncode == 0, f"alembic heads failed: {res.stderr}"
    lines = [line.strip() for line in res.stdout.strip().splitlines() if line.strip()]
    assert len(lines) == 1, f"Expected exactly 1 migration head, got: {lines}"
    assert "008_learning_path_foundation" in lines[0]


def test_postgresql_offline_ddl_generation():
    """Verifies that Alembic generates complete, valid PostgreSQL DDL in --sql mode."""
    res = run_alembic_command(
        "-x", "url=postgresql+psycopg2://postgres:postgres@localhost:5432/training_portal",
        "upgrade", "head", "--sql"
    )
    assert res.returncode == 0, f"PostgreSQL DDL generation failed: {res.stderr}"
    assert "Context impl PostgresqlImpl" in res.stderr
    assert "CREATE TABLE alembic_version" in res.stdout
    assert "CREATE TABLE batches" in res.stdout
    assert "CREATE TABLE learning_submissions" in res.stdout
    assert "COMMIT;" in res.stdout


def test_fresh_database_migration_to_head():
    """Verifies that an empty database can be migrated to head from scratch."""
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp:
        db_path = tmp.name

    try:
        url = f"sqlite:///{db_path}"
        res = run_alembic_command("-x", f"url={url}", "upgrade", "head")
        assert res.returncode == 0, f"Fresh migration failed: {res.stderr}"

        # Verify all 20 managed tables exist
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = {row[0] for row in cursor.fetchall()}

        for expected_table in Base.metadata.tables.keys():
            assert expected_table in tables, f"Expected table '{expected_table}' missing from migrated database"

        # Verify alembic_version record
        cursor.execute("SELECT version_num FROM alembic_version")
        version = cursor.fetchone()[0]
        assert version == "008_learning_path_foundation"
        conn.close()
    finally:
        if os.path.exists(db_path):
            os.remove(db_path)


def test_stepwise_upgrade_and_downgrade():
    """Verifies stepwise upgrade, rollback, and re-upgrade cycles."""
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp:
        db_path = tmp.name

    try:
        url = f"sqlite:///{db_path}"

        # 1. Stepwise upgrade from base to head
        revisions = [
            "001_initial_schema",
            "002_analytics_indexes",
            "003_add_admin_and_audit",
            "004_trainee_profile_and_audit_enhancements",
            "005_remediation_notes_and_goals",
            "006_cohort_auth_and_messaging",
            "007_assessment_practice_sessions",
            "008_learning_path_foundation"
        ]

        for rev in revisions:
            res = run_alembic_command("-x", f"url={url}", "upgrade", rev)
            assert res.returncode == 0, f"Failed upgrading to {rev}: {res.stderr}"

        # 2. Downgrade from head down to 003_add_admin_and_audit
        for rev in reversed(revisions[2:7]):
            res = run_alembic_command("-x", f"url={url}", "downgrade", rev)
            assert res.returncode == 0, f"Failed downgrading to {rev}: {res.stderr}"

        # 3. Re-upgrade back to head
        res = run_alembic_command("-x", f"url={url}", "upgrade", "head")
        assert res.returncode == 0, f"Failed re-upgrading to head: {res.stderr}"
    finally:
        if os.path.exists(db_path):
            os.remove(db_path)


def test_upgrade_from_representative_legacy_data():
    """Verifies that an existing database with data at revision 003 upgrades without data loss."""
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp:
        db_path = tmp.name

    try:
        url = f"sqlite:///{db_path}"

        # 1. Migrate up to 003_add_admin_and_audit
        res = run_alembic_command("-x", f"url={url}", "upgrade", "003_add_admin_and_audit")
        assert res.returncode == 0, f"Failed migrating to 003: {res.stderr}"

        # 2. Insert representative legacy records
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        cur.execute("INSERT INTO batches (id, name, start_date, end_date) VALUES (1, 'Legacy Batch A', '2026-01-01', '2026-06-01')")
        cur.execute("INSERT INTO trainees (id, name, email, batch_id) VALUES (101, 'Jane Trainee', 'jane@legacy.com', 1)")
        cur.execute("INSERT INTO modules (id, name, max_score) VALUES (1, 'Docker Fundamentals', 100.0)")
        cur.execute("INSERT INTO sessions (id, trainee_id, module_id, score, errors, time_seconds, created_at) VALUES (1, 101, 1, 88.5, 2, 1200, '2026-02-01 10:00:00')")
        cur.execute("INSERT INTO users (id, email, password_hash, role, is_active) VALUES (1, 'admin@legacy.com', 'hashed_pass', 'admin', 1)")
        conn.commit()
        conn.close()

        # 3. Run migration to head
        res = run_alembic_command("-x", f"url={url}", "upgrade", "head")
        assert res.returncode == 0, f"Failed upgrading from 003 to head: {res.stderr}"

        # 4. Verify data integrity and new column defaults
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()

        # Check preserved records
        cur.execute("SELECT name, email FROM trainees WHERE id = 101")
        row = cur.fetchone()
        assert row == ("Jane Trainee", "jane@legacy.com")

        cur.execute("SELECT score, is_practice FROM sessions WHERE id = 1")
        sess_row = cur.fetchone()
        assert sess_row[0] == 88.5
        assert sess_row[1] in (0, False)  # is_practice defaulted cleanly without error

        cur.execute("SELECT version_num FROM alembic_version")
        assert cur.fetchone()[0] == "008_learning_path_foundation"
        conn.close()
    finally:
        if os.path.exists(db_path):
            os.remove(db_path)


def test_production_startup_safety_assertions():
    """Verifies that production security validations reject unsafe configurations."""
    # 1. Default insecure secret in production must fail
    with pytest.raises(ValueError, match="SECRET_KEY must be explicitly set"):
        Settings(
            ENVIRONMENT="production",
            SECRET_KEY=DEFAULT_INSECURE_SECRET,
            DATABASE_URL="postgresql+psycopg2://user:pass@localhost:5432/db",
            ALLOWED_ORIGINS="https://portal.company.com"
        )

    # 2. SQLite in production must fail
    with pytest.raises(ValueError, match="SQLite is prohibited in production"):
        Settings(
            ENVIRONMENT="production",
            SECRET_KEY="a-very-long-and-secure-custom-secret-key-32-chars",
            DATABASE_URL="sqlite:///./training_portal.db",
            ALLOWED_ORIGINS="https://portal.company.com"
        )

    # 3. Wildcard CORS in production must fail
    with pytest.raises(ValueError, match="Wildcard CORS"):
        Settings(
            ENVIRONMENT="production",
            SECRET_KEY="a-very-long-and-secure-custom-secret-key-32-chars",
            DATABASE_URL="postgresql+psycopg2://user:pass@localhost:5432/db",
            ALLOWED_ORIGINS="*"
        )

    # 4. Short secret key in production (<32 chars) must fail
    with pytest.raises(ValueError, match="at least 32 characters"):
        Settings(
            ENVIRONMENT="production",
            SECRET_KEY="short-secret-key-16-chars",
            DATABASE_URL="postgresql+psycopg2://user:pass@localhost:5432/db",
            ALLOWED_ORIGINS="https://portal.company.com"
        )

    # 5. Placeholder secret containing 'change-me' must fail
    with pytest.raises(ValueError, match="not contain placeholder values"):
        Settings(
            ENVIRONMENT="production",
            SECRET_KEY="change-me-this-is-over-32-characters-long-secret",
            DATABASE_URL="postgresql+psycopg2://user:pass@localhost:5432/db",
            ALLOWED_ORIGINS="https://portal.company.com"
        )

    # 6. Valid production configuration passes cleanly
    prod_settings = Settings(
        ENVIRONMENT="production",
        SECRET_KEY="super-secure-production-jwt-signing-secret-key-64-characters-long!",
        DATABASE_URL="postgresql+psycopg2://portal_app:app_secret@db.company.com:5432/training_portal",
        ALLOWED_ORIGINS="https://portal.company.com,https://app.company.com"
    )
    assert prod_settings.ENVIRONMENT == "production"
    assert not prod_settings.DATABASE_URL.startswith("sqlite")

