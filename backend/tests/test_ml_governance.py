"""Tests for Machine Learning Governance, Transparency, and Advisory Policy.
Verifies:
1. predict_trainee_attention returns is_advisory=True and advisory_disclaimer on all branches.
2. predict_trainee_risk returns is_advisory=True and advisory_disclaimer on all branches.
3. Practice sessions (is_practice=True) are strictly excluded from feature extraction and risk counts.
4. /analytics/trainees/{id}/risk endpoint exposes is_advisory=True and disclaimer.
5. /analytics/trainees/{id}/ml-prediction endpoint exposes is_advisory=True and disclaimer.
6. /analytics/batches/{batch_id}/ml-attention endpoint exposes is_advisory=True and disclaimer.
7. /analytics/ml/model-info endpoint exposes is_advisory=True and disclaimer.
"""

from datetime import datetime, timezone, timedelta
from unittest.mock import patch
import pytest
from fastapi.testclient import TestClient

from app.models.batch import Batch
from app.models.trainee import Trainee
from app.models.module import Module
from app.models.session import Session as AssessmentSession
from app.core.constants import ML_ADVISORY_DISCLAIMER, PASS_THRESHOLD
from app.ml.predictor import predict_trainee_attention, get_metrics_summary, get_batch_ml_attention
from app.services.ml_client import predict_trainee_risk
from app.ml.feature_extractor import extract_trainee_features


def test_predict_trainee_attention_advisory_fields(db_session):
    """Verify predict_trainee_attention returns is_advisory=True and advisory_disclaimer."""
    trainee = db_session.query(Trainee).first()
    assert trainee is not None

    res = predict_trainee_attention(db_session, trainee.id)
    assert res.get("is_advisory") is True
    assert res.get("advisory_disclaimer") == ML_ADVISORY_DISCLAIMER


def test_predict_trainee_risk_advisory_fields(db_session):
    """Verify predict_trainee_risk returns is_advisory=True and advisory_disclaimer."""
    trainee = db_session.query(Trainee).first()
    assert trainee is not None

    res = predict_trainee_risk(db_session, trainee.id)
    assert res.get("is_advisory") is True
    assert res.get("advisory_disclaimer") == ML_ADVISORY_DISCLAIMER


def test_metrics_summary_advisory_fields():
    """Verify get_metrics_summary returns is_advisory=True and disclaimer."""
    summary = get_metrics_summary()
    assert summary.get("is_advisory") is True
    assert summary.get("advisory_disclaimer") == ML_ADVISORY_DISCLAIMER


def test_practice_sessions_excluded_from_ml_features(db_session):
    """Verify practice sessions (is_practice=True) do not pollute ML feature extraction or session count."""
    batch = db_session.query(Batch).first()
    mod = Module(name="Mod ML Practice Test", max_score=100.0)
    trainee = Trainee(name="Trainee Practice Test", email="practice_test@internal.test", batch_id=batch.id)
    db_session.add_all([mod, trainee])
    db_session.flush()

    now = datetime.now(timezone.utc)

    # Add 2 graded sessions
    for i in range(2):
        s = AssessmentSession(
            trainee_id=trainee.id,
            module_id=mod.id,
            score=50.0,
            errors=3,
            time_seconds=1000,
            is_practice=False,
            created_at=now - timedelta(days=5 - i),
        )
        db_session.add(s)

    # Add 5 practice sessions (high score 95%)
    for i in range(5):
        s = AssessmentSession(
            trainee_id=trainee.id,
            module_id=mod.id,
            score=95.0,
            errors=0,
            time_seconds=600,
            is_practice=True,
            created_at=now - timedelta(days=2 - i),
        )
        db_session.add(s)

    db_session.commit()

    # Feature extraction must only see the 2 graded sessions (cold start)
    features = extract_trainee_features(db_session, trainee.id)
    assert features["is_cold_start"] is True
    assert features["session_count"] == 2

    # predict_trainee_risk must also only see 2 sessions and use rule fallback
    risk = predict_trainee_risk(db_session, trainee.id)
    assert risk["method"] == "rule"
    assert "2 session(s)" in risk["reason"]
    assert risk["is_advisory"] is True


