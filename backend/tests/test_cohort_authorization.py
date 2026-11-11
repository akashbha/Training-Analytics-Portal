"""Negative and positive authorization tests for cohort-level broken object level authorization (BOLA).
Verifies OWASP compliance: Trainers are restricted strictly to cohorts they are assigned to.
"""

from datetime import date
import uuid
import pytest

from app.models.batch import Batch
from app.models.batch_trainer import BatchTrainer
from app.models.trainee import Trainee
from app.models.module import Module
from app.models.user import User
from app.core.security import create_access_token, get_password_hash


@pytest.fixture
def multi_cohort_context(db_session):
    """Sets up two isolated cohorts with distinct trainers."""
    uid = uuid.uuid4().hex[:6]
    # Cohort 1
    batch1 = Batch(name=f"Cohort 1 Alpha {uid}", start_date=date(2026, 1, 1), end_date=date(2026, 6, 1))
    # Cohort 2
    batch2 = Batch(name=f"Cohort 2 Beta {uid}", start_date=date(2026, 1, 1), end_date=date(2026, 6, 1))
    db_session.add_all([batch1, batch2])
    db_session.flush()

    # Trainees
    t1 = Trainee(name=f"Trainee Alpha {uid}", email=f"alpha_{uid}@cohort1.internal", batch_id=batch1.id)
    t2 = Trainee(name=f"Trainee Beta {uid}", email=f"beta_{uid}@cohort2.internal", batch_id=batch2.id)
    db_session.add_all([t1, t2])
    db_session.flush()

    # Trainer 1 (assigned to Cohort 1 ONLY)
    u_trainer1 = User(
        email=f"trainer1_{uid}@test.internal",
        password_hash=get_password_hash("Trainer@123"),
        role="trainer",
        is_active=True
    )
    # Trainer 2 (assigned to Cohort 2 ONLY)
    u_trainer2 = User(
        email=f"trainer2_{uid}@test.internal",
        password_hash=get_password_hash("Trainer@123"),
        role="trainer",
        is_active=True
    )
    # Admin (global access)
    u_admin = User(
        email=f"admin_{uid}@test.internal",
        password_hash=get_password_hash("Admin@123"),
        role="admin",
        is_active=True
    )
    db_session.add_all([u_trainer1, u_trainer2, u_admin])
    db_session.flush()

    # Assignments
    bt1 = BatchTrainer(batch_id=batch1.id, trainer_id=u_trainer1.id)
    bt2 = BatchTrainer(batch_id=batch2.id, trainer_id=u_trainer2.id)
    db_session.add_all([bt1, bt2])
    db_session.flush()

    # Module
    mod = Module(name=f"BOLA Mod {uid}", max_score=100.0)
    db_session.add(mod)
    db_session.commit()

    token1 = create_access_token(data={"sub": str(u_trainer1.id), "role": "trainer"})
    token2 = create_access_token(data={"sub": str(u_trainer2.id), "role": "trainer"})
    admin_token = create_access_token(data={"sub": str(u_admin.id), "role": "admin"})

    try:
        yield {
            "batch1_id": batch1.id,
            "batch2_id": batch2.id,
            "t1_id": t1.id,
            "t2_id": t2.id,
            "mod_id": mod.id,
            "trainer1_headers": {"Authorization": f"Bearer {token1}"},
            "trainer2_headers": {"Authorization": f"Bearer {token2}"},
            "admin_headers": {"Authorization": f"Bearer {admin_token}"},
        }
    finally:
        for bt in [bt1, bt2]:
            try:
                db_session.delete(bt)
            except Exception:
                pass
        for u in [u_trainer1, u_trainer2, u_admin]:
            try:
                db_session.delete(u)
            except Exception:
                pass
        for t in [t1, t2]:
            try:
                db_session.delete(t)
            except Exception:
                pass
        try:
            db_session.delete(mod)
            db_session.delete(batch1)
            db_session.delete(batch2)
            db_session.commit()
        except Exception:
            db_session.rollback()


def test_trainer_can_read_assigned_batch_analytics(client, multi_cohort_context):
    """Trainer 1 can read summary, leaderboard, and attention for Cohort 1."""
    ctx = multi_cohort_context
    headers = ctx["trainer1_headers"]
    b1 = ctx["batch1_id"]

    res_summary = client.get(f"/analytics/batches/{b1}/summary", headers=headers)
    assert res_summary.status_code == 200

    res_lb = client.get(f"/analytics/batches/{b1}/leaderboard", headers=headers)
    assert res_lb.status_code == 200

    res_att = client.get(f"/analytics/batches/{b1}/attention", headers=headers)
    assert res_att.status_code == 200


