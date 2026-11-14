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
from app.models.session import Session as SessionModel
from app.models.remediation import Remediation
from app.core.security import create_access_token, get_password_hash


@pytest.fixture
def multi_cohort_context(db_session):
    """Sets up two isolated cohorts with distinct trainers and enrolled trainees."""
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
    # Trainee 1 User
    u_trainee1 = User(
        email=f"trainee1_{uid}@test.internal",
        password_hash=get_password_hash("Trainee@123"),
        role="trainee",
        trainee_id=t1.id,
        is_active=True
    )
    # Trainee 2 User
    u_trainee2 = User(
        email=f"trainee2_{uid}@test.internal",
        password_hash=get_password_hash("Trainee@123"),
        role="trainee",
        trainee_id=t2.id,
        is_active=True
    )
    db_session.add_all([u_trainer1, u_trainer2, u_admin, u_trainee1, u_trainee2])
    db_session.flush()

    # Assignments
    bt1 = BatchTrainer(batch_id=batch1.id, trainer_id=u_trainer1.id)
    bt2 = BatchTrainer(batch_id=batch2.id, trainer_id=u_trainer2.id)
    db_session.add_all([bt1, bt2])
    db_session.flush()

    # Module
    mod = Module(name=f"BOLA Mod {uid}", max_score=100.0)
    db_session.add(mod)
    db_session.flush()

    # Graded sessions
    s1 = SessionModel(
        trainee_id=t1.id,
        module_id=mod.id,
        score=85.0,
        errors=2,
        time_seconds=600,
        created_by=u_trainer1.id
    )
    s2 = SessionModel(
        trainee_id=t2.id,
        module_id=mod.id,
        score=75.0,
        errors=4,
        time_seconds=900,
        created_by=u_trainer2.id
    )
    db_session.add_all([s1, s2])
    db_session.commit()

    token1 = create_access_token(data={"sub": str(u_trainer1.id), "role": "trainer"})
    token2 = create_access_token(data={"sub": str(u_trainer2.id), "role": "trainer"})
    admin_token = create_access_token(data={"sub": str(u_admin.id), "role": "admin"})
    trainee1_token = create_access_token(data={"sub": str(u_trainee1.id), "role": "trainee", "trainee_id": t1.id})
    trainee2_token = create_access_token(data={"sub": str(u_trainee2.id), "role": "trainee", "trainee_id": t2.id})

    try:
        yield {
            "batch1_id": batch1.id,
            "batch2_id": batch2.id,
            "t1_id": t1.id,
            "t2_id": t2.id,
            "t1_email": t1.email,
            "t2_email": t2.email,
            "s1_id": s1.id,
            "s2_id": s2.id,
            "mod_id": mod.id,
            "mod_name": mod.name,
            "trainer1_headers": {"Authorization": f"Bearer {token1}"},
            "trainer2_headers": {"Authorization": f"Bearer {token2}"},
            "trainee1_headers": {"Authorization": f"Bearer {trainee1_token}"},
            "trainee2_headers": {"Authorization": f"Bearer {trainee2_token}"},
            "admin_headers": {"Authorization": f"Bearer {admin_token}"},
            "trainer1_user_id": u_trainer1.id,
            "trainer2_user_id": u_trainer2.id,
            "trainee1_user_id": u_trainee1.id,
            "trainee2_user_id": u_trainee2.id,
            "admin_user_id": u_admin.id,
        }
    finally:
        for s in [s1, s2]:
            try:
                db_session.delete(s)
            except Exception:
                pass
        for bt in [bt1, bt2]:
            try:
                db_session.delete(bt)
            except Exception:
                pass
        for u in [u_trainer1, u_trainer2, u_admin, u_trainee1, u_trainee2]:
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


def test_batch_listing_scoping(client, multi_cohort_context):
    """Batches list is strictly scoped by role:
    - Admin: sees both cohorts.
    - Trainer: sees only assigned cohort (Cohort 1).
    - Trainee: sees only enrolled cohort (Cohort 1).
    """
    ctx = multi_cohort_context
    b1 = ctx["batch1_id"]
    b2 = ctx["batch2_id"]

    # Admin
    res_admin = client.get("/batches", headers=ctx["admin_headers"])
    assert res_admin.status_code == 200
    admin_batch_ids = [b["id"] for b in res_admin.json()["items"]]
    assert b1 in admin_batch_ids
    assert b2 in admin_batch_ids

    # Trainer 1 (assigned only to b1)
    res_trainer = client.get("/batches", headers=ctx["trainer1_headers"])
    assert res_trainer.status_code == 200
    trainer_batch_ids = [b["id"] for b in res_trainer.json()["items"]]
    assert b1 in trainer_batch_ids
    assert b2 not in trainer_batch_ids

    # Trainee 1 (enrolled only in b1)
    res_trainee = client.get("/batches", headers=ctx["trainee1_headers"])
    assert res_trainee.status_code == 200
    trainee_batch_ids = [b["id"] for b in res_trainee.json()["items"]]
    assert b1 in trainee_batch_ids
    assert b2 not in trainee_batch_ids