def test_practice_sessions_cannot_alter_ml_predictions_or_dataset(db_session):
    """Proves that a failing trainee (5 graded sessions @ 40%) cannot game ML predictions,
    feature extraction, or training dataset generation by adding 10 practice sessions with 100% scores.
    """
    from scripts.build_ml_dataset import build_dataset_rows_for_trainee

    batch = db_session.query(Batch).first()
    mod = Module(name="Mod Gaming Test", max_score=100.0)
    trainee = Trainee(name="Trainee Gaming Test", email="gaming_test@internal.test", batch_id=batch.id)
    db_session.add_all([mod, trainee])
    db_session.flush()

    now = datetime.now(timezone.utc)
    # 5 failing graded sessions (40.0% score)
    for i in range(5):
        s = AssessmentSession(
            trainee_id=trainee.id,
            module_id=mod.id,
            score=40.0,
            errors=6,
            time_seconds=1500,
            is_practice=False,
            created_at=now - timedelta(days=20 - i),
        )
        db_session.add(s)
    db_session.commit()

    # Baseline prediction before practice sessions
    features_before = extract_trainee_features(db_session, trainee.id)
    assert features_before["session_count"] == 5
    assert features_before["features"]["overall_avg_score"] == 40.0
    attention_before = predict_trainee_attention(db_session, trainee.id)
    assert attention_before["requires_attention"] is True
    risk_before = predict_trainee_risk(db_session, trainee.id)
    assert risk_before["label"] == 1

    # Now trainee inserts 10 practice sessions with 100.0% scores and 0 errors
    for i in range(10):
        s = AssessmentSession(
            trainee_id=trainee.id,
            module_id=mod.id,
            score=100.0,
            errors=0,
            time_seconds=300,
            is_practice=True,
            created_at=now - timedelta(days=10 - i),
        )
        db_session.add(s)
    db_session.commit()

    # Query sessions query-level (matching build_ml_dataset & ml_client)
    filtered_sessions = (
        db_session.query(AssessmentSession, Module.max_score)
        .join(Module, Module.id == AssessmentSession.module_id)
        .filter(AssessmentSession.trainee_id == trainee.id)
        .filter((AssessmentSession.is_practice == False) | (AssessmentSession.is_practice.is_(None)))
        .order_by(AssessmentSession.created_at.asc(), AssessmentSession.id.asc())
        .all()
    )
    assert len(filtered_sessions) == 5, "Query-level filter must completely ignore the 10 practice sessions"

    # Verify features after practice insertion remain identical to before
    features_after = extract_trainee_features(db_session, trainee.id)
    assert features_after["session_count"] == 5
    assert features_after["features"]["overall_avg_score"] == 40.0

    # Verify attention prediction remains requires_attention=True
    attention_after = predict_trainee_attention(db_session, trainee.id)
    assert attention_after["requires_attention"] is True

    # Verify risk prediction remains label=1
    risk_after = predict_trainee_risk(db_session, trainee.id)
    assert risk_after["label"] == 1

    # Verify build_dataset_rows_for_trainee only processes the 5 graded sessions
    dataset_rows = build_dataset_rows_for_trainee(filtered_sessions, trainee.id)
    assert len(dataset_rows) == 0, "No dataset rows should be created from only 5 graded sessions"


def test_endpoints_expose_advisory_contract(client, db_session, trainer_headers):
    """Verify all HTTP endpoints serving ML outputs include is_advisory=True and advisory_disclaimer."""
    trainee = db_session.query(Trainee).first()
    batch = db_session.query(Batch).first()

    # 1. Trainee Risk endpoint
    resp_risk = client.get(f"/analytics/trainees/{trainee.id}/risk", headers=trainer_headers)
    assert resp_risk.status_code == 200
    data_risk = resp_risk.json()
    assert data_risk.get("is_advisory") is True
    assert "Advisory only" in data_risk.get("advisory_disclaimer", "")

    # 2. Trainee ML prediction endpoint
    resp_pred = client.get(f"/analytics/trainees/{trainee.id}/ml-prediction", headers=trainer_headers)
    assert resp_pred.status_code == 200
    data_pred = resp_pred.json()
    assert data_pred.get("is_advisory") is True
    assert "Advisory only" in data_pred.get("advisory_disclaimer", "")

    # 3. Batch ML attention queue endpoint
    resp_att = client.get(f"/analytics/batches/{batch.id}/ml-attention", headers=trainer_headers)
    assert resp_att.status_code == 200
    att_items = resp_att.json()
    for item in att_items:
        assert item.get("is_advisory") is True
        assert "Advisory only" in item.get("advisory_disclaimer", "")

    # 4. Model info endpoint
    resp_info = client.get("/analytics/ml/model-info", headers=trainer_headers)
    assert resp_info.status_code == 200
    data_info = resp_info.json()
    assert data_info.get("is_advisory") is True
    assert "Advisory only" in data_info.get("advisory_disclaimer", "")

