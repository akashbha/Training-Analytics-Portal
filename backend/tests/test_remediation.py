"""Test suite for Step 6: Remediation Record System.
Verifies:
- POST /remediations: Trainer or Admin can assign remediation and an audit log row is written.
- GET /trainees/{id}/remediations: Trainee can see own remediations only; viewing another trainee's returns HTTP 403.
- Trainee view: For each remediation, calculates average of the 3 sessions strictly before and 3 strictly after assigned_at.
- When fewer than 3 sessions exist on either side, returns the 'not enough sessions' state.
- Numbers only: No subjective effectiveness claims.
"""

from datetime import datetime, timezone
import pytest

from app.models.module import Module
from app.models.session import Session
from app.models.audit_log import AuditLog
from app.core.security import create_access_token


def get_trainer_headers():
    token = create_access_token(data={"sub": "10", "role": "trainer", "trainee_id": None})
    return {"Authorization": f"Bearer {token}"}


def get_trainee1_headers():
    token = create_access_token(data={"sub": "11", "role": "trainee", "trainee_id": 1})
    return {"Authorization": f"Bearer {token}"}


def get_trainee2_headers():
    token = create_access_token(data={"sub": "12", "role": "trainee", "trainee_id": 2})
    return {"Authorization": f"Bearer {token}"}


def test_trainer_can_create_remediation_and_writes_audit_log(client, db_session):
    """Staff can create a remediation record and an audit log row is written with snapshot."""
    headers = get_trainer_headers()
    mod = Module(name="Remediation Test Module 1", max_score=100.0)
    db_session.add(mod)
    db_session.commit()

    payload = {
        "trainee_id": 1,
        "module_id": mod.id,
        "note": "Focus on database indexing and connection pool optimization"
    }

    res = client.post("/remediations", json=payload, headers=headers)
    assert res.status_code == 201
    data = res.json()

    assert data["trainee_id"] == 1
    assert data["module_id"] == mod.id
    assert data["assigned_by"] == 10
    assert data["note"] == payload["note"]

    # Verify audit log row
    audit_row = db_session.query(AuditLog).filter(
        AuditLog.entity_type == "remediation",
        AuditLog.entity_id == data["id"],
        AuditLog.action == "create"
    ).order_by(AuditLog.id.desc()).first()

    assert audit_row is not None
    assert audit_row.actor_id == 10
    assert audit_row.before is None
    assert audit_row.after is not None
    assert audit_row.after["note"] == payload["note"]


def test_before_after_averages_with_known_data(client, db_session):
    """Calculates exact averages of the 3 sessions before and 3 after assigned_at."""
    headers = get_trainer_headers()
    mod = Module(name="Remediation Test Module 2", max_score=100.0)
    db_session.add(mod)
    db_session.commit()

    assigned_at = datetime(2026, 4, 15, 12, 0, 0, tzinfo=timezone.utc)

    # 3 sessions strictly before assigned_at: scores 70, 80, 90 (mean = 80.0)
    s_before1 = Session(trainee_id=1, module_id=mod.id, score=70.0, errors=2, time_seconds=1200, created_at=datetime(2026, 4, 10, 10, 0, 0, tzinfo=timezone.utc))
    s_before2 = Session(trainee_id=1, module_id=mod.id, score=80.0, errors=1, time_seconds=1100, created_at=datetime(2026, 4, 12, 10, 0, 0, tzinfo=timezone.utc))
    s_before3 = Session(trainee_id=1, module_id=mod.id, score=90.0, errors=0, time_seconds=1000, created_at=datetime(2026, 4, 14, 10, 0, 0, tzinfo=timezone.utc))

    # 3 sessions strictly after assigned_at: scores 85, 95, 90 (mean = 90.0)
    s_after1 = Session(trainee_id=1, module_id=mod.id, score=85.0, errors=1, time_seconds=950, created_at=datetime(2026, 4, 16, 10, 0, 0, tzinfo=timezone.utc))
    s_after2 = Session(trainee_id=1, module_id=mod.id, score=95.0, errors=0, time_seconds=900, created_at=datetime(2026, 4, 18, 10, 0, 0, tzinfo=timezone.utc))
    s_after3 = Session(trainee_id=1, module_id=mod.id, score=90.0, errors=1, time_seconds=920, created_at=datetime(2026, 4, 20, 10, 0, 0, tzinfo=timezone.utc))

    db_session.add_all([s_before1, s_before2, s_before3, s_after1, s_after2, s_after3])
    db_session.commit()

    # Create remediation
    payload = {
        "trainee_id": 1,
        "module_id": mod.id,
        "note": "Longitudinal drill evaluation",
        "assigned_at": assigned_at.isoformat()
    }
    create_res = client.post("/remediations", json=payload, headers=headers)
    assert create_res.status_code == 201

    # Fetch remediations for trainee 1
    get_res = client.get("/trainees/1/remediations", headers=headers)
    assert get_res.status_code == 200
    records = get_res.json()
    assert len(records) >= 1

    rem = next(r for r in records if r["module_id"] == mod.id)
    assert rem["before_sessions_count"] == 3
    assert rem["after_sessions_count"] == 3
    assert rem["before_average"] == 80.0
    assert rem["after_average"] == 90.0
    assert rem["before_status"] == "80.0%"
    assert rem["after_status"] == "90.0%"