def test_trainee_roster_listing_scoping(client, multi_cohort_context):
    """Trainee roster listing is strictly scoped:
    - Admin: sees all trainees across cohorts.
    - Trainer 1: sees only Trainee 1, not Trainee 2.
    - Trainer 1 querying unassigned batch ID: returns 403 FORBIDDEN_COHORT_ACCESS.
    - Trainee 1: forbidden from roster listing (403).
    """
    ctx = multi_cohort_context
    t1 = ctx["t1_id"]
    t2 = ctx["t2_id"]
    b2 = ctx["batch2_id"]

    # Admin
    res_admin = client.get("/trainees", headers=ctx["admin_headers"])
    assert res_admin.status_code == 200
    admin_t_ids = [t["id"] for t in res_admin.json()["items"]]
    assert t1 in admin_t_ids
    assert t2 in admin_t_ids

    # Trainer 1
    res_trainer = client.get("/trainees", headers=ctx["trainer1_headers"])
    assert res_trainer.status_code == 200
    trainer_t_ids = [t["id"] for t in res_trainer.json()["items"]]
    assert t1 in trainer_t_ids
    assert t2 not in trainer_t_ids

    # Trainer 1 querying batch2 roster explicitly gets 403
    res_t_b2 = client.get(f"/trainees?batch_id={b2}", headers=ctx["trainer1_headers"])
    assert res_t_b2.status_code == 403
    assert res_t_b2.json()["error"]["code"] == "FORBIDDEN_COHORT_ACCESS"

    # Trainee 1 querying roster gets 403
    res_trainee = client.get("/trainees", headers=ctx["trainee1_headers"])
    assert res_trainee.status_code == 403
    assert res_trainee.json()["error"]["code"] == "FORBIDDEN_TRAINEE_ROSTER_ACCESS"


def test_trainee_profile_crud_and_goals_authorization(client, multi_cohort_context):
    """Granular object authorization on trainee profiles and goals:
    - Trainer 1 cannot read, update, or set goals for Trainee 2 (unassigned cohort).
    - Trainer 1 cannot enroll new trainees into unassigned cohorts.
    - Trainee 1 cannot read, update, or set goals for Trainee 2.
    - Trainee 1 cannot reassign their own cohort batch.
    """
    ctx = multi_cohort_context
    t1 = ctx["t1_id"]
    t2 = ctx["t2_id"]
    b1 = ctx["batch1_id"]
    b2 = ctx["batch2_id"]
    mod_id = ctx["mod_id"]

    # Trainer 1 accessing Trainee 1 succeeds
    assert client.get(f"/trainees/{t1}", headers=ctx["trainer1_headers"]).status_code == 200

    # Trainer 1 accessing Trainee 2 is rejected
    res_tr_t2 = client.get(f"/trainees/{t2}", headers=ctx["trainer1_headers"])
    assert res_tr_t2.status_code == 403
    assert res_tr_t2.json()["error"]["code"] == "FORBIDDEN_COHORT_ACCESS"

    # Trainer 1 updating Trainee 2 is rejected
    res_tr_up = client.put(f"/trainees/{t2}", json={"name": "Tampered Name"}, headers=ctx["trainer1_headers"])
    assert res_tr_up.status_code == 403
    assert res_tr_up.json()["error"]["code"] == "FORBIDDEN_COHORT_ACCESS"

    # Trainer 1 enrolling trainee into unassigned batch 2 is rejected
    res_tr_create = client.post(
        "/trainees",
        json={"name": "Hacker Trainee", "email": f"hacker_{uuid.uuid4().hex[:6]}@test.internal", "batch_id": b2},
        headers=ctx["trainer1_headers"]
    )
    assert res_tr_create.status_code == 403
    assert res_tr_create.json()["error"]["code"] == "FORBIDDEN_COHORT_ACCESS"

    # Trainer 1 accessing or setting goals for Trainee 2 is rejected
    res_tr_g_get = client.get(f"/trainees/{t2}/goals", headers=ctx["trainer1_headers"])
    assert res_tr_g_get.status_code == 403
    res_tr_g_set = client.post(
        f"/trainees/{t2}/goals",
        json={"module_id": mod_id, "target_score": 90.0},
        headers=ctx["trainer1_headers"]
    )
    assert res_tr_g_set.status_code == 403

    # Trainee 1 reading self succeeds
    assert client.get(f"/trainees/{t1}", headers=ctx["trainee1_headers"]).status_code == 200

    # Trainee 1 reading or updating Trainee 2 is rejected (anti-ID enumeration)
    res_te_t2 = client.get(f"/trainees/{t2}", headers=ctx["trainee1_headers"])
    assert res_te_t2.status_code == 403
    assert res_te_t2.json()["error"]["code"] == "FORBIDDEN_RESOURCE_ACCESS"

    res_te_up = client.put(f"/trainees/{t2}", json={"bio": "Unauthorized update"}, headers=ctx["trainee1_headers"])
    assert res_te_up.status_code == 403
    assert res_te_up.json()["error"]["code"] == "FORBIDDEN_RESOURCE_ACCESS"

    # Trainee 1 attempting to reassign own cohort batch
    res_te_reassign = client.put(f"/trainees/{t1}", json={"batch_id": b2}, headers=ctx["trainee1_headers"])
    assert res_te_reassign.status_code == 403
    assert res_te_reassign.json()["error"]["code"] == "FORBIDDEN_BATCH_REASSIGNMENT"

    # Trainee 1 accessing Trainee 2 goals is rejected
    res_te_g2 = client.get(f"/trainees/{t2}/goals", headers=ctx["trainee1_headers"])
    assert res_te_g2.status_code == 403
    assert res_te_g2.json()["error"]["code"] == "FORBIDDEN_RESOURCE_ACCESS"

    res_te_g2_post = client.post(
        f"/trainees/{t2}/goals",
        json={"module_id": mod_id, "target_score": 95.0},
        headers=ctx["trainee1_headers"]
    )
    assert res_te_g2_post.status_code == 403
    assert res_te_g2_post.json()["error"]["code"] == "FORBIDDEN_RESOURCE_ACCESS"


