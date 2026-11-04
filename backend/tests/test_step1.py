"""Integration and unit tests for Step 1 verification.
Tests score normalization, pass rate calculation against PASS_THRESHOLD,
trainee RBAC 403 authorization guard, cold-start early intervention rules,
and 4-week longitudinal delta computation.
"""

from datetime import date, datetime, timedelta, timezone
import pytest

from app.core.constants import (
    PASS_THRESHOLD,
    EXCELLENT_THRESHOLD,
    COLD_START_SESSIONS,
    COLD_START_CUTOFF,
)
from app.models.batch import Batch
from app.models.trainee import Trainee
from app.models.module import Module
from app.models.session import Session
from app.services.session_service import SessionService
from app.repositories.analytics_repository import AnalyticsRepository
from app.ml.predictor import predict_trainee_attention


def test_normalization(client, db_session):
    """Test score normalization: score 18 of max 20 gives 90.0%; integer inputs produce correct floats."""
    batch = Batch(name="Norm Test Batch", start_date=date(2026, 1, 1), end_date=date(2026, 6, 1))
    db_session.add(batch)
    db_session.flush()

    trainee = Trainee(name="Norm Trainee", email="norm.trainee@test.internal", batch_id=batch.id)
    # Integer max_score 20 stored as float column
    module_20 = Module(name="Module 20 Pts", max_score=20.0)
    db_session.add_all([trainee, module_20])
    db_session.flush()

    # Pass integer values (18, 2, 600) into Session
    session = Session(
        trainee_id=int(trainee.id),
        module_id=int(module_20.id),
        score=18,
        errors=2,
        time_seconds=600,
        created_at=datetime.now(timezone.utc),
    )
    db_session.add(session)
    db_session.commit()

    # 1. Verify SessionService builder normalization
    service = SessionService(db_session)
    resp = service._build_response(session)

    assert resp.score == 18.0
    assert isinstance(resp.score, float)
    assert resp.score_percentage == 90.0
    assert isinstance(resp.score_percentage, float)

    # 2. Verify SQL analytics repository normalization
    repo = AnalyticsRepository(db_session)
    progress = repo.get_trainee_progress(trainee.id)
    assert len(progress) == 1
    assert progress[0]["score_pct"] == 90.0
    assert isinstance(progress[0]["score_pct"], float)


def test_pass_rate(db_session):
    """Test pass rate calculation: known fixture data gives the expected percentage using PASS_THRESHOLD."""
    batch = Batch(name="Pass Rate Test Batch", start_date=date(2026, 1, 1), end_date=date(2026, 6, 1))
    db_session.add(batch)
    db_session.flush()

    trainee = Trainee(name="Pass Rate Trainee", email="passrate.trainee@test.internal", batch_id=batch.id)
    module_100 = Module(name="Mod 100 Pts Pass Rate", max_score=100.0)
    db_session.add_all([trainee, module_100])
    db_session.flush()

    now = datetime.now(timezone.utc)

    # 4 sessions: 2 passes (>= PASS_THRESHOLD), 2 fails (< PASS_THRESHOLD)
    # Pass 1: Exactly on PASS_THRESHOLD
    s1 = Session(trainee_id=trainee.id, module_id=module_100.id, score=float(PASS_THRESHOLD), errors=1, time_seconds=900, created_at=now)
    # Pass 2: Above PASS_THRESHOLD
    s2 = Session(trainee_id=trainee.id, module_id=module_100.id, score=float(PASS_THRESHOLD + 15.0), errors=0, time_seconds=850, created_at=now)
    # Fail 1: Below PASS_THRESHOLD
    s3 = Session(trainee_id=trainee.id, module_id=module_100.id, score=float(PASS_THRESHOLD - 10.0), errors=4, time_seconds=1200, created_at=now)
    # Fail 2: Well below PASS_THRESHOLD
    s4 = Session(trainee_id=trainee.id, module_id=module_100.id, score=float(PASS_THRESHOLD - 25.0), errors=6, time_seconds=1400, created_at=now)

    db_session.add_all([s1, s2, s3, s4])
    db_session.commit()

    repo = AnalyticsRepository(db_session)
    summary = repo.get_batch_summary(batch.id)

    # 2 out of 4 sessions passed = 50.0%
    expected_pass_rate = round((2 / 4) * 100.0, 1)
    assert summary["session_count"] == 4
    assert summary["pass_rate_pct"] == expected_pass_rate


def test_trainee_403(client, trainee_headers):
    """Test trainee authorization guard: a trainee requesting another trainee's /trainees/:id gets 403."""
    # trainee_headers in conftest is linked to trainee_id=1
    # 1. Requesting own profile (/trainees/1) must succeed
    own_resp = client.get("/trainees/1", headers=trainee_headers)
    assert own_resp.status_code == 200
    assert own_resp.json()["id"] == 1

    # 2. Requesting another trainee's profile (/trainees/2) must return 403 Forbidden
    other_resp = client.get("/trainees/2", headers=trainee_headers)
    assert other_resp.status_code == 403
    assert other_resp.json()["error"]["code"] == "FORBIDDEN_RESOURCE_ACCESS"


