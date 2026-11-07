"""Tests for ML prediction service and backend risk integration client.
Verifies:
1. /health and /predict endpoints with input validation (scores 0-100, session_count >= 5) and HTTP 422 handling.
2. Trainees with < 5 sessions route through method='rule'.
3. Unreachable/timed-out ML service gracefully degrades to method='rule' with a diagnostic reason string.
4. Trainees with 6+ sessions and service available return method='ml' with model_version.
5. RBAC security: trainees cannot read other trainees' risk (HTTP 403), while trainers/admins can.
"""

from datetime import datetime, timezone, timedelta
from unittest.mock import patch
import pytest
from fastapi.testclient import TestClient
import httpx

from ml_service.main import app as ml_app
from app.models.batch import Batch
from app.models.trainee import Trainee
from app.models.module import Module
from app.models.session import Session as AssessmentSession
from app.core.constants import PASS_THRESHOLD


@pytest.fixture
def ml_client():
    """TestClient for standalone ML prediction microservice."""
    with TestClient(ml_app) as c:
        yield c


def test_ml_service_health_and_predict_endpoints(ml_client):
    """Verify /health returns status ok, /predict returns probability between 0 and 1, and invalid inputs return 422."""
    # 1. Health check
    health_resp = ml_client.get("/health")
    assert health_resp.status_code == 200
    assert health_resp.json() == {"status": "ok"}

    # 2. Model info
    info_resp = ml_client.get("/model-info")
    assert info_resp.status_code == 200
    info_data = info_resp.json()
    assert "model_name" in info_data
    assert "version" in info_data
    assert "threshold_used" in info_data
    assert "feature_list" in info_data
    assert len(info_data["feature_list"]) == 8

    # 3. Valid prediction request
    valid_payload = {
        "last_1_score": 55.0,
        "last_3_mean_score": 58.0,
        "overall_mean_score": 59.0,
        "slope_last_5": -1.2,
        "error_rate": 4.5,
        "mean_time": 1800.0,
        "session_count": 6,
        "score_std": 5.2,
    }
    pred_resp = ml_client.post("/predict", json=valid_payload)
    assert pred_resp.status_code == 200
    data = pred_resp.json()
    assert "probability" in data
    assert 0.0 <= data["probability"] <= 1.0
    assert data["label"] in (0, 1)
    assert "threshold" in data
    assert "model_version" in data
    assert "top_features" in data
    assert len(data["top_features"]) == 2

    # 4. Input validation: invalid score > 100 returns 422
    invalid_score_payload = valid_payload.copy()
    invalid_score_payload["last_1_score"] = 150.0
    resp_invalid_score = ml_client.post("/predict", json=invalid_score_payload)
    assert resp_invalid_score.status_code == 422

    # Input validation: negative score returns 422
    negative_score_payload = valid_payload.copy()
    negative_score_payload["last_3_mean_score"] = -5.0
    resp_neg_score = ml_client.post("/predict", json=negative_score_payload)
    assert resp_neg_score.status_code == 422

    # Input validation: session_count < 5 returns 422
    low_session_payload = valid_payload.copy()
    low_session_payload["session_count"] = 4
    resp_low_sessions = ml_client.post("/predict", json=low_session_payload)
    assert resp_low_sessions.status_code == 422

    # Input validation: negative error rate returns 422
    negative_error_payload = valid_payload.copy()
    negative_error_payload["error_rate"] = -1.0
    resp_neg_error = ml_client.post("/predict", json=negative_error_payload)
    assert resp_neg_error.status_code == 422