def test_session_listing_and_crud_authorization(client, multi_cohort_context):
    """Session access controls:
    - Trainer 1 can list/read/create sessions only for assigned cohort (Trainee 1).
    - Trainer 1 is rejected when attempting to read/update/delete sessions of Trainee 2.
    - Trainee 1 can list only own sessions and cannot query other trainees' or cohorts' sessions.
    - Trainee 1 cannot submit self-practice drills for Trainee 2.
    """
    ctx = multi_cohort_context
    t1 = ctx["t1_id"]
    t2 = ctx["t2_id"]
    s1 = ctx["s1_id"]
    s2 = ctx["s2_id"]
    b2 = ctx["batch2_id"]
    mod_id = ctx["mod_id"]

    # Trainer 1 listing sessions without filters returns only sessions from assigned cohorts (s1, not s2)
    res_tr_sess = client.get("/sessions", headers=ctx["trainer1_headers"])
    assert res_tr_sess.status_code == 200
    sess_ids = [s["id"] for s in res_tr_sess.json()["items"]]
    assert s1 in sess_ids
    assert s2 not in sess_ids

    # Trainer 1 querying Trainee 2 sessions explicitly gets 403
    res_tr_t2_sess = client.get(f"/sessions?trainee_id={t2}", headers=ctx["trainer1_headers"])
    assert res_tr_t2_sess.status_code == 403
    assert res_tr_t2_sess.json()["error"]["code"] == "FORBIDDEN_COHORT_ACCESS"

    # Trainer 1 reading Session 2 directly gets 403
    res_tr_s2 = client.get(f"/sessions/{s2}", headers=ctx["trainer1_headers"])
    assert res_tr_s2.status_code == 403
    assert res_tr_s2.json()["error"]["code"] == "FORBIDDEN_COHORT_ACCESS"

    # Trainer 1 attempting to create a session for Trainee 2 gets 403
    res_tr_create = client.post(
        "/sessions",
        json={"trainee_id": t2, "module_id": mod_id, "score": 90.0, "errors": 1, "time_seconds": 300},
        headers=ctx["trainer1_headers"]
    )
    assert res_tr_create.status_code == 403
    assert res_tr_create.json()["error"]["code"] == "FORBIDDEN_COHORT_ACCESS"

    # Trainer 1 attempting to update Session 2 gets 403
    res_tr_up = client.put(
        f"/sessions/{s2}",
        json={"trainee_id": t2, "module_id": mod_id, "score": 99.0, "errors": 0, "time_seconds": 300},
        headers=ctx["trainer1_headers"]
    )
    assert res_tr_up.status_code == 403
    assert res_tr_up.json()["error"]["code"] == "FORBIDDEN_COHORT_ACCESS"

    # Trainer 1 attempting to delete Session 2 gets 403
    res_tr_del = client.delete(f"/sessions/{s2}", headers=ctx["trainer1_headers"])
    assert res_tr_del.status_code == 403
    assert res_tr_del.json()["error"]["code"] == "FORBIDDEN_COHORT_ACCESS"

    # Trainee 1 listing sessions returns only own sessions
    res_te_sess = client.get("/sessions", headers=ctx["trainee1_headers"])
    assert res_te_sess.status_code == 200
    te_sess_ids = [s["id"] for s in res_te_sess.json()["items"]]
    assert s1 in te_sess_ids
    assert s2 not in te_sess_ids

    # Trainee 1 querying Trainee 2 sessions explicitly gets 403
    res_te_t2_sess = client.get(f"/sessions?trainee_id={t2}", headers=ctx["trainee1_headers"])
    assert res_te_t2_sess.status_code == 403
    assert res_te_t2_sess.json()["error"]["code"] == "FORBIDDEN_RESOURCE_ACCESS"

    # Trainee 1 querying Batch 2 sessions explicitly gets 403
    res_te_b2_sess = client.get(f"/sessions?batch_id={b2}", headers=ctx["trainee1_headers"])
    assert res_te_b2_sess.status_code == 403
    assert res_te_b2_sess.json()["error"]["code"] == "FORBIDDEN_COHORT_ACCESS"

    # Trainee 1 reading Session 2 directly gets 403
    res_te_s2 = client.get(f"/sessions/{s2}", headers=ctx["trainee1_headers"])
    assert res_te_s2.status_code == 403
    assert res_te_s2.json()["error"]["code"] == "FORBIDDEN_RESOURCE_ACCESS"

    # Trainee 1 submitting practice drill for Trainee 2 gets 403
    res_te_drill = client.post(
        "/sessions/practice",
        json={"trainee_id": t2, "module_id": mod_id, "score": 88.0, "errors": 1, "time_seconds": 400},
        headers=ctx["trainee1_headers"]
    )
    assert res_te_drill.status_code == 403
    assert res_te_drill.json()["error"]["code"] == "FORBIDDEN_RESOURCE_ACCESS"


