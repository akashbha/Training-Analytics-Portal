"""Integration test suite verifying the complete closed-loop remediation workflow:
Trainer assigns remediation -> Trainee views assignment and instructions -> Trainee completes practice activity
-> Trainer records re-assessment follow-up result -> Tracker verifies outcome, delta score, and resolution status.
"""

from datetime import datetime, timezone
import pytest

from app.models.module import Module
from app.models.session import Session
from app.models.audit_log import AuditLog
from app.models.remediation import Remediation
from app.core.security import create_access_token


def test_closed_loop_remediation_workflow(client, db_session, trainer_headers, trainee_headers):
    """Verifies complete lifecycle with role transitions and rule-defined resolution."""
    # 1. Setup module and pre-existing session before remediation
    mod = Module(name="Closed Loop CAD Module", max_score=100.0)
    db_session.add(mod)
    db_session.commit()

    now = datetime.now(timezone.utc)
    # Trainee 1 has a low score session before intervention (score: 55.0%)
    s_pre = Session(trainee_id=1, module_id=mod.id, score=55.0, errors=4, time_seconds=1200, created_at=now)
    db_session.add(s_pre)
    db_session.commit()

    # Step 1: Trainer assigns remediation drill
    assign_payload = {
        "trainee_id": 1,
        "module_id": mod.id,
        "note": "Complete sketch constraint exercises and submit model geometry for review"
    }
    assign_res = client.post("/remediations", json=assign_payload, headers=trainer_headers)
    assert assign_res.status_code == 201
    rem_data = assign_res.json()
    rem_id = rem_data["id"]
    assert rem_data["status"] == "Pending"

    # Step 2: Trainee views assigned remediation and instructions
    trainee_get = client.get("/trainees/1/remediations", headers=trainee_headers)
    assert trainee_get.status_code == 200
    trainee_rems = trainee_get.json()
    assert len(trainee_rems) >= 1
    target_rem = next(r for r in trainee_rems if r["id"] == rem_id)
    assert target_rem["module_name"] == mod.name
    assert target_rem["note"] == assign_payload["note"]
    assert target_rem["status"] == "Pending"

    # Step 3: Trainee completes assigned practice activity
    complete_payload = {
        "completion_notes": "Completed exercises 1-5; resolved all over-constrained sketch warnings."
    }
    comp_res = client.post(f"/remediations/{rem_id}/complete", json=complete_payload, headers=trainee_headers)
    assert comp_res.status_code == 200
    comp_data = comp_res.json()
    assert comp_data["status"] == "Completed"
    assert comp_data["status"] != "Resolved"
    assert comp_data["resolved_at"] is None
    assert comp_data["completion_notes"] == complete_payload["completion_notes"]
    assert comp_data["completed_at"] is not None

    # Step 4: Rule verification: Trainee B cannot complete Trainee A's remediation
    trainee2_token = create_access_token(data={"sub": "12", "role": "trainee", "trainee_id": 2})
    unauth_res = client.post(
        f"/remediations/{rem_id}/complete",
        json={"completion_notes": "Malicious completion attempt"},
        headers={"Authorization": f"Bearer {trainee2_token}"}
    )
    assert unauth_res.status_code == 403

    # Step 5: Trainer records a reassessment below benchmark (e.g. 62%)
    # Resolution rule: score < 70% keeps status "In Progress"
    low_res = client.post(
        f"/remediations/{rem_id}/resolve",
        json={
            "reassessment_score": 62.0,
            "resolution_note": "Improvement noted but failed tolerance check on chamfer dimensions",
            "log_session": True
        },
        headers=trainer_headers
    )
    assert low_res.status_code == 200
    assert low_res.json()["status"] == "In Progress"

    # Step 6: Trainer records subsequent reassessment meeting benchmark (e.g. 88%)
    # Resolution rule: score >= 70% resolves the remediation
    pass_res = client.post(
        f"/remediations/{rem_id}/resolve",
        json={
            "reassessment_score": 88.0,
            "resolution_note": "Re-assessment passed: all dimension tolerances verified accurate",
            "log_session": True
        },
        headers=trainer_headers
    )
    assert pass_res.status_code == 200
    resolved_data = pass_res.json()
    assert resolved_data["status"] == "Resolved"
    assert resolved_data["reassessment_score"] == 88.0
    assert resolved_data["resolved_at"] is not None

    # Step 7: Batch listing endpoint verifies outcome tracking and status
    batch_res = client.get("/batches/1/remediations", headers=trainer_headers)
    assert batch_res.status_code == 200
    batch_items = batch_res.json()
    batch_target = next(b for b in batch_items if b["id"] == rem_id)
    assert batch_target["status"] == "Resolved"
    assert batch_target["reassessment_score"] == 88.0
    assert batch_target["score_delta"] is not None

    # Step 8: Audit log verification
    audit_events = db_session.query(AuditLog).filter(
        AuditLog.entity_type == "remediation",
        AuditLog.entity_id == rem_id
    ).all()
    actions = [a.action for a in audit_events]
    assert "create" in actions
    assert "update" in actions