def test_trainee_with_4_sessions_gets_method_rule(client, db_session, trainer_headers):
    """A trainee with 4 sessions cannot be evaluated by the ML model (min 5 required); must use rule method."""
    batch = db_session.query(Batch).first()
    mod = Module(name="Mod ML Test 4", max_score=100.0)
    trainee = Trainee(name="Trainee 4 Sessions", email="trainee4@test.internal", batch_id=batch.id)
    db_session.add_all([mod, trainee])
    db_session.flush()

    now = datetime.now(timezone.utc)
    for i in range(4):
        sess = AssessmentSession(
            trainee_id=trainee.id,
            module_id=mod.id,
            score=55.0,
            errors=3,
            time_seconds=1200,
            created_at=now - timedelta(days=4 - i),
        )
        db_session.add(sess)
    db_session.commit()

    resp = client.get(f"/analytics/trainees/{trainee.id}/risk", headers=trainer_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["method"] == "rule"
    assert data["threshold_unit"] == "score_percentage"
    assert data["threshold"] == 60.0
    assert "reason" in data and data["reason"] is not None
    assert "4 session(s)" in data["reason"] or "fewer than 5" in data["reason"].lower()
    assert data["label"] == 1  # 55.0% < PASS_THRESHOLD (60.0)
    assert data["probability"] is None


def test_service_unreachable_gets_method_rule_with_reason(client, db_session, trainer_headers):
    """When ML service times out or is unreachable, the system must degrade to method='rule' with a diagnostic reason."""
    batch = db_session.query(Batch).first()
    mod = Module(name="Mod ML Test Unreach", max_score=100.0)
    trainee = Trainee(name="Trainee Unreach", email="trainee_unreach@test.internal", batch_id=batch.id)
    db_session.add_all([mod, trainee])
    db_session.flush()

    now = datetime.now(timezone.utc)
    for i in range(6):
        sess = AssessmentSession(
            trainee_id=trainee.id,
            module_id=mod.id,
            score=70.0,
            errors=2,
            time_seconds=1100,
            created_at=now - timedelta(days=6 - i),
        )
        db_session.add(sess)
    db_session.commit()

    with patch("httpx.post", side_effect=httpx.ConnectTimeout("Connection timed out")):
        resp = client.get(f"/analytics/trainees/{trainee.id}/risk", headers=trainer_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["method"] == "rule"
        assert "unreachable" in data["reason"].lower() or "timed out" in data["reason"].lower()
        assert data["label"] == 0  # 70.0% >= 60.0


def test_trainee_with_6_plus_sessions_and_service_up_gets_method_ml(client, db_session, trainer_headers):
    """When the trainee has 6+ sessions and the ML service is responsive, return method='ml' with model details."""
    batch = db_session.query(Batch).first()
    mod = Module(name="Mod ML Test 6Plus", max_score=100.0)
    trainee = Trainee(name="Trainee 6Plus", email="trainee_6plus@test.internal", batch_id=batch.id)
    db_session.add_all([mod, trainee])
    db_session.flush()

    now = datetime.now(timezone.utc)
    for i in range(7):
        sess = AssessmentSession(
            trainee_id=trainee.id,
            module_id=mod.id,
            score=52.0,
            errors=5,
            time_seconds=1400,
            created_at=now - timedelta(days=7 - i),
        )
        db_session.add(sess)
    db_session.commit()

    mock_service_response = httpx.Response(
        status_code=200,
        json={
            "probability": 0.84,
            "label": 1,
            "threshold": 0.67,
            "model_version": "1.0.0",
            "top_features": [
                {"feature": "last_3_mean_score", "importance": 0.28, "explanation": "Global Random Forest feature importance"},
                {"feature": "overall_mean_score", "importance": 0.22, "explanation": "Global Random Forest feature importance"},
            ],
        },
        request=httpx.Request("POST", "http://127.0.0.1:8001/predict"),
    )

    with patch("httpx.post", return_value=mock_service_response):
        resp = client.get(f"/analytics/trainees/{trainee.id}/risk", headers=trainer_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["method"] == "ml"
        assert data["reason"] is None
        assert data["label"] == 1
        assert data["probability"] == 0.84
        assert data["threshold"] == 0.67
        assert data["threshold_unit"] == "probability"
        assert data["model_version"] == "1.0.0"
        assert len(data["top_features"]) == 2


def test_trainee_cannot_read_another_trainees_risk(client, db_session, trainee_headers):
    """RBAC security: trainee with ID 1 can view their own risk, but requesting another trainee's risk yields HTTP 403."""
    # trainee_headers in conftest is authenticated as trainee_id=1
    # 1. Own risk: allowed (HTTP 200)
    own_resp = client.get("/analytics/trainees/1/risk", headers=trainee_headers)
    assert own_resp.status_code == 200

    # 2. Another trainee's risk (trainee_id=2): forbidden (HTTP 403)
    other_resp = client.get("/analytics/trainees/2/risk", headers=trainee_headers)
    assert other_resp.status_code == 403