def test_session_notes_authorization(client, multi_cohort_context):
    """Session notes object authorization:
    - Trainer 1 can add/read notes on Session 1 (assigned cohort).
    - Trainer 1 cannot add or read notes on Session 2 (unassigned cohort).
    - Trainee 1 can read notes on Session 1, but cannot add notes (trainer only).
    - Trainee 1 cannot read notes on Session 2 (unauthorized).
    """
    ctx = multi_cohort_context
    s1 = ctx["s1_id"]
    s2 = ctx["s2_id"]

    # Trainer 1 adding note on Session 1 succeeds
    res_n1 = client.post(
        f"/sessions/{s1}/notes",
        json={"text": "Solid comprehension on basics"},
        headers=ctx["trainer1_headers"]
    )
    assert res_n1.status_code == 201

    # Trainer 1 reading notes on Session 1 succeeds
    assert client.get(f"/sessions/{s1}/notes", headers=ctx["trainer1_headers"]).status_code == 200

    # Trainer 1 adding note on Session 2 is rejected (403)
    res_n2_post = client.post(
        f"/sessions/{s2}/notes",
        json={"text": "Unauthorized cross-cohort note"},
        headers=ctx["trainer1_headers"]
    )
    assert res_n2_post.status_code == 403
    assert res_n2_post.json()["error"]["code"] == "FORBIDDEN_COHORT_ACCESS"

    # Trainer 1 reading notes on Session 2 is rejected (403)
    res_n2_get = client.get(f"/sessions/{s2}/notes", headers=ctx["trainer1_headers"])
    assert res_n2_get.status_code == 403
    assert res_n2_get.json()["error"]["code"] == "FORBIDDEN_COHORT_ACCESS"

    # Trainee 1 cannot create session notes (trainer only)
    res_te_post = client.post(
        f"/sessions/{s1}/notes",
        json={"text": "Trainee attempting note creation"},
        headers=ctx["trainee1_headers"]
    )
    assert res_te_post.status_code == 403

    # Trainee 1 reading notes on own session (s1) succeeds
    assert client.get(f"/sessions/{s1}/notes", headers=ctx["trainee1_headers"]).status_code == 200

    # Trainee 1 reading notes on foreign session (s2) is rejected (403)
    res_te_s2_notes = client.get(f"/sessions/{s2}/notes", headers=ctx["trainee1_headers"])
    assert res_te_s2_notes.status_code == 403
    assert res_te_s2_notes.json()["error"]["code"] == "FORBIDDEN_RESOURCE_ACCESS"