def test_cold_start(db_session):
    """Test cold-start heuristic: 2 sessions with average below COLD_START_CUTOFF is flagged;
    2 sessions with average 70 is not; 3+ sessions uses the model path.
    """
    batch = Batch(name="Cold Start Batch", start_date=date(2026, 1, 1), end_date=date(2026, 6, 1))
    db_session.add(batch)
    db_session.flush()

    mod = Module(name="Mod Cold Start", max_score=100.0)
    trainee_low = Trainee(name="Low Trainee", email="low@test.internal", batch_id=batch.id)
    trainee_high = Trainee(name="High Trainee", email="high@test.internal", batch_id=batch.id)
    trainee_model = Trainee(name="Model Trainee", email="model@test.internal", batch_id=batch.id)
    db_session.add_all([mod, trainee_low, trainee_high, trainee_model])
    db_session.flush()

    now = datetime.now(timezone.utc)

    # Trainee A: 2 sessions, average below COLD_START_CUTOFF (e.g. 40% & 44% -> avg 42%)
    db_session.add_all([
        Session(trainee_id=trainee_low.id, module_id=mod.id, score=40.0, errors=5, time_seconds=1200, created_at=now - timedelta(days=2)),
        Session(trainee_id=trainee_low.id, module_id=mod.id, score=44.0, errors=6, time_seconds=1300, created_at=now - timedelta(days=1)),
    ])

    # Trainee B: 2 sessions, average 70.0% (>= COLD_START_CUTOFF)
    db_session.add_all([
        Session(trainee_id=trainee_high.id, module_id=mod.id, score=70.0, errors=2, time_seconds=1000, created_at=now - timedelta(days=2)),
        Session(trainee_id=trainee_high.id, module_id=mod.id, score=70.0, errors=2, time_seconds=1000, created_at=now - timedelta(days=1)),
    ])

    # Trainee C: 3+ sessions (COLD_START_SESSIONS or more)
    db_session.add_all([
        Session(trainee_id=trainee_model.id, module_id=mod.id, score=72.0, errors=2, time_seconds=1000, created_at=now - timedelta(days=3)),
        Session(trainee_id=trainee_model.id, module_id=mod.id, score=74.0, errors=2, time_seconds=1000, created_at=now - timedelta(days=2)),
        Session(trainee_id=trainee_model.id, module_id=mod.id, score=76.0, errors=1, time_seconds=950, created_at=now - timedelta(days=1)),
    ])
    db_session.commit()

    # Case 1: 2 sessions with average below 50 is flagged for attention
    res_low = predict_trainee_attention(db_session, trainee_low.id)
    assert res_low["is_cold_start"] is True
    assert res_low["session_count"] == 2
    assert res_low["requires_attention"] is True
    assert res_low["model_type"] == "Cold-Start Rule-Based Fallback"

    # Case 2: 2 sessions with average 70 is NOT flagged
    res_high = predict_trainee_attention(db_session, trainee_high.id)
    assert res_high["is_cold_start"] is True
    assert res_high["session_count"] == 2
    assert res_high["requires_attention"] is False
    assert res_high["model_type"] == "Cold-Start Rule-Based Fallback"

    # Case 3: 3+ sessions exits cold-start and uses the model inference path
    res_model = predict_trainee_attention(db_session, trainee_model.id)
    assert res_model["is_cold_start"] is False
    assert res_model["session_count"] >= COLD_START_SESSIONS
    assert res_model["model_type"] != "Cold-Start Rule-Based Fallback"


def test_4_week_delta(db_session):
    """Test 4-week longitudinal delta: sessions placed at known dates produce the expected delta."""
    batch = Batch(name="Delta Test Batch", start_date=date(2026, 1, 1), end_date=date(2026, 6, 1))
    db_session.add(batch)
    db_session.flush()

    trainee = Trainee(name="Delta Trainee", email="delta.trainee@test.internal", batch_id=batch.id)
    mod = Module(name="Mod Delta", max_score=100.0)
    db_session.add_all([trainee, mod])
    db_session.flush()

    now_utc = datetime.now(timezone.utc)

    # Recent session (within last 28 days: e.g. 10 days ago) -> score = 85.0%
    s_recent = Session(
        trainee_id=trainee.id,
        module_id=mod.id,
        score=85.0,
        errors=1,
        time_seconds=900,
        created_at=now_utc - timedelta(days=10),
    )
    # Prior session (between 28 and 56 days ago: e.g. 40 days ago) -> score = 65.0%
    s_prior = Session(
        trainee_id=trainee.id,
        module_id=mod.id,
        score=65.0,
        errors=3,
        time_seconds=1100,
        created_at=now_utc - timedelta(days=40),
    )

    db_session.add_all([s_recent, s_prior])
    db_session.commit()

    repo = AnalyticsRepository(db_session)
    summary = repo.get_batch_summary(batch.id)

    # Expected delta = recent_avg (85.0) - prior_avg (65.0) = +20.0%
    expected_delta = 20.0
    assert summary["avg_score_change_pct"] == expected_delta