def test_fewer_than_3_sessions_returns_not_enough_state(client, db_session):
    """When fewer than 3 sessions exist before or after, returns 'not enough sessions'."""
    headers = get_trainer_headers()
    mod = Module(name="Remediation Test Module 3", max_score=100.0)
    db_session.add(mod)
    db_session.commit()

    assigned_at = datetime(2026, 5, 10, 12, 0, 0, tzinfo=timezone.utc)

    # 2 sessions before (fewer than 3)
    s_before1 = Session(trainee_id=2, module_id=mod.id, score=60.0, errors=3, time_seconds=1200, created_at=datetime(2026, 5, 1, 10, 0, 0, tzinfo=timezone.utc))
    s_before2 = Session(trainee_id=2, module_id=mod.id, score=65.0, errors=2, time_seconds=1150, created_at=datetime(2026, 5, 5, 10, 0, 0, tzinfo=timezone.utc))

    # 1 session after (fewer than 3)
    s_after1 = Session(trainee_id=2, module_id=mod.id, score=75.0, errors=1, time_seconds=1000, created_at=datetime(2026, 5, 15, 10, 0, 0, tzinfo=timezone.utc))

    db_session.add_all([s_before1, s_before2, s_after1])
    db_session.commit()

    payload = {
        "trainee_id": 2,
        "module_id": mod.id,
        "note": "Early intervention",
        "assigned_at": assigned_at.isoformat()
    }
    client.post("/remediations", json=payload, headers=headers)

    get_res = client.get("/trainees/2/remediations", headers=headers)
    assert get_res.status_code == 200
    rem = next(r for r in get_res.json() if r["module_id"] == mod.id)

    assert rem["before_sessions_count"] == 2
    assert rem["after_sessions_count"] == 1
    assert rem["before_average"] is None
    assert rem["after_average"] is None
    assert rem["before_status"] == "not enough sessions"
    assert rem["after_status"] == "not enough sessions"


def test_trainee_cannot_read_another_trainees_remediations(client):
    """Trainees are forbidden from reading remediation records of other trainees."""
    t1_headers = get_trainee1_headers()

    # Trainee 1 attempts to query Trainee 2's remediations
    res = client.get("/trainees/2/remediations", headers=t1_headers)
    assert res.status_code == 403
    assert "FORBIDDEN" in res.json()["error"]["code"]


def test_trainee_can_read_own_remediations(client):
    """Trainees can view their own remediation records."""
    t1_headers = get_trainee1_headers()
    res = client.get("/trainees/1/remediations", headers=t1_headers)
    assert res.status_code == 200
    assert isinstance(res.json(), list)


def test_trainee_cannot_create_remediation(client):
    """Trainees cannot assign remediations."""
    t1_headers = get_trainee1_headers()
    payload = {"trainee_id": 1, "module_id": 1, "note": "Self assigned"}
    res = client.post("/remediations", json=payload, headers=t1_headers)
    assert res.status_code == 403