def test_analytics_scoping_compare_and_overview(client, multi_cohort_context):
    """Analytics multi-cohort aggregations:
    - Trainer 1 compare endpoint returns only Cohort 1.
    - Trainer 1 overview endpoint returns metrics and batches list scoped only to Cohort 1.
    - Admin compare endpoint returns both Cohort 1 and Cohort 2.
    """
    ctx = multi_cohort_context
    b1 = ctx["batch1_id"]
    b2 = ctx["batch2_id"]

    # Trainer 1 compare
    res_comp = client.get("/analytics/batches/compare", headers=ctx["trainer1_headers"])
    assert res_comp.status_code == 200
    comp_batch_ids = [b["batch_id"] for b in res_comp.json()]
    assert b1 in comp_batch_ids
    assert b2 not in comp_batch_ids

    # Trainer 1 overview
    res_ov = client.get("/analytics/overview", headers=ctx["trainer1_headers"])
    assert res_ov.status_code == 200
    ov_data = res_ov.json()
    ov_batch_ids = [b["batch_id"] for b in ov_data["batches"]]
    assert b1 in ov_batch_ids
    assert b2 not in ov_batch_ids
    assert ov_data["total_batches"] == len(ov_batch_ids)

    # Admin compare
    res_admin_comp = client.get("/analytics/batches/compare", headers=ctx["admin_headers"])
    assert res_admin_comp.status_code == 200
    admin_comp_ids = [b["batch_id"] for b in res_admin_comp.json()]
    assert b1 in admin_comp_ids
    assert b2 in admin_comp_ids


def test_csv_and_bulk_import_scoping_for_trainers(client, multi_cohort_context):
    """Bulk and CSV imports reject records for trainees from unassigned cohorts:
    - Trainer 1 uploading CSV row for Trainee 2 receives row failure.
    - Admin uploading CSV row for Trainee 2 succeeds.
    """
    ctx = multi_cohort_context
    t2_email = ctx["t2_email"]
    mod_name = ctx["mod_name"]

    csv_content = f"trainee_email,module_name,score,errors,time_seconds\n{t2_email},{mod_name},80.0,2,600\n"

    # Trainer 1 bulk upload with Trainee 2
    files = {"file": ("unauthorized_batch.csv", csv_content.encode("utf-8"), "text/csv")}
    res_bulk = client.post("/sessions/bulk", files=files, headers=ctx["trainer1_headers"])
    assert res_bulk.status_code == 200
    bulk_data = res_bulk.json()
    assert bulk_data["inserted"] == 0
    assert bulk_data["failed"] >= 1
    assert any("Trainer is not assigned to cohort" in err["message"] for err in bulk_data["errors"])

    # Trainer 1 import preview/dry-run with Trainee 2
    files_import = {"file": ("unauthorized_import.csv", csv_content.encode("utf-8"), "text/csv")}
    res_import = client.post("/sessions/import?dry_run=true", files=files_import, headers=ctx["trainer1_headers"])
    assert res_import.status_code == 200
    import_data = res_import.json()
    assert import_data["success"] is False
    assert any("Trainer is not assigned to cohort" in row["error"] for row in import_data["errors"] if row.get("error"))


