"""Test suite for Step 3: Data validation and admin data-quality audit endpoint.
Verifies rejection of:
- score < 0 or score > max_score (422)
- errors < 0 (422)
- time_seconds < 0 (422)
- time_seconds > 14400 (4 hours) (422)
- duplicate trainee/module/date session (409)
Verifies allowance of:
- score == max_score (201)
- time_seconds == 14400 (201)
- different dates for same trainee/module (201)
Verifies GET /admin/data-quality:
- RBAC enforcement (admin only: 403 for trainee and trainer)
- Rule violation counting and flagged records serialization
"""

from datetime import datetime, timezone, timedelta
from app.core.constants import MAX_SESSION_TIME_SECONDS
from app.core.security import create_access_token
from app.models.batch import Batch
from app.models.trainee import Trainee
from app.models.module import Module
from app.models.session import Session


def get_admin_headers():
    token = create_access_token(data={"sub": "9", "role": "admin"})
    return {"Authorization": f"Bearer {token}"}


def get_trainer_headers():
    token = create_access_token(data={"sub": "10", "role": "trainer", "trainee_id": None})
    return {"Authorization": f"Bearer {token}"}


def get_trainee_headers(trainee_id: int = 1):
    token = create_access_token(data={"sub": "11", "role": "trainee", "trainee_id": trainee_id})
    return {"Authorization": f"Bearer {token}"}


def test_score_below_zero_rejected(client):
    """Submitting score < 0 must be rejected with HTTP 422."""
    headers = get_trainer_headers()
    payload = {
        "trainee_id": 1,
        "module_id": 1,
        "score": -1.0,
        "errors": 2,
        "time_seconds": 1200,
        "created_at": "2026-04-01T10:00:00Z",
    }
    res = client.post("/sessions", json=payload, headers=headers)
    assert res.status_code == 422


def test_score_above_max_score_rejected(client, db_session):
    """Submitting score > module.max_score must be rejected with HTTP 422."""
    mod = Module(name="Mod Max 50", max_score=50.0)
    db_session.add(mod)
    db_session.commit()

    headers = get_trainer_headers()
    payload = {
        "trainee_id": 1,
        "module_id": mod.id,
        "score": 50.1,
        "errors": 0,
        "time_seconds": 900,
        "created_at": "2026-04-02T10:00:00Z",
    }
    res = client.post("/sessions", json=payload, headers=headers)
    assert res.status_code == 422


def test_score_exactly_equal_max_score_allowed(client, db_session):
    """Submitting score == module.max_score must succeed with HTTP 201."""
    mod = Module(name="Mod Max 50 Allowed", max_score=50.0)
    db_session.add(mod)
    db_session.commit()

    headers = get_trainer_headers()
    payload = {
        "trainee_id": 1,
        "module_id": mod.id,
        "score": 50.0,
        "errors": 0,
        "time_seconds": 900,
        "created_at": "2026-04-03T10:00:00Z",
    }
    res = client.post("/sessions", json=payload, headers=headers)
    assert res.status_code == 201
    assert res.json()["score"] == 50.0


def test_negative_errors_rejected(client):
    """Submitting negative errors must be rejected with HTTP 422."""
    headers = get_trainer_headers()
    payload = {
        "trainee_id": 1,
        "module_id": 1,
        "score": 80.0,
        "errors": -1,
        "time_seconds": 1200,
        "created_at": "2026-04-04T10:00:00Z",
    }
    res = client.post("/sessions", json=payload, headers=headers)
    assert res.status_code == 422


def test_negative_time_rejected(client):
    """Submitting negative time_seconds must be rejected with HTTP 422."""
    headers = get_trainer_headers()
    payload = {
        "trainee_id": 1,
        "module_id": 1,
        "score": 80.0,
        "errors": 2,
        "time_seconds": -10,
        "created_at": "2026-04-05T10:00:00Z",
    }
    res = client.post("/sessions", json=payload, headers=headers)
    assert res.status_code == 422


def test_time_above_4_hours_rejected(client):
    """Submitting time_seconds > 14400 (4 hours) must be rejected with HTTP 422."""
    headers = get_trainer_headers()
    payload = {
        "trainee_id": 1,
        "module_id": 1,
        "score": 80.0,
        "errors": 2,
        "time_seconds": MAX_SESSION_TIME_SECONDS + 1,  # 14401 seconds
        "created_at": "2026-04-06T10:00:00Z",
    }
    res = client.post("/sessions", json=payload, headers=headers)
    assert res.status_code == 422


def test_time_exactly_4_hours_allowed(client, db_session):
    """Submitting time_seconds == 14400 (exactly 4 hours) must be allowed with HTTP 201."""
    mod = Module(name="Mod 4H Test", max_score=100.0)
    db_session.add(mod)
    db_session.commit()

    headers = get_trainer_headers()
    payload = {
        "trainee_id": 1,
        "module_id": mod.id,
        "score": 85.0,
        "errors": 1,
        "time_seconds": MAX_SESSION_TIME_SECONDS,  # exactly 14400 seconds
        "created_at": "2026-04-07T10:00:00Z",
    }
    res = client.post("/sessions", json=payload, headers=headers)
    assert res.status_code == 201
    assert res.json()["time_seconds"] == 14400


