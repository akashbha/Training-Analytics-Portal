"""Test suite for Step 5: CSV Import with dry run and atomic rollback.
Verifies:
- POST /sessions/import?dry_run=true: dry run writes nothing to the database.
- POST /sessions/import (dry_run=false): one bad row rolls back all rows atomically.
- Clean file inserts all rows in one transaction and writes audit logs.
- Duplicate rows within the same import file are caught and reported as errors.
- Files exceeding 2,000 rows are rejected with HTTP 400.
- Files exceeding 1 MB are rejected with HTTP 400.
"""

import io
import pytest
from app.models.module import Module
from app.models.session import Session
from app.models.audit_log import AuditLog
from app.core.security import create_access_token


def get_trainer_headers():
    token = create_access_token(data={"sub": "10", "role": "trainer", "trainee_id": None})
    return {"Authorization": f"Bearer {token}"}


def test_dry_run_writes_nothing(client, db_session):
    """Dry run validates rows and returns preview without inserting any database records."""
    headers = get_trainer_headers()
    mod = Module(name="DryRun Module", max_score=100.0)
    db_session.add(mod)
    db_session.commit()

    initial_session_count = db_session.query(Session).count()

    csv_content = (
        "trainee_email,module_name,score,errors,time_seconds,created_at\n"
        "alice.walker@test.internal,DryRun Module,85.0,2,1200,2026-03-10T10:00:00Z\n"
        "bob.davis@test.internal,DryRun Module,90.0,0,1500,2026-03-10T11:00:00Z\n"
    )
    files = {"file": ("dry_run.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")}

    res = client.post("/sessions/import?dry_run=true", files=files, headers=headers)
    assert res.status_code == 200
    data = res.json()

    assert data["success"] is True
    assert data["dry_run"] is True
    assert data["total_rows"] == 2
    assert data["valid_rows"] == 2
    assert data["error_count"] == 0
    assert len(data["errors"]) == 0
    assert len(data["rows"]) == 2

    # Database state must be completely untouched
    final_session_count = db_session.query(Session).count()
    assert final_session_count == initial_session_count


def test_one_bad_row_rolls_back_all_rows(client, db_session):
    """When dry_run=false, a single invalid row rolls back the entire batch atomically."""
    headers = get_trainer_headers()
    mod = Module(name="Rollback Module", max_score=100.0)
    db_session.add(mod)
    db_session.commit()

    initial_session_count = db_session.query(Session).count()

    # Row 2 is valid, Row 3 has score 150 which exceeds module max_score of 100
    csv_content = (
        "trainee_email,module_name,score,errors,time_seconds,created_at\n"
        "alice.walker@test.internal,Rollback Module,80.0,1,1200,2026-03-11T10:00:00Z\n"
        "bob.davis@test.internal,Rollback Module,150.0,0,1500,2026-03-11T11:00:00Z\n"
    )
    files = {"file": ("bad_row.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")}

    res = client.post("/sessions/import?dry_run=false", files=files, headers=headers)
    assert res.status_code == 400
    data = res.json()

    assert data["success"] is False
    assert data["dry_run"] is False
    assert data["total_rows"] == 2
    assert data["valid_rows"] == 1
    assert data["error_count"] == 1
    assert len(data["errors"]) == 1
    assert data["errors"][0]["row"] == 3
    assert "exceeds" in data["errors"][0]["error"]

    # Even the valid row must NOT have been inserted
    final_session_count = db_session.query(Session).count()
    assert final_session_count == initial_session_count


def test_clean_file_inserts_all_rows(client, db_session):
    """When dry_run=false and all rows are valid, commit all rows and write one audit log row per session."""
    headers = get_trainer_headers()
    mod = Module(name="Clean Module", max_score=100.0)
    db_session.add(mod)
    db_session.commit()

    initial_session_count = db_session.query(Session).count()

    csv_content = (
        "trainee_email,module_name,score,errors,time_seconds,created_at\n"
        "alice.walker@test.internal,Clean Module,88.0,1,900,2026-03-12T10:00:00Z\n"
        "bob.davis@test.internal,Clean Module,76.5,3,1400,2026-03-12T11:00:00Z\n"
    )
    files = {"file": ("clean.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")}

    res = client.post("/sessions/import?dry_run=false", files=files, headers=headers)
    assert res.status_code == 200
    data = res.json()

    assert data["success"] is True
    assert data["dry_run"] is False
    assert data["total_rows"] == 2
    assert data["valid_rows"] == 2
    assert data["error_count"] == 0

    # Verify both sessions were committed
    final_session_count = db_session.query(Session).count()
    assert final_session_count == initial_session_count + 2

    # Verify audit logs were written for both sessions
    audit_logs = db_session.query(AuditLog).filter(
        AuditLog.entity_type == "session",
        AuditLog.action == "create"
    ).order_by(AuditLog.id.desc()).limit(2).all()
    assert len(audit_logs) == 2
    assert audit_logs[0].details.get("source") == "csv_import"
    assert audit_logs[1].details.get("source") == "csv_import"


def test_duplicate_rows_within_file_are_caught(client, db_session):
    """Duplicate trainee + module + date combinations within the same import file are flagged as errors."""
    headers = get_trainer_headers()
    mod = Module(name="Infile Dup Module", max_score=100.0)
    db_session.add(mod)
    db_session.commit()

    # Both rows reference alice for the same module on the same calendar day (2026-03-13)
    csv_content = (
        "trainee_email,module_name,score,errors,time_seconds,created_at\n"
        "alice.walker@test.internal,Infile Dup Module,80.0,0,1000,2026-03-13T09:00:00Z\n"
        "alice.walker@test.internal,Infile Dup Module,85.0,1,1100,2026-03-13T15:00:00Z\n"
    )
    files = {"file": ("dup_file.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")}

    res = client.post("/sessions/import?dry_run=true", files=files, headers=headers)
    assert res.status_code == 200
    data = res.json()

    assert data["success"] is False
    assert data["total_rows"] == 2
    assert data["valid_rows"] == 1
    assert data["error_count"] == 1
    assert data["errors"][0]["row"] == 3
    assert "Duplicate session" in data["errors"][0]["error"]
    assert "within the import file" in data["errors"][0]["error"]


def test_file_over_row_limit_rejected(client):
    """CSV files exceeding 2,000 data rows are rejected with HTTP 400."""
    headers = get_trainer_headers()

    # Create CSV header + 2001 data rows
    rows = ["trainee_email,module_name,score,errors,time_seconds,created_at"]
    for i in range(2001):
        rows.append(f"alice.walker@test.internal,Python Fundamentals,80,0,600,2026-01-01T10:00:00Z")
    csv_content = "\n".join(rows)

    files = {"file": ("oversized_rows.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")}
    res = client.post("/sessions/import?dry_run=true", files=files, headers=headers)

    assert res.status_code == 400
    assert "2,000" in res.json()["error"]["message"]


def test_file_over_size_limit_rejected(client):
    """CSV files exceeding 1 MB in payload size are rejected with HTTP 400."""
    headers = get_trainer_headers()

    # 1 MB + 1024 bytes
    large_payload = b"a" * (1024 * 1024 + 1024)
    files = {"file": ("huge.csv", io.BytesIO(large_payload), "text/csv")}

    res = client.post("/sessions/import?dry_run=true", files=files, headers=headers)
    assert res.status_code == 400
    assert "1 MB" in res.json()["error"]["message"]