def test_module_crud_role_escalation_denial(client, multi_cohort_context):
    """Module modification endpoints are strictly admin-only:
    - Trainees and trainers receive 403 FORBIDDEN_ROLE on creation, update, deletion.
    - Unauthenticated requests receive 401 UNAUTHORIZED on list, detail, and mutations.
    """
    ctx = multi_cohort_context
    mod_id = ctx["mod_id"]

    # Trainee mutations fail with 403
    res_te_post = client.post("/modules", json={"name": "Tampered Mod", "max_score": 100.0}, headers=ctx["trainee1_headers"])
    assert res_te_post.status_code == 403
    assert res_te_post.json()["error"]["code"] in ("FORBIDDEN_ROLE", "FORBIDDEN_ADMIN_ONLY")

    res_te_put = client.put(f"/modules/{mod_id}", json={"name": "Updated Mod"}, headers=ctx["trainee1_headers"])
    assert res_te_put.status_code == 403
    assert res_te_put.json()["error"]["code"] in ("FORBIDDEN_ROLE", "FORBIDDEN_ADMIN_ONLY")

    res_te_del = client.delete(f"/modules/{mod_id}", headers=ctx["trainee1_headers"])
    assert res_te_del.status_code == 403
    assert res_te_del.json()["error"]["code"] in ("FORBIDDEN_ROLE", "FORBIDDEN_ADMIN_ONLY")

    # Trainer mutations fail with 403
    res_tr_post = client.post("/modules", json={"name": "Trainer Mod", "max_score": 100.0}, headers=ctx["trainer1_headers"])
    assert res_tr_post.status_code == 403
    assert res_tr_post.json()["error"]["code"] in ("FORBIDDEN_ROLE", "FORBIDDEN_ADMIN_ONLY")

    res_tr_put = client.put(f"/modules/{mod_id}", json={"name": "Updated Mod"}, headers=ctx["trainer1_headers"])
    assert res_tr_put.status_code == 403
    assert res_tr_put.json()["error"]["code"] in ("FORBIDDEN_ROLE", "FORBIDDEN_ADMIN_ONLY")

    res_tr_del = client.delete(f"/modules/{mod_id}", headers=ctx["trainer1_headers"])
    assert res_tr_del.status_code == 403
    assert res_tr_del.json()["error"]["code"] in ("FORBIDDEN_ROLE", "FORBIDDEN_ADMIN_ONLY")

    # Unauthenticated requests receive 401
    assert client.get("/modules").status_code == 401
    assert client.get(f"/modules/{mod_id}").status_code == 401
    assert client.post("/modules", json={"name": "Anon Mod", "max_score": 100.0}).status_code == 401


def test_remediations_cross_trainee_and_role_denial(client, db_session, multi_cohort_context):
    """Remediation intervention lifecycle authorization:
    - Trainee cannot complete another trainee's remediation.
    - Trainee cannot resolve any remediation (staff only).
    - Trainer cannot resolve remediation of trainee in another cohort.
    - Trainer cannot list remediations for another cohort's trainee.
    - Trainee cannot view another trainee's remediations.
    """
    ctx = multi_cohort_context
    t1_id = ctx["t1_id"]
    t2_id = ctx["t2_id"]
    mod_id = ctx["mod_id"]

    # Seed remediations
    r1 = Remediation(
        trainee_id=t1_id,
        module_id=mod_id,
        assigned_by=ctx["trainer1_user_id"],
        note="Practice module 1",
        status="Assigned"
    )
    r2 = Remediation(
        trainee_id=t2_id,
        module_id=mod_id,
        assigned_by=ctx["trainer2_user_id"],
        note="Practice module 2",
        status="Assigned"
    )
    db_session.add_all([r1, r2])
    db_session.commit()

    try:
        # Trainee 1 completing own remediation (r1) succeeds
        res_comp_own = client.post(
            f"/remediations/{r1.id}/complete",
            json={"completion_notes": "Completed practice drill"},
            headers=ctx["trainee1_headers"]
        )
        assert res_comp_own.status_code == 200

        # Trainee 1 attempting to complete Trainee 2's remediation (r2) is rejected (403)
        res_comp_other = client.post(
            f"/remediations/{r2.id}/complete",
            json={"completion_notes": "Malicious completion attempt"},
            headers=ctx["trainee1_headers"]
        )
        assert res_comp_other.status_code == 403
        assert res_comp_other.json()["error"]["code"] == "FORBIDDEN_RESOURCE_ACCESS"

        # Trainee 1 attempting to resolve r1 is rejected (staff only, 403)
        res_res_te = client.post(
            f"/remediations/{r1.id}/resolve",
            json={"reassessment_score": 90.0},
            headers=ctx["trainee1_headers"]
        )
        assert res_res_te.status_code == 403
        assert res_res_te.json()["error"]["code"] in ("FORBIDDEN_ROLE", "FORBIDDEN_STAFF_ONLY")

        # Trainer 1 attempting to resolve Trainee 2's remediation (r2) is rejected (403)
        res_res_tr2 = client.post(
            f"/remediations/{r2.id}/resolve",
            json={"reassessment_score": 85.0},
            headers=ctx["trainer1_headers"]
        )
        assert res_res_tr2.status_code == 403
        assert res_res_tr2.json()["error"]["code"] == "FORBIDDEN_RESOURCE_ACCESS"

        # Trainer 1 resolving Trainee 1's remediation succeeds
        res_res_tr1 = client.post(
            f"/remediations/{r1.id}/resolve",
            json={"reassessment_score": 88.0},
            headers=ctx["trainer1_headers"]
        )
        assert res_res_tr1.status_code == 200

        # Trainer 1 reading Trainee 2 remediations returns 403
        res_rem_tr_t2 = client.get(f"/trainees/{t2_id}/remediations", headers=ctx["trainer1_headers"])
        assert res_rem_tr_t2.status_code == 403
        assert res_rem_tr_t2.json()["error"]["code"] == "FORBIDDEN_COHORT_ACCESS"

        # Trainee 1 reading Trainee 2 remediations returns 403
        res_rem_te_t2 = client.get(f"/trainees/{t2_id}/remediations", headers=ctx["trainee1_headers"])
        assert res_rem_te_t2.status_code == 403
        assert res_rem_te_t2.json()["error"]["code"] == "FORBIDDEN_RESOURCE_ACCESS"

        # Unauthenticated request returns 401
        assert client.get(f"/trainees/{t1_id}/remediations").status_code == 401
    finally:
        for r in [r1, r2]:
            try:
                db_session.delete(r)
            except Exception:
                pass
        try:
            db_session.commit()
        except Exception:
            db_session.rollback()