def test_duplicate_trainee_module_date_rejected_with_409(client, db_session):
    """Duplicate session for same trainee, module, and calendar date must return HTTP 409 with a clear message."""
    mod = Module(name="Mod Duplicate Test", max_score=100.0)
    db_session.add(mod)
    db_session.commit()

    headers = get_trainer_headers()

    # 1. First session on 2026-04-10 morning -> Succeeds (201)
    payload1 = {
        "trainee_id": 1,
        "module_id": mod.id,
        "score": 75.0,
        "errors": 2,
        "time_seconds": 1800,
        "created_at": "2026-04-10T09:30:00Z",
    }
    res1 = client.post("/sessions", json=payload1, headers=headers)
    assert res1.status_code == 201

    # 2. Second session on 2026-04-10 afternoon (same trainee, same module, same date) -> Rejected (409)
    payload2 = {
        "trainee_id": 1,
        "module_id": mod.id,
        "score": 82.0,
        "errors": 1,
        "time_seconds": 1600,
        "created_at": "2026-04-10T15:45:00Z",
    }
    res2 = client.post("/sessions", json=payload2, headers=headers)
    assert res2.status_code == 409
    err = res2.json()["error"]
    assert err["code"] == "DUPLICATE_SESSION_DATE"
    assert "already exists on 2026-04-10" in err["message"]

    # 3. Third session on 2026-04-11 (same trainee, same module, DIFFERENT date) -> Succeeds (201)
    payload3 = {
        "trainee_id": 1,
        "module_id": mod.id,
        "score": 88.0,
        "errors": 0,
        "time_seconds": 1500,
        "created_at": "2026-04-11T10:00:00Z",
    }
    res3 = client.post("/sessions", json=payload3, headers=headers)
    assert res3.status_code == 201


def test_admin_data_quality_rbac(client):
    """GET /admin/data-quality must be restricted strictly to administrators."""
    trainee_headers = get_trainee_headers()
    trainer_headers = get_trainer_headers()
    admin_headers = get_admin_headers()

    # Trainee -> 403 Forbidden
    res_trainee = client.get("/admin/data-quality", headers=trainee_headers)
    assert res_trainee.status_code == 403

    # Trainer -> 403 Forbidden
    res_trainer = client.get("/admin/data-quality", headers=trainer_headers)
    assert res_trainer.status_code == 403

    # Admin -> 200 OK
    res_admin = client.get("/admin/data-quality", headers=admin_headers)
    assert res_admin.status_code == 200
    data = res_admin.json()
    assert "total_flagged" in data
    assert "rule_counts" in data
    assert "flagged_records" in data


def test_admin_data_quality_detects_flagged_records(client, db_session):
    """GET /admin/data-quality accurately tallies and surfaces anomalies up to limit 20."""
    admin_headers = get_admin_headers()

    mod = Module(name="Mod DQ Audit", max_score=50.0)
    db_session.add(mod)
    db_session.commit()

    # 1. Inject cross-table anomaly: score 55.0 exceeds module max_score of 50.0
    now_utc = datetime.now(timezone.utc)
    s_score_anom = Session(
        trainee_id=2,
        module_id=mod.id,
        score=55.0,  # exceeds max_score (50.0)
        errors=1,
        time_seconds=1800,
        created_at=now_utc - timedelta(days=2),
    )

    # 2. Inject duplicate session anomaly: 2 sessions on the exact same date for trainee 1 & module mod
    s_dup1 = Session(
        trainee_id=1,
        module_id=mod.id,
        score=40.0,
        errors=2,
        time_seconds=1200,
        created_at=now_utc - timedelta(days=3, hours=2),
    )
    s_dup2 = Session(
        trainee_id=1,
        module_id=mod.id,
        score=42.0,
        errors=1,
        time_seconds=1100,
        created_at=now_utc - timedelta(days=3, hours=4),
    )

    db_session.add_all([s_score_anom, s_dup1, s_dup2])
    db_session.commit()

    res = client.get("/admin/data-quality?limit=20", headers=admin_headers)
    assert res.status_code == 200
    data = res.json()

    assert data["rule_counts"]["score_exceeds_max"] >= 1
    assert data["rule_counts"]["duplicate_sessions"] >= 1
    assert data["total_flagged"] >= 2
    assert len(data["flagged_records"]) <= 20

    score_flags = [r for r in data["flagged_records"] if r["rule_violated"] == "score_exceeds_max"]
    assert len(score_flags) >= 1
    assert score_flags[0]["score"] == 55.0

    dup_flags = [r for r in data["flagged_records"] if r["rule_violated"] == "duplicate_sessions"]
    assert len(dup_flags) >= 1


def test_future_session_date_rejected(client):
    """Submitting session with date in the future must be rejected with HTTP 422."""
    headers = get_trainer_headers()
    future_date = (datetime.now(timezone.utc) + timedelta(days=5)).isoformat()
    payload = {
        "trainee_id": 1,
        "module_id": 1,
        "score": 80.0,
        "errors": 1,
        "time_seconds": 1200,
        "created_at": future_date,
    }
    res = client.post("/sessions", json=payload, headers=headers)
    assert res.status_code == 422
    assert "FUTURE_SESSION_DATE" in res.json()["error"]["code"]


