"""Tests for audited analytical enhancements:
- Curriculum Misconception & Error Clustering (GET /analytics/batches/{id}/misconceptions, POST approval)
- Grounded Trainer Copilot (POST /help/trainer-copilot with grounded answer & insufficient evidence cases)
"""

from datetime import datetime, timezone
import pytest

from app.models.module import Module
from app.models.session import Session
from app.models.session_note import SessionNote
from app.models.batch import Batch
from app.models.batch_trainer import BatchTrainer
from app.models.trainee import Trainee


def test_misconception_clustering_and_approval(client, db_session, trainer_headers):
    """Verifies TF-IDF clustering on qualitative feedback notes and human trainer approval toggle."""
    now = datetime.now(timezone.utc)
    mod = Module(name="Docker & Microservices", max_score=100.0)
    db_session.add(mod)
    db_session.commit()

    notes = [
        "Docker container exits with code 137 due to OOM killer memory limit exceeded in multi-stage build.",
        "Container crashed with OOM kill on worker node; insufficient memory allocation in container manifest.",
        "SQLAlchemy connection pool exhausted during load test, leaking database sessions without closing.",
        "Database connection timeout due to idle session leak in background worker task."
    ]

    for i, note in enumerate(notes):
        s = Session(
            trainee_id=1,
            module_id=mod.id,
            score=50.0,
            errors=3,
            time_seconds=900,
            created_at=now
        )
        db_session.add(s)
        db_session.flush()

        sn = SessionNote(
            session_id=s.id,
            author_id=10,
            text=note,
            created_at=now
        )
        db_session.add(sn)
    db_session.commit()

    # Ensure trainer 10 is assigned to Batch 1
    assignment = db_session.query(BatchTrainer).filter(BatchTrainer.batch_id == 1, BatchTrainer.trainer_id == 10).first()
    if not assignment:
        db_session.add(BatchTrainer(batch_id=1, trainer_id=10))
        db_session.commit()

    # Query misconceptions for Batch 1 (trainer 10 is assigned to Batch 1 in conftest)
    resp = client.get("/analytics/batches/1/misconceptions", headers=trainer_headers)
    assert resp.status_code == 200
    data = resp.json()

    assert data["batch_id"] == 1
    assert "clusters" in data
    assert isinstance(data["clusters"], list)

    if len(data["clusters"]) > 0:
        cluster = data["clusters"][0]
        cid = cluster["id"]
        assert "title" in cluster
        assert "suggested_action" in cluster

        # Toggle approval state on and off
        appr_resp = client.post(
            f"/analytics/batches/1/misconceptions/{cid}/approval?approved=true",
            headers=trainer_headers
        )
        assert appr_resp.status_code == 200
        assert appr_resp.json()["approved"] is True

        unappr_resp = client.post(
            f"/analytics/batches/1/misconceptions/{cid}/approval?approved=false",
            headers=trainer_headers
        )
        assert unappr_resp.status_code == 200
        assert unappr_resp.json()["approved"] is False


def test_batch_remediation_listing_and_rbac(client, trainer_headers, trainee_headers):
    """Verifies batch remediation listing returns structured outcome items and blocks trainee callers."""
    res_ok = client.get("/batches/1/remediations", headers=trainer_headers)
    assert res_ok.status_code == 200
    assert isinstance(res_ok.json(), list)

    res_forbidden = client.get("/batches/1/remediations", headers=trainee_headers)
    assert res_forbidden.status_code == 403

    mc_forbidden = client.get("/analytics/batches/1/misconceptions", headers=trainee_headers)
    assert mc_forbidden.status_code == 403

    cop_forbidden = client.post(
        "/help/trainer-copilot",
        json={"batch_id": 1, "query": "Who needs help?"},
        headers=trainee_headers
    )
    assert cop_forbidden.status_code == 403


def test_trainer_copilot_grounded_response_and_insufficient_evidence(client, db_session, trainer_headers):
    """Verifies evidence-grounded queries return citations, and out-of-domain queries return low-confidence disclaimer."""
    # Ensure module exists with low-scoring sessions
    now = datetime.now(timezone.utc)
    mod = db_session.query(Module).filter(Module.name == "Docker & Microservices").first()
    if not mod:
        mod = Module(name="Docker & Microservices", max_score=100.0)
        db_session.add(mod)
        db_session.commit()

    s = Session(trainee_id=1, module_id=mod.id, score=45.0, errors=5, time_seconds=900, created_at=now)
    db_session.add(s)

    assignment = db_session.query(BatchTrainer).filter(BatchTrainer.batch_id == 1, BatchTrainer.trainer_id == 10).first()
    if not assignment:
        db_session.add(BatchTrainer(batch_id=1, trainer_id=10))

    db_session.commit()

    # 1. Grounded query: Ask which trainees need help with the module
    grounded_res = client.post(
        "/help/trainer-copilot",
        json={"batch_id": 1, "query": "Which trainees need help with Docker & Microservices?"},
        headers=trainer_headers
    )
    assert grounded_res.status_code == 200
    g_data = grounded_res.json()
    assert "recorded_facts" in g_data
    assert "generated_suggestions" in g_data
    assert "citations" in g_data
    assert isinstance(g_data["citations"], list)
    assert len(g_data["citations"]) >= 1
    assert g_data["sufficient_evidence"] is True

    # 2. Insufficient evidence query: Ask completely out-of-domain query (astronomy / irrelevant)
    unrelated_res = client.post(
        "/help/trainer-copilot",
        json={"batch_id": 1, "query": "What is the orbital trajectory of Jupiter's moon Europa in kilometer units?"},
        headers=trainer_headers
    )
    assert unrelated_res.status_code == 200
    u_data = unrelated_res.json()
    assert "recorded_facts" in u_data
    assert u_data["sufficient_evidence"] is False
    assert "could not find sufficient evidence" in u_data["recorded_facts"].lower()