def test_messaging_and_attachments_cross_cohort_isolation(client, multi_cohort_context):
    """Messaging matrix and attachment participant isolation:
    - Admins cannot send or read private/batch messages (403).
    - Trainer 1 cannot message Trainer 2 (403).
    - Trainer 1 cannot message Trainee 2 (unassigned cohort, 403).
    - Trainee 1 cannot message Trainee 2 (different cohort, 403).
    - Trainee 1 cannot access Batch 2 channel (403).
    - Trainer 1 cannot access Batch 2 channel (403).
    - Trainee 1 cannot read thread with Trainee 2 (403).
    """
    ctx = multi_cohort_context
    b2 = ctx["batch2_id"]
    tr1_user = ctx["trainer1_user_id"]
    tr2_user = ctx["trainer2_user_id"]
    te1_user = ctx["trainee1_user_id"]
    te2_user = ctx["trainee2_user_id"]

    # 1. Admin blocked from messaging
    res_adm_msg = client.post(
        "/messages",
        json={"channel": "batch", "batch_id": b2, "body": "Admin announcement"},
        headers=ctx["admin_headers"]
    )
    assert res_adm_msg.status_code == 403
    assert res_adm_msg.json()["error"]["code"] == "FORBIDDEN_ROLE"

    res_adm_priv = client.post(
        "/messages",
        json={"channel": "private", "recipient_id": te1_user, "body": "Admin private msg"},
        headers=ctx["admin_headers"]
    )
    assert res_adm_priv.status_code == 403

    # 2. Trainer-to-trainer blocked
    res_tr_tr = client.post(
        "/messages",
        json={"channel": "private", "recipient_id": tr2_user, "body": "Hey peer trainer"},
        headers=ctx["trainer1_headers"]
    )
    assert res_tr_tr.status_code == 403
    assert res_tr_tr.json()["error"]["code"] == "FORBIDDEN_ROLE"

    # 3. Trainer 1 to Trainee 2 (different cohort) blocked
    res_tr_te2 = client.post(
        "/messages",
        json={"channel": "private", "recipient_id": te2_user, "body": "Cross-cohort trainer message"},
        headers=ctx["trainer1_headers"]
    )
    assert res_tr_te2.status_code == 403
    assert res_tr_te2.json()["error"]["code"] == "FORBIDDEN_RESOURCE_ACCESS"

    # 4. Trainee 1 to Trainee 2 (different cohort) blocked
    res_te_te2 = client.post(
        "/messages",
        json={"channel": "private", "recipient_id": te2_user, "body": "Cross-cohort trainee message"},
        headers=ctx["trainee1_headers"]
    )
    assert res_te_te2.status_code == 403
    assert res_te_te2.json()["error"]["code"] == "FORBIDDEN_RESOURCE_ACCESS"

    # 5. Cohort batch channel isolation
    res_te_b2 = client.get(f"/messages/batch/{b2}", headers=ctx["trainee1_headers"])
    assert res_te_b2.status_code == 403
    assert res_te_b2.json()["error"]["code"] == "FORBIDDEN_RESOURCE_ACCESS"

    res_tr_b2 = client.get(f"/messages/batch/{b2}", headers=ctx["trainer1_headers"])
    assert res_tr_b2.status_code == 403
    assert res_tr_b2.json()["error"]["code"] == "FORBIDDEN_RESOURCE_ACCESS"

    # 6. Thread retrieval isolation
    res_th = client.get(f"/messages/private/{te2_user}", headers=ctx["trainee1_headers"])
    assert res_th.status_code == 403
    assert res_th.json()["error"]["code"] == "FORBIDDEN_RESOURCE_ACCESS"


