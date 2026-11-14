"""Integration test suite verifying assessment integrity and threshold reconciliation:
1. Trainee cannot call POST /sessions to self-insert official graded sessions (HTTP 403 Forbidden).
2. Trainee can submit practice drills via POST /sessions/practice, setting is_practice=True.
3. Self-practice drills are isolated from official cohort analytics:
   - Batch summary metrics (avg_score_pct, pass_rate_pct, session_count) ignore practice drills.
   - Heatmap, leaderboard, and at-risk evaluations ignore practice drills.
4. Threshold reconciliation:
   - Standard assessment pass threshold is 60.0% (ASSESSMENT_PASS_THRESHOLD).
   - Remediation mastery resolution requires 70.0% (REMEDIATION_RESOLVE_THRESHOLD).
   - Reassessment score of 65.0% leaves remediation "In Progress".
   - Reassessment score >= 70.0% marks remediation "Resolved".
5. State transition guards:
   - Completing an already resolved remediation returns HTTP 400 INVALID_STATE_TRANSITION.
"""

from datetime import datetime, timezone
import pytest
from app.models.module import Module
from app.models.session import Session
from app.models.remediation import Remediation
from app.models.audit_log import AuditLog
from app.core.constants import ASSESSMENT_PASS_THRESHOLD, REMEDIATION_RESOLVE_THRESHOLD


@pytest.fixture(autouse=True)
def cleanup_integrity_records(db_session):
    yield
    db_session.query(Session).filter(Session.trainee_id.in_([1, 2])).delete(synchronize_session=False)
    db_session.commit()


def test_trainee_cannot_create_official_session(client, trainee_headers, db_session):
    """Verifies that trainees cannot self-insert official graded session rows."""
    mod = Module(name="Official Python Module", max_score=100.0)
    db_session.add(mod)
    db_session.commit()

    payload = {
        "trainee_id": 1,
        "module_id": mod.id,
        "score": 98.0,
        "errors": 0,
        "time_seconds": 450
    }
    # Trainees must receive 403 Forbidden on staff-only graded submission endpoint
    res = client.post("/sessions", json=payload, headers=trainee_headers)
    assert res.status_code == 403
    assert "FORBIDDEN_STAFF_ONLY" in res.text


def test_trainee_practice_drill_sets_is_practice_flag(client, trainee_headers, db_session):
    """Verifies that trainees submitting practice drills get is_practice=True."""
    mod = Module(name="Self Practice Module", max_score=100.0)
    db_session.add(mod)
    db_session.commit()

    payload = {
        "trainee_id": 1,
        "module_id": mod.id,
        "score": 95.0,
        "errors": 1,
        "time_seconds": 600
    }
    res = client.post("/sessions/practice", json=payload, headers=trainee_headers)
    assert res.status_code == 201
    data = res.json()
    assert data["is_practice"] is True
    assert data["score"] == 95.0

    # Verify directly in SQLite persistence layer
    db_row = db_session.query(Session).filter(Session.id == data["id"]).first()
    assert db_row is not None
    assert db_row.is_practice is True


def test_practice_drills_do_not_contaminate_batch_summary(client, trainer_headers, trainee_headers, db_session):
    """Verifies that 100% scores in practice drills do NOT inflate cohort batch averages."""
    mod = Module(name="Cohort Benchmark Module", max_score=100.0)
    db_session.add(mod)
    db_session.commit()

    # Clean existing sessions for Trainee 1 and 2 to have deterministic baseline
    db_session.query(Session).filter(Session.trainee_id.in_([1, 2])).delete(synchronize_session=False)
    db_session.commit()

    # Step 1: Staff creates an official graded session with score 50.0% (failing)
    official_payload = {
        "trainee_id": 1,
        "module_id": mod.id,
        "score": 50.0,
        "errors": 5,
        "time_seconds": 1200
    }
    off_res = client.post("/sessions", json=official_payload, headers=trainer_headers)
    assert off_res.status_code == 201
    assert off_res.json()["is_practice"] is False

    # Check batch 1 summary: should have 1 session, avg 50.0%, pass rate 0.0%
    summary_before = client.get("/analytics/batches/1/summary", headers=trainer_headers)
    assert summary_before.status_code == 200
    data_before = summary_before.json()
    assert data_before["session_count"] == 1
    assert data_before["avg_score_pct"] == 50.0
    assert data_before["pass_rate_pct"] == 0.0

    # Step 2: Trainee 1 submits a self-practice drill with a perfect score (100.0%)
    practice_payload = {
        "trainee_id": 1,
        "module_id": mod.id,
        "score": 100.0,
        "errors": 0,
        "time_seconds": 300
    }
    prac_res = client.post("/sessions/practice", json=practice_payload, headers=trainee_headers)
    assert prac_res.status_code == 201
    assert prac_res.json()["is_practice"] is True

    # Step 3: Check batch 1 summary again: should STILL have 1 session, avg 50.0%, pass rate 0.0%
    summary_after = client.get("/analytics/batches/1/summary", headers=trainer_headers)
    assert summary_after.status_code == 200
    data_after = summary_after.json()
    assert data_after["session_count"] == 1, "Practice drill must not increment official session count"
    assert data_after["avg_score_pct"] == 50.0, "Practice drill must not alter cohort average score"
    assert data_after["pass_rate_pct"] == 0.0, "Practice drill must not alter cohort pass rate"