def test_trainer_cannot_read_unassigned_batch_analytics(client, multi_cohort_context):
    """Trainer 1 receives HTTP 403 when attempting to access Cohort 2 analytics (OWASP BOLA protection)."""
    ctx = multi_cohort_context
    headers = ctx["trainer1_headers"]
    b2 = ctx["batch2_id"]

    # Summary
    res_summary = client.get(f"/analytics/batches/{b2}/summary", headers=headers)
    assert res_summary.status_code == 403
    assert res_summary.json()["error"]["code"] == "FORBIDDEN_COHORT_ACCESS"

    # Leaderboard
    res_lb = client.get(f"/analytics/batches/{b2}/leaderboard", headers=headers)
    assert res_lb.status_code == 403
    assert res_lb.json()["error"]["code"] == "FORBIDDEN_COHORT_ACCESS"

    # Attention queue
    res_att = client.get(f"/analytics/batches/{b2}/attention", headers=headers)
    assert res_att.status_code == 403
    assert res_att.json()["error"]["code"] == "FORBIDDEN_COHORT_ACCESS"

    # Heatmap
    res_hm = client.get(f"/analytics/batches/{b2}/heatmap", headers=headers)
    assert res_hm.status_code == 403

    # Hotspots
    res_hs = client.get(f"/analytics/batches/{b2}/hotspots", headers=headers)
    assert res_hs.status_code == 403

    # Weekly & Bands
    res_wk = client.get(f"/analytics/batches/{b2}/weekly", headers=headers)
    assert res_wk.status_code == 403
    res_bd = client.get(f"/analytics/batches/{b2}/bands", headers=headers)
    assert res_bd.status_code == 403

    # CSV & Weekly Summary Exports
    res_csv = client.get(f"/analytics/batches/{b2}/at-risk/export", headers=headers)
    assert res_csv.status_code == 403
    res_ws = client.get(f"/analytics/batches/{b2}/weekly-summary/export", headers=headers)
    assert res_ws.status_code == 403

    # Misconceptions & Approval & ML Attention
    res_mc = client.get(f"/analytics/batches/{b2}/misconceptions", headers=headers)
    assert res_mc.status_code == 403
    res_mca = client.post(f"/analytics/batches/{b2}/misconceptions/cluster_1/approval?approved=true", headers=headers)
    assert res_mca.status_code == 403
    res_ml = client.get(f"/analytics/batches/{b2}/ml-attention", headers=headers)
    assert res_ml.status_code == 403

    # Batch details, Batch trainers, Sessions batch filter, and Trainer Copilot
    res_bdet = client.get(f"/batches/{b2}", headers=headers)
    assert res_bdet.status_code == 403
    res_btr = client.get(f"/batches/{b2}/trainers", headers=headers)
    assert res_btr.status_code == 403
    res_sess = client.get(f"/sessions?batch_id={b2}", headers=headers)
    assert res_sess.status_code == 403
    res_cop = client.post("/help/trainer-copilot", json={"batch_id": b2, "query": "Who is struggling?"}, headers=headers)
    assert res_cop.status_code == 403

    # Trainee-specific analytics and remediations for a trainee in an unassigned cohort
    t2_id = ctx["t2_id"]
    assert client.get(f"/analytics/trainees/{t2_id}/summary", headers=headers).status_code == 403
    assert client.get(f"/analytics/trainees/{t2_id}/progress", headers=headers).status_code == 403
    assert client.get(f"/analytics/trainees/{t2_id}/errors-by-module", headers=headers).status_code == 403
    assert client.get(f"/analytics/trainees/{t2_id}/standing", headers=headers).status_code == 403
    assert client.get(f"/analytics/trainees/{t2_id}/risk", headers=headers).status_code == 403
    assert client.get(f"/trainees/{t2_id}/remediations", headers=headers).status_code == 403


def test_trainer_cannot_list_or_create_remediations_for_unassigned_cohort(client, multi_cohort_context):
    """Trainer 1 cannot list remediations for Cohort 2 or assign a remediation to Trainee 2."""
    ctx = multi_cohort_context
    headers = ctx["trainer1_headers"]
    b2 = ctx["batch2_id"]
    t2_id = ctx["t2_id"]
    mod_id = ctx["mod_id"]

    # Listing remediations for unassigned batch returns 403
    res_list = client.get(f"/batches/{b2}/remediations", headers=headers)
    assert res_list.status_code == 403
    assert res_list.json()["error"]["code"] == "FORBIDDEN_COHORT_ACCESS"

    # Assigning remediation to trainee in unassigned batch returns 403
    res_assign = client.post(
        "/remediations",
        json={"trainee_id": t2_id, "module_id": mod_id, "note": "Cross-cohort assignment attempt"},
        headers=headers
    )
    assert res_assign.status_code == 403
    assert res_assign.json()["error"]["code"] == "FORBIDDEN_RESOURCE_ACCESS"


def test_admin_has_global_access_across_cohorts(client, multi_cohort_context):
    """Admin role bypasses cohort-level assignment restrictions and can view all cohorts."""
    ctx = multi_cohort_context
    headers = ctx["admin_headers"]
    b1 = ctx["batch1_id"]
    b2 = ctx["batch2_id"]

    assert client.get(f"/analytics/batches/{b1}/summary", headers=headers).status_code == 200
    assert client.get(f"/analytics/batches/{b2}/summary", headers=headers).status_code == 200
    assert client.get(f"/batches/{b1}/remediations", headers=headers).status_code == 200
    assert client.get(f"/batches/{b2}/remediations", headers=headers).status_code == 200
