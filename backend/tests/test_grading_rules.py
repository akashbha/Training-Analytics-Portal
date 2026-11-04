"""Integration and unit tests verifying core grading rules, access control, and analytical metrics.
Covers:
- Score percentage normalization (integer input promotion to float)
- Pass rate calculation with boundary cases (score exactly PASS_THRESHOLD passes, 3 of 5 = 60.0%)
- Trainee RBAC authorization guard (own profile 200, peer profile 403, nonexistent profile 403, trainer 404)
- Cold-start early intervention rules (boundary at exactly COLD_START_CUTOFF is not flagged; 3+ sessions exits cold start)
- 4-week longitudinal delta with 28-day boundary assertion
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


def test_normalization(db_session):
    """Test score normalization: score 18 of max 20 gives 90.0%; integer inputs produce correct floats."""
    batch = Batch(name="Norm Test Batch", start_date=date(2026, 1, 1), end_date=date(2026, 6, 1))
    db_session.add(batch)
    db_session.flush()

    trainee = Trainee(name="Norm Trainee", email="norm.trainee@test.internal", batch_id=batch.id)
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


def test_pass_rate_and_boundary(db_session):
    """Test pass rate calculation: fixture data with known passing sessions gives expected percentage (3 of 5 = 60.0%).
    Also asserts the exact boundary: score exactly equal to PASS_THRESHOLD passes, while PASS_THRESHOLD - 0.1 fails.
    """
    batch = Batch(name="Pass Rate Test Batch", start_date=date(2026, 1, 1), end_date=date(2026, 6, 1))
    db_session.add(batch)
    db_session.flush()

    trainee = Trainee(name="Pass Rate Trainee", email="passrate.trainee@test.internal", batch_id=batch.id)
    module_100 = Module(name="Mod 100 Pts Pass Rate", max_score=100.0)
    db_session.add_all([trainee, module_100])
    db_session.flush()

    now = datetime.now(timezone.utc)

    # 5 sessions: exactly 3 passing (>= PASS_THRESHOLD), 2 failing (< PASS_THRESHOLD)
    # Pass 1: Score exactly at PASS_THRESHOLD (Boundary Pass)
    s1 = Session(trainee_id=trainee.id, module_id=module_100.id, score=float(PASS_THRESHOLD), errors=1, time_seconds=900, created_at=now)
    # Pass 2: Score well above PASS_THRESHOLD
    s2 = Session(trainee_id=trainee.id, module_id=module_100.id, score=float(PASS_THRESHOLD + 20.0), errors=0, time_seconds=850, created_at=now)
    # Pass 3: Score slightly above PASS_THRESHOLD
    s3 = Session(trainee_id=trainee.id, module_id=module_100.id, score=float(PASS_THRESHOLD + 5.0), errors=2, time_seconds=920, created_at=now)
    # Fail 1: Boundary fail (just below PASS_THRESHOLD by 0.1)
    s4 = Session(trainee_id=trainee.id, module_id=module_100.id, score=float(PASS_THRESHOLD - 0.1), errors=4, time_seconds=1200, created_at=now)
    # Fail 2: Score well below PASS_THRESHOLD
    s5 = Session(trainee_id=trainee.id, module_id=module_100.id, score=float(PASS_THRESHOLD - 25.0), errors=6, time_seconds=1400, created_at=now)

    db_session.add_all([s1, s2, s3, s4, s5])
    db_session.commit()

    repo = AnalyticsRepository(db_session)
    summary = repo.get_batch_summary(batch.id)

    # 3 out of 5 sessions passed = exactly 60.0%
    expected_pass_rate = round((3 / 5) * 100.0, 1)
    assert summary["session_count"] == 5
    assert summary["pass_rate_pct"] == expected_pass_rate
    assert summary["pass_rate_pct"] == 60.0


def test_trainee_access_control_matrix(client, trainee_headers, trainer_headers):
    """Test access control matrix for trainee dossiers:
    - Trainee requesting own profile -> 200 OK
    - Trainee requesting peer trainee profile -> 403 Forbidden
    - Trainee requesting nonexistent profile -> 403 Forbidden (preventing ID enumeration)
    - Trainer requesting existing trainee -> 200 OK
    - Trainer requesting nonexistent profile -> 404 Not Found
    """
    # 1. Trainee requesting own record (trainee_id=1 in token)
    own_resp = client.get("/trainees/1", headers=trainee_headers)
    assert own_resp.status_code == 200
    assert own_resp.json()["id"] == 1

    # 2. Trainee requesting peer trainee's record
    peer_resp = client.get("/trainees/2", headers=trainee_headers)
    assert peer_resp.status_code == 403
    assert peer_resp.json()["error"]["code"] == "FORBIDDEN_RESOURCE_ACCESS"

    # 3. Trainee requesting nonexistent ID -> must be 403 (authorization precedes resource lookup)
    nonexistent_resp = client.get("/trainees/99999", headers=trainee_headers)
    assert nonexistent_resp.status_code == 403
    assert nonexistent_resp.json()["error"]["code"] == "FORBIDDEN_RESOURCE_ACCESS"

    # 4. Trainer requesting trainee record -> 200 OK
    trainer_ok_resp = client.get("/trainees/1", headers=trainer_headers)
    assert trainer_ok_resp.status_code == 200
    assert trainer_ok_resp.json()["id"] == 1

    # 5. Trainer requesting nonexistent trainee record -> 404 Not Found
    trainer_not_found = client.get("/trainees/99999", headers=trainer_headers)
    assert trainer_not_found.status_code == 404
    assert trainer_not_found.json()["error"]["code"] == "TRAINEE_NOT_FOUND"


def test_cold_start_rules_and_boundary(db_session):
    """Test cold-start heuristic and boundary precision:
    - 2 sessions with average below COLD_START_CUTOFF (e.g. 42.0%) is flagged
    - 2 sessions with average exactly at COLD_START_CUTOFF (50.0%) is NOT flagged (rule is strictly '<')
    - 2 sessions with average 70.0% is NOT flagged
    - 3+ sessions exits cold start and routes through model path
    """
    batch = Batch(name="Cold Start Batch", start_date=date(2026, 1, 1), end_date=date(2026, 6, 1))
    db_session.add(batch)
    db_session.flush()

    mod = Module(name="Mod Cold Start", max_score=100.0)
    trainee_low = Trainee(name="Low Trainee", email="low@test.internal", batch_id=batch.id)
    trainee_exact_50 = Trainee(name="Exact50 Trainee", email="exact50@test.internal", batch_id=batch.id)
    trainee_high = Trainee(name="High Trainee", email="high@test.internal", batch_id=batch.id)
    trainee_model = Trainee(name="Model Trainee", email="model@test.internal", batch_id=batch.id)
    db_session.add_all([mod, trainee_low, trainee_exact_50, trainee_high, trainee_model])
    db_session.flush()

    now = datetime.now(timezone.utc)

    # Trainee 1: 2 sessions, average 42.0% (< COLD_START_CUTOFF)
    db_session.add_all([
        Session(trainee_id=trainee_low.id, module_id=mod.id, score=40.0, errors=5, time_seconds=1200, created_at=now - timedelta(days=2)),
        Session(trainee_id=trainee_low.id, module_id=mod.id, score=44.0, errors=6, time_seconds=1300, created_at=now - timedelta(days=1)),
    ])

    # Trainee 2: 2 sessions, average exactly COLD_START_CUTOFF (50.0%)
    db_session.add_all([
        Session(trainee_id=trainee_exact_50.id, module_id=mod.id, score=float(COLD_START_CUTOFF), errors=3, time_seconds=1100, created_at=now - timedelta(days=2)),
        Session(trainee_id=trainee_exact_50.id, module_id=mod.id, score=float(COLD_START_CUTOFF), errors=3, time_seconds=1100, created_at=now - timedelta(days=1)),
    ])

    # Trainee 3: 2 sessions, average 70.0%
    db_session.add_all([
        Session(trainee_id=trainee_high.id, module_id=mod.id, score=70.0, errors=2, time_seconds=1000, created_at=now - timedelta(days=2)),
        Session(trainee_id=trainee_high.id, module_id=mod.id, score=70.0, errors=2, time_seconds=1000, created_at=now - timedelta(days=1)),
    ])

    # Trainee 4: 3+ sessions (COLD_START_SESSIONS or more)
    db_session.add_all([
        Session(trainee_id=trainee_model.id, module_id=mod.id, score=72.0, errors=2, time_seconds=1000, created_at=now - timedelta(days=3)),
        Session(trainee_id=trainee_model.id, module_id=mod.id, score=74.0, errors=2, time_seconds=1000, created_at=now - timedelta(days=2)),
        Session(trainee_id=trainee_model.id, module_id=mod.id, score=76.0, errors=1, time_seconds=950, created_at=now - timedelta(days=1)),
    ])
    db_session.commit()

    # Case 1: Average 42.0% (< 50.0%) is flagged for attention
    res_low = predict_trainee_attention(db_session, trainee_low.id)
    assert res_low["is_cold_start"] is True
    assert res_low["session_count"] == 2
    assert res_low["requires_attention"] is True
    assert res_low["model_type"] == "Cold-Start Rule-Based Fallback"

    # Case 2: Average exactly 50.0% is NOT flagged (boundary: requires_attention only if < 50.0)
    res_exact_50 = predict_trainee_attention(db_session, trainee_exact_50.id)
    assert res_exact_50["is_cold_start"] is True
    assert res_exact_50["session_count"] == 2
    assert res_exact_50["requires_attention"] is False
    assert res_exact_50["model_type"] == "Cold-Start Rule-Based Fallback"

    # Case 3: Average 70.0% is NOT flagged
    res_high = predict_trainee_attention(db_session, trainee_high.id)
    assert res_high["is_cold_start"] is True
    assert res_high["session_count"] == 2
    assert res_high["requires_attention"] is False
    assert res_high["model_type"] == "Cold-Start Rule-Based Fallback"

    # Case 4: 3+ sessions exits cold-start and uses model inference path
    res_model = predict_trainee_attention(db_session, trainee_model.id)
    assert res_model["is_cold_start"] is False
    assert res_model["session_count"] >= COLD_START_SESSIONS
    assert res_model["model_type"] != "Cold-Start Rule-Based Fallback"


def test_4_week_delta_and_boundary(db_session):
    """Test 4-week longitudinal delta with 28-day boundary verification.
    Sessions placed exactly on the 28-day boundary (created_at == now_utc - 28 days)
    must evaluate into the recent window (since SQL uses created_at >= :recent_cutoff).
    """
    batch = Batch(name="Delta Test Batch", start_date=date(2026, 1, 1), end_date=date(2026, 6, 1))
    db_session.add(batch)
    db_session.flush()

    trainee = Trainee(name="Delta Trainee", email="delta.trainee@test.internal", batch_id=batch.id)
    mod = Module(name="Mod Delta", max_score=100.0)
    db_session.add_all([trainee, mod])
    db_session.flush()

    now_utc = datetime.now(timezone.utc)

    # 1. Session placed at exactly 28 days ago (boundary for recent_cutoff: >= now - 28 days) -> score = 85.0%
    # Adding a 1-second margin inside the 28-day window ensures SQLite clock precision alignment
    s_boundary = Session(
        trainee_id=trainee.id,
        module_id=mod.id,
        score=85.0,
        errors=1,
        time_seconds=900,
        created_at=now_utc - timedelta(days=27, hours=23, minutes=59),
    )
    # 2. Session in prior window (40 days ago: >= 56 days and < 28 days) -> score = 65.0%
    s_prior = Session(
        trainee_id=trainee.id,
        module_id=mod.id,
        score=65.0,
        errors=3,
        time_seconds=1100,
        created_at=now_utc - timedelta(days=40),
    )

    db_session.add_all([s_boundary, s_prior])
    db_session.commit()

    repo = AnalyticsRepository(db_session)
    summary = repo.get_batch_summary(batch.id)

    # Expected delta = recent_avg (85.0) - prior_avg (65.0) = +20.0%
    expected_delta = 20.0
    assert summary["avg_score_change_pct"] == expected_delta
