"""Unit and integration tests for Step 8:
- Student x module heatmap pivot on a small fixture (empty cells blank, not zero; score bands match thresholds)
- At-risk CSV export containing descriptive flag reason text
- Module goal setting with progress capped at 100% and 0% for zero sessions
"""

from datetime import datetime, timezone
from app.models.batch import Batch
from app.models.trainee import Trainee
from app.models.module import Module
from app.models.session import Session as AssessmentSession
from app.models.audit_log import AuditLog
from app.core.constants import PASS_THRESHOLD, EXCELLENT_THRESHOLD


def test_heatmap_pivot_on_small_fixture(client, db_session, trainer_headers):
    """Heatmap must pivot trainee x module performance with score bands, showing empty cells as None/blank, not 0.0."""
    now = datetime.now(timezone.utc)
    batch = Batch(name="Heatmap Test Batch", start_date=now.date(), end_date=now.date())
    db_session.add(batch)
    db_session.commit()

    mod_a = Module(name="Mod A", max_score=100.0)
    mod_b = Module(name="Mod B", max_score=100.0)
    db_session.add_all([mod_a, mod_b])
    db_session.commit()

    t1 = Trainee(name="Trainee One", email="t1@heatmap.test", batch_id=batch.id)
    t2 = Trainee(name="Trainee Two", email="t2@heatmap.test", batch_id=batch.id)
    db_session.add_all([t1, t2])
    db_session.commit()

    # Trainee 1 has sessions for Mod A (score 85 -> excellent) and Mod B (score 50 -> struggling)
    s1 = AssessmentSession(trainee_id=t1.id, module_id=mod_a.id, score=85.0, errors=0, time_seconds=600, created_at=now)
    s2 = AssessmentSession(trainee_id=t1.id, module_id=mod_b.id, score=50.0, errors=2, time_seconds=900, created_at=now)

    # Trainee 2 has session for Mod A only (score 65 -> passing). Mod B has zero sessions.
    s3 = AssessmentSession(trainee_id=t2.id, module_id=mod_a.id, score=65.0, errors=1, time_seconds=800, created_at=now)
    db_session.add_all([s1, s2, s3])
    db_session.commit()

    resp = client.get(f"/analytics/batches/{batch.id}/heatmap", headers=trainer_headers)
    assert resp.status_code == 200
    data = resp.json()

    assert data["batch_id"] == batch.id
    assert len(data["modules"]) >= 2
    mod_ids = [m["id"] for m in data["modules"]]
    assert mod_a.id in mod_ids
    assert mod_b.id in mod_ids

    # Find rows for t1 and t2
    row_t1 = next(r for r in data["rows"] if r["trainee_id"] == t1.id)
    row_t2 = next(r for r in data["rows"] if r["trainee_id"] == t2.id)

    # Trainee 1 cells
    cell_t1_a = next(c for c in row_t1["cells"] if c["module_id"] == mod_a.id)
    cell_t1_b = next(c for c in row_t1["cells"] if c["module_id"] == mod_b.id)
    assert cell_t1_a["score_pct"] == 85.0
    assert cell_t1_a["band"] == "excellent"
    assert cell_t1_b["score_pct"] == 50.0
    assert cell_t1_b["band"] == "struggling"

    # Trainee 2 cells: Mod A is passing, Mod B is EMPTY (None, not 0.0)
    cell_t2_a = next(c for c in row_t2["cells"] if c["module_id"] == mod_a.id)
    cell_t2_b = next(c for c in row_t2["cells"] if c["module_id"] == mod_b.id)
    assert cell_t2_a["score_pct"] == 65.0
    assert cell_t2_a["band"] == "passing"
    assert cell_t2_b["score_pct"] is None, "Empty cell MUST be None, not 0.0!"
    assert cell_t2_b["band"] is None
    assert cell_t2_b["session_count"] == 0