def test_admin_endpoints_role_escalation_denial(client, multi_cohort_context):
    """Admin-only endpoints strictly reject non-admin roles:
    - Trainers receive 403 FORBIDDEN_ROLE.
    - Trainees receive 403 FORBIDDEN_ROLE.
    - Unauthenticated requests receive 401 UNAUTHORIZED.
    """
    ctx = multi_cohort_context

    admin_routes = [
        "/admin/users",
        "/admin/audit-logs",
        "/admin/data-quality",
        "/admin/model-evaluation",
        "/admin/service-health",
    ]

    for route in admin_routes:
        # Trainer denied
        res_tr = client.get(route, headers=ctx["trainer1_headers"])
        assert res_tr.status_code == 403
        assert res_tr.json()["error"]["code"] in ("FORBIDDEN_ROLE", "FORBIDDEN_ADMIN_ONLY")

        # Trainee denied
        res_te = client.get(route, headers=ctx["trainee1_headers"])
        assert res_te.status_code == 403
        assert res_te.json()["error"]["code"] in ("FORBIDDEN_ROLE", "FORBIDDEN_ADMIN_ONLY")

        # Unauthenticated denied
        res_anon = client.get(route)
        assert res_anon.status_code == 401


def test_unauthenticated_request_denial_across_endpoints(client, multi_cohort_context):
    """Unauthenticated requests must be denied across all protected domain routes (401 UNAUTHORIZED)."""
    ctx = multi_cohort_context
    b1 = ctx["batch1_id"]
    t1 = ctx["t1_id"]
    s1 = ctx["s1_id"]

    protected_endpoints = [
        ("GET", "/batches"),
        ("GET", f"/batches/{b1}"),
        ("GET", "/trainees"),
        ("GET", f"/trainees/{t1}"),
        ("GET", "/sessions"),
        ("GET", f"/sessions/{s1}"),
        ("GET", "/messages/contacts"),
        ("GET", "/analytics/overview"),
        ("GET", f"/analytics/batches/{b1}/summary"),
        ("GET", "/help/search"),
    ]

    for method, path in protected_endpoints:
        if method == "GET":
            res = client.get(path)
        elif method == "POST":
            res = client.post(path, json={})
        assert res.status_code == 401, f"Expected 401 for unauthenticated {method} {path}, got {res.status_code}"


def test_trainee_staff_endpoint_denials(client, multi_cohort_context):
    """Trainees are strictly rejected from staff-only operations (403 FORBIDDEN_ROLE / FORBIDDEN_TRAINEE_ROSTER_ACCESS):
    - Batch leaderboard, attention queue, exports, misconceptions.
    - Multi-batch compare and overview.
    - Regular session creation (only practice self-drill is allowed).
    - Trainer Copilot query.
    """
    ctx = multi_cohort_context
    b1 = ctx["batch1_id"]
    mod_id = ctx["mod_id"]
    t1 = ctx["t1_id"]
    headers = ctx["trainee1_headers"]

    # Analytics staff-only
    assert client.get(f"/analytics/batches/{b1}/leaderboard", headers=headers).status_code == 403
    assert client.get(f"/analytics/batches/{b1}/attention", headers=headers).status_code == 403
    assert client.get(f"/analytics/batches/{b1}/at-risk/export", headers=headers).status_code == 403
    assert client.get(f"/analytics/batches/{b1}/weekly-summary/export", headers=headers).status_code == 403
    assert client.get(f"/analytics/batches/{b1}/misconceptions", headers=headers).status_code == 403
    assert client.get("/analytics/batches/compare", headers=headers).status_code == 403
    assert client.get("/analytics/overview", headers=headers).status_code == 403

    # Copilot query staff-only
    res_cop = client.post("/help/trainer-copilot", json={"batch_id": b1, "query": "Test"}, headers=headers)
    assert res_cop.status_code == 403

    # Regular session creation staff-only
    res_sess = client.post(
        "/sessions",
        json={"trainee_id": t1, "module_id": mod_id, "score": 90.0, "errors": 0, "time_seconds": 300},
        headers=headers
    )
    assert res_sess.status_code == 403