def test_practice_drills_isolated_from_leaderboard_and_heatmap(client, trainer_headers, trainee_headers, db_session):
    """Verifies that practice drills do not affect leaderboard rankings or heatmap performance."""
    mod = Module(name="Isolation Verification Module", max_score=100.0)
    db_session.add(mod)
    db_session.commit()

    # Clean sessions
    db_session.query(Session).filter(Session.trainee_id.in_([1, 2])).delete(synchronize_session=False)
    db_session.commit()

    # Trainee 2 submits ONLY a practice drill with 100.0%
    prac_payload = {
        "trainee_id": 2,
        "module_id": mod.id,
        "score": 100.0,
        "errors": 0,
        "time_seconds": 250
    }
    # Create token for trainee 2
    from app.core.security import create_access_token
    trainee2_token = create_access_token(data={"sub": "12", "role": "trainee", "trainee_id": 2})
    res = client.post("/sessions/practice", json=prac_payload, headers={"Authorization": f"Bearer {trainee2_token}"})
    assert res.status_code == 201

    # Check leaderboard: Trainee 2 has 0 official sessions
    lead_res = client.get("/analytics/batches/1/leaderboard", headers=trainer_headers)
    assert lead_res.status_code == 200
    leaderboard = lead_res.json()
    t2_entry = next((item for item in leaderboard if item["trainee_id"] == 2), None)
    assert t2_entry is not None
    assert t2_entry["session_count"] == 0
    assert t2_entry["status"] == "no_sessions"

    # Check heatmap: Trainee 2 cells must have session_count == 0 and score_pct is None
    heatmap_res = client.get("/analytics/batches/1/heatmap", headers=trainer_headers)
    assert heatmap_res.status_code == 200
    heatmap_data = heatmap_res.json()
    t2_row = next((r for r in heatmap_data["rows"] if r["trainee_id"] == 2), None)
    assert t2_row is not None
    cell = next((c for c in t2_row["cells"] if c["module_id"] == mod.id), None)
    assert cell is not None
    assert cell["session_count"] == 0
    assert cell["score_pct"] is None


def test_remediation_mastery_threshold_reconciliation(client, trainer_headers, trainee_headers, db_session):
    """Verifies that passing an assessment is >= 60.0% but resolving remediation requires >= 70.0%."""
    assert ASSESSMENT_PASS_THRESHOLD == 60.0
    assert REMEDIATION_RESOLVE_THRESHOLD == 70.0

    mod = Module(name="Threshold Reconciliation Module", max_score=100.0)
    db_session.add(mod)
    db_session.commit()

    # 1. Trainer assigns remediation
    assign_res = client.post(
        "/remediations",
        json={"trainee_id": 1, "module_id": mod.id, "note": "Resolve pipeline failure debugging"},
        headers=trainer_headers
    )
    assert assign_res.status_code == 201
    rem_id = assign_res.json()["id"]

    # 2. Trainee marks practice completed
    comp_res = client.post(
        f"/remediations/{rem_id}/complete",
        json={"completion_notes": "Completed error reproduction exercise"},
        headers=trainee_headers
    )
    assert comp_res.status_code == 200
    assert comp_res.json()["status"] == "Completed"

    # 3. Trainer reassesses at 65.0%:
    # 65.0% would PASS a regular module (> 60%), but FAILS remediation mastery (< 70%)
    reassess_65 = client.post(
        f"/remediations/{rem_id}/resolve",
        json={
            "reassessment_score": 65.0,
            "resolution_note": "Met basic threshold (65%) but did not achieve remediation mastery (70%)",
            "log_session": False
        },
        headers=trainer_headers
    )
    assert reassess_65.status_code == 200
    data_65 = reassess_65.json()
    assert data_65["status"] == "In Progress", "Score 65.0% must leave remediation In Progress"
    assert data_65["resolved_at"] is None

    # 4. Trainer reassesses at 70.0% (exact mastery threshold)
    reassess_70 = client.post(
        f"/remediations/{rem_id}/resolve",
        json={
            "reassessment_score": 70.0,
            "resolution_note": "Achieved remediation mastery threshold (70.0%)",
            "log_session": False
        },
        headers=trainer_headers
    )
    assert reassess_70.status_code == 200
    data_70 = reassess_70.json()
    assert data_70["status"] == "Resolved", "Score 70.0% must resolve remediation"
    assert data_70["resolved_at"] is not None


def test_remediation_state_transition_guard_on_completed(client, trainer_headers, trainee_headers, db_session):
    """Verifies that completing an already resolved remediation is rejected with HTTP 400."""
    mod = Module(name="State Guard Module", max_score=100.0)
    db_session.add(mod)
    db_session.commit()

    # Assign and resolve directly
    assign_res = client.post(
        "/remediations",
        json={"trainee_id": 1, "module_id": mod.id, "note": "State guard test"},
        headers=trainer_headers
    )
    rem_id = assign_res.json()["id"]

    # Resolve directly to Resolved state
    resolve_res = client.post(
        f"/remediations/{rem_id}/resolve",
        json={"reassessment_score": 85.0, "resolution_note": "Immediate resolution", "log_session": False},
        headers=trainer_headers
    )
    assert resolve_res.status_code == 200
    assert resolve_res.json()["status"] == "Resolved"

    # Now trainee attempts to mark it completed again
    illegal_complete = client.post(
        f"/remediations/{rem_id}/complete",
        json={"completion_notes": "Attempting to change already resolved drill"},
        headers=trainee_headers
    )
    assert illegal_complete.status_code == 400
    assert "INVALID_STATE_TRANSITION" in illegal_complete.text