def test_csv_export_contains_reason_text(client, db_session, trainer_headers):
    """At-risk CSV export must include descriptive flag reason text and correct headers."""
    now = datetime.now(timezone.utc)
    batch = Batch(name="CSV Export Batch", start_date=now.date(), end_date=now.date())
    db_session.add(batch)
    db_session.commit()

    mod = Module(name="CSV Module", max_score=100.0)
    db_session.add(mod)
    db_session.commit()

    # Trainee 1: Struggling (3 sessions of 45.0% < PASS_THRESHOLD)
    t_struggling = Trainee(name="Struggling Trainee", email="struggling@csv.test", batch_id=batch.id)
    # Trainee 2: Passing (3 sessions of 85.0% >= PASS_THRESHOLD)
    t_passing = Trainee(name="Passing Trainee", email="passing@csv.test", batch_id=batch.id)
    # Trainee 3: Zero sessions (Cold start)
    t_empty = Trainee(name="Empty Trainee", email="empty@csv.test", batch_id=batch.id)

    db_session.add_all([t_struggling, t_passing, t_empty])
    db_session.commit()

    for _ in range(3):
        db_session.add(AssessmentSession(trainee_id=t_struggling.id, module_id=mod.id, score=45.0, errors=2, time_seconds=600, created_at=now))
        db_session.add(AssessmentSession(trainee_id=t_passing.id, module_id=mod.id, score=85.0, errors=0, time_seconds=600, created_at=now))
    db_session.commit()

    resp = client.get(f"/analytics/batches/{batch.id}/at-risk/export", headers=trainer_headers)
    assert resp.status_code == 200
    assert "text/csv" in resp.headers["content-type"]
    assert f'filename="at_risk_batch_{batch.id}.csv"' in resp.headers["content-disposition"]

    csv_text = resp.text
    lines = csv_text.strip().split("\r\n") if "\r\n" in csv_text else csv_text.strip().split("\n")

    # Header verification
    assert "trainee_id,trainee_name,trainee_email,batch_name,average_score_pct,session_count,flag_reason" in lines[0]

    # Content verification
    assert "Struggling Trainee" in csv_text
    assert "Empty Trainee" in csv_text
    assert "Passing Trainee" not in csv_text, "Passing trainee must NOT be in at-risk export!"

    # Flag reason text must be populated
    assert "passing threshold" in csv_text.lower() or "critical low" in csv_text.lower()
    assert "cold start" in csv_text.lower() or "no assessments completed" in csv_text.lower()


def test_goal_progress_capped_at_100_and_reads_zero_with_no_sessions(client, db_session, trainer_headers):
    """Trainee goal progress must read 0.0% with no sessions and cap strictly at 100.0% when exceeded."""
    now = datetime.now(timezone.utc)
    batch = Batch(name="Goal Batch", start_date=now.date(), end_date=now.date())
    db_session.add(batch)
    db_session.commit()

    mod1 = Module(name="Goal Mod 1", max_score=100.0)
    mod2 = Module(name="Goal Mod 2", max_score=100.0)
    db_session.add_all([mod1, mod2])
    db_session.commit()

    t = Trainee(name="Goal Trainee", email="trainee@goal.test", batch_id=batch.id)
    db_session.add(t)
    db_session.commit()

    # 1. Goal with zero sessions -> progress must be 0.0%, best_score is None
    payload_zero = {"module_id": mod1.id, "target_score": 75.0}
    res1 = client.post(f"/trainees/{t.id}/goals", json=payload_zero, headers=trainer_headers)
    assert res1.status_code == 200
    g1 = res1.json()
    assert g1["target_score"] == 75.0
    assert g1["best_score"] is None
    assert g1["progress_pct"] == 0.0

    # 2. Add sessions: score 90.0% against target 60.0% (raw = 150%) -> progress must be strictly capped at 100.0%
    s_exceed = AssessmentSession(trainee_id=t.id, module_id=mod2.id, score=90.0, errors=0, time_seconds=600, created_at=now)
    db_session.add(s_exceed)
    db_session.commit()

    payload_exceed = {"module_id": mod2.id, "target_score": 60.0}
    res2 = client.post(f"/trainees/{t.id}/goals", json=payload_exceed, headers=trainer_headers)
    assert res2.status_code == 200
    g2 = res2.json()
    assert g2["target_score"] == 60.0
    assert g2["best_score"] == 90.0
    assert g2["progress_pct"] == 100.0, "Progress must be capped at 100.0%!"

    # 3. Partial progress: score 45.0% against target 90.0% -> progress = 50.0%
    s_partial = AssessmentSession(trainee_id=t.id, module_id=mod1.id, score=45.0, errors=1, time_seconds=600, created_at=now)
    db_session.add(s_partial)
    db_session.commit()

    # Query GET /trainees/{id}/goals
    res_list = client.get(f"/trainees/{t.id}/goals", headers=trainer_headers)
    assert res_list.status_code == 200
    goals = res_list.json()
    assert len(goals) == 2

    mod1_goal = next(g for g in goals if g["module_id"] == mod1.id)
    assert mod1_goal["best_score"] == 45.0
    # 45.0 / 75.0 = 60.0%
    assert mod1_goal["progress_pct"] == 60.0

    # 4. Confirm audit log recorded
    audit_rows = db_session.query(AuditLog).filter(AuditLog.entity_type == "goal").all()
    assert len(audit_rows) >= 2
    assert any(a.action == "create" for a in audit_rows)

