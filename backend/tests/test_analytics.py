"""Integration test suite verifying pure SQL analytics computations against hand-calculated datasets.
Tests batch summaries, calendar series, window rankings, edge cases, and role access constraints.
"""

import pytest
from datetime import date, datetime, timedelta, timezone
from app.core.security import create_access_token, get_password_hash
from app.models.batch import Batch
from app.models.trainee import Trainee
from app.models.module import Module
from app.models.session import Session
from app.models.user import User

@pytest.fixture
def analytics_dataset(db_session):
    """Pytest fixture populating fresh, isolated test entities and real user records for every test."""
    # 1. Cohorts
    cohort = Batch(name="Fixture Analytics Cohort", start_date=date(2026, 1, 1), end_date=date(2026, 6, 1))
    empty_cohort = Batch(name="Fixture Empty Cohort", start_date=date(2026, 1, 1), end_date=date(2026, 6, 1))
    db_session.add_all([cohort, empty_cohort])
    db_session.flush()

    # 2. Modules
    mod_100 = Module(name="Mod 100 Pts", max_score=100.0)
    mod_50 = Module(name="Mod 50 Pts", max_score=50.0)
    db_session.add_all([mod_100, mod_50])
    db_session.flush()

    # 3. Trainees
    t_alice = Trainee(name="Alice Analytics", email="alice@analytics.internal", batch_id=cohort.id)
    t_bob = Trainee(name="Bob Analytics", email="bob@analytics.internal", batch_id=cohort.id)
    t_charlie = Trainee(name="Charlie NoSessions", email="charlie@analytics.internal", batch_id=cohort.id)
    t_david = Trainee(name="David EmptyBatch", email="david@analytics.internal", batch_id=empty_cohort.id)
    db_session.add_all([t_alice, t_bob, t_charlie, t_david])
    db_session.flush()

    # 4. Real User rows linked to entities (no hardcoded IDs)
    u_trainer = User(
        email="trainer@analytics.internal",
        password_hash=get_password_hash("Trainer@123"),
        role="trainer",
        trainee_id=None
    )
    u_alice = User(
        email="alice_user@analytics.internal",
        password_hash=get_password_hash("Trainee@123"),
        role="trainee",
        trainee_id=t_alice.id
    )
    u_bob = User(
        email="bob_user@analytics.internal",
        password_hash=get_password_hash("Trainee@123"),
        role="trainee",
        trainee_id=t_bob.id
    )
    db_session.add_all([u_trainer, u_alice, u_bob])
    db_session.flush()

    # 5. Core Sessions (Alice & Bob)
    now = datetime.now(timezone.utc)
    # Alice: 80/100 = 80%, errors: 2, time: 1000s
    s1 = Session(trainee_id=t_alice.id, module_id=mod_100.id, score=80.0, errors=2, time_seconds=1000, created_at=now)
    # Alice: 30/50 = 60%, errors: 4, time: 1200s
    s2 = Session(trainee_id=t_alice.id, module_id=mod_50.id, score=30.0, errors=4, time_seconds=1200, created_at=now)
    # Bob: 40/100 = 40%, errors: 6, time: 1500s
    s3 = Session(trainee_id=t_bob.id, module_id=mod_100.id, score=40.0, errors=6, time_seconds=1500, created_at=now)
    db_session.add_all([s1, s2, s3])
    db_session.commit()

    # Real tokens derived from dynamically committed users
    trainer_token = create_access_token(data={"sub": str(u_trainer.id), "role": "trainer", "trainee_id": None})
    alice_token = create_access_token(data={"sub": str(u_alice.id), "role": "trainee", "trainee_id": t_alice.id})
    bob_token = create_access_token(data={"sub": str(u_bob.id), "role": "trainee", "trainee_id": t_bob.id})

    return {
        "cohort": cohort,
        "empty_cohort": empty_cohort,
        "mod_100": mod_100,
        "mod_50": mod_50,
        "t_alice": t_alice,
        "t_bob": t_bob,
        "t_charlie": t_charlie,
        "t_david": t_david,
        "trainer_headers": {"Authorization": f"Bearer {trainer_token}"},
        "alice_headers": {"Authorization": f"Bearer {alice_token}"},
        "bob_headers": {"Authorization": f"Bearer {bob_token}"},
    }

def test_batch_summary_hand_calculated_values(client, analytics_dataset):
    """Verifies that SQL aggregation returns exact hand-calculated averages and pass rates."""
    data_ctx = analytics_dataset
    res = client.get(
        f"/analytics/batches/{data_ctx['cohort'].id}/summary",
        headers=data_ctx["trainer_headers"]
    )
    assert res.status_code == 200
    data = res.json()

    assert data["batch_id"] == data_ctx["cohort"].id
    assert data["trainee_count"] == 3
    assert data["session_count"] == 3
    # Hand calculation: (80 + 60 + 40) / 3 = 60.0%
    assert data["avg_score_pct"] == 60.0
    # Hand calculation: 2 passes (80, 60) out of 3 = 66.7%
    assert data["pass_rate_pct"] == 66.7
    # Hand calculation: (2 + 4 + 6) / 3 = 4.0
    assert data["avg_errors"] == 4.0
    # Hand calculation: (1000 + 1200 + 1500) / 3 = 1233.3
    assert data["avg_time_seconds"] == 1233.3

def test_empty_batch_returns_zeros_and_nulls(client, analytics_dataset):
    """Verifies that an empty cohort returns 200 with zero counts and null averages, not an error."""
    data_ctx = analytics_dataset
    res = client.get(
        f"/analytics/batches/{data_ctx['empty_cohort'].id}/summary",
        headers=data_ctx["trainer_headers"]
    )
    assert res.status_code == 200
    data = res.json()
    assert data["batch_id"] == data_ctx["empty_cohort"].id
    assert data["trainee_count"] == 1
    assert data["session_count"] == 0
    assert data["avg_score_pct"] is None
    assert data["pass_rate_pct"] is None

def test_score_bands_distribution(client, analytics_dataset):
    """Verifies that SQL categorization returns all three bands with accurate percentages."""
    data_ctx = analytics_dataset
    res = client.get(
        f"/analytics/batches/{data_ctx['cohort'].id}/bands",
        headers=data_ctx["trainer_headers"]
    )
    assert res.status_code == 200
    bands = res.json()
    assert len(bands) == 3

    band_map = {b["label"]: b for b in bands}
    # Alice avg is 70% -> Average; Bob avg is 40% -> Struggling
    assert band_map["Excellent"]["count"] == 0
    assert band_map["Average"]["count"] == 1
    assert band_map["Struggling"]["count"] == 1
    assert band_map["Average"]["percent"] == 50.0
    assert band_map["Struggling"]["percent"] == 50.0

def test_leaderboard_rankings_and_status(client, analytics_dataset):
    """Verifies RANK() window ordering and status markers (on_track, needs_help, no_sessions)."""
    data_ctx = analytics_dataset
    res = client.get(
        f"/analytics/batches/{data_ctx['cohort'].id}/leaderboard?order=desc",
        headers=data_ctx["trainer_headers"]
    )
    assert res.status_code == 200
    items = res.json()
    assert len(items) == 3

    # Alice is rank 1 (70.0%)
    assert items[0]["name"] == "Alice Analytics"
    assert items[0]["rank"] == 1
    assert items[0]["status"] == "on_track"

    # Bob is rank 2 (40.0% < 50.0 -> needs_help)
    assert items[1]["name"] == "Bob Analytics"
    assert items[1]["rank"] == 2
    assert items[1]["status"] == "needs_help"

    # Charlie has 0 sessions -> no rank, status 'no_sessions'
    assert items[2]["name"] == "Charlie NoSessions"
    assert items[2]["rank"] is None
    assert items[2]["status"] == "no_sessions"

def test_trainee_zero_sessions_summary(client, analytics_dataset):
    """Verifies that querying a trainee with zero sessions returns 200 OK with nulls/zeros."""
    data_ctx = analytics_dataset
    res = client.get(
        f"/analytics/trainees/{data_ctx['t_charlie'].id}/summary",
        headers=data_ctx["trainer_headers"]
    )
    assert res.status_code == 200
    data = res.json()
    assert data["session_count"] == 0
    assert data["avg_score_pct"] is None
    assert data["latest_score_pct"] is None
    assert data["best_score_pct"] is None

def test_unknown_batch_and_trainee_return_404(client, analytics_dataset):
    """Verifies that non-existent entity IDs return standard 404 error envelopes."""
    data_ctx = analytics_dataset
    res_batch = client.get("/analytics/batches/99999/summary", headers=data_ctx["trainer_headers"])
    assert res_batch.status_code == 404
    assert res_batch.json()["error"]["code"] == "BATCH_NOT_FOUND"

    res_trainee = client.get("/analytics/trainees/99999/summary", headers=data_ctx["trainer_headers"])
    assert res_trainee.status_code == 404
    assert res_trainee.json()["error"]["code"] == "TRAINEE_NOT_FOUND"

def test_weekly_progression_returns_exact_n_rows_with_null_for_empty_weeks(client, analytics_dataset, db_session):
    """Verifies that the weekly endpoint generates exactly N rows and includes nulls for weeks without sessions."""
    data_ctx = analytics_dataset
    cohort_id = data_ctx["cohort"].id
    trainee_id = data_ctx["t_alice"].id
    module_id = data_ctx["mod_100"].id

    # Place sessions into specific weeks: Week 1 and Week 3 of January 2026
    # Week 1: Monday Jan 5, 2026
    # Week 2: Monday Jan 12, 2026 (EMPTY)
    # Week 3: Monday Jan 19, 2026
    # Week 4: Monday Jan 26, 2026 (EMPTY)
    w1_dt = datetime(2026, 1, 6, 10, 0, tzinfo=timezone.utc)
    w3_dt = datetime(2026, 1, 20, 10, 0, tzinfo=timezone.utc)

    s_w1 = Session(trainee_id=trainee_id, module_id=module_id, score=90.0, errors=1, time_seconds=800, created_at=w1_dt)
    s_w3 = Session(trainee_id=trainee_id, module_id=module_id, score=70.0, errors=3, time_seconds=950, created_at=w3_dt)
    db_session.add_all([s_w1, s_w3])
    db_session.commit()

    # Query exactly 4 weeks starting from 2026-01-05
    res = client.get(
        f"/analytics/batches/{cohort_id}/weekly?weeks=4&from=2026-01-05",
        headers=data_ctx["trainer_headers"]
    )
    assert res.status_code == 200
    weeks_data = res.json()
    assert len(weeks_data) == 4

    # Week 1: has score (90.0)
    assert weeks_data[0]["week_start"] == "2026-01-05"
    assert weeks_data[0]["avg_score_pct"] == 90.0
    assert weeks_data[0]["session_count"] >= 1

    # Week 2: empty (null score, 0 sessions)
    assert weeks_data[1]["week_start"] == "2026-01-12"
    assert weeks_data[1]["avg_score_pct"] is None
    assert weeks_data[1]["session_count"] == 0

    # Week 3: has score (70.0)
    assert weeks_data[2]["week_start"] == "2026-01-19"
    assert weeks_data[2]["avg_score_pct"] == 70.0
    assert weeks_data[2]["session_count"] >= 1

    # Week 4: empty (null score, 0 sessions)
    assert weeks_data[3]["week_start"] == "2026-01-26"
    assert weeks_data[3]["avg_score_pct"] is None
    assert weeks_data[3]["session_count"] == 0

def test_trainee_summary_improvement_pct_with_six_known_sessions(client, analytics_dataset, db_session):
    """Verifies improvement_pct comparing first 3 sessions vs last 3 sessions in pure SQL."""
    data_ctx = analytics_dataset
    # Create an isolated trainee with exactly 6 sessions
    cohort = data_ctx["cohort"]
    mod = data_ctx["mod_100"]

    learner = Trainee(name="Improvement Learner", email="learner@test.internal", batch_id=cohort.id)
    db_session.add(learner)
    db_session.flush()

    # 6 sessions with known dates and scores:
    # First 3 sessions: scores 40, 50, 60 -> First 3 average = 50.0%
    # Last 3 sessions:  scores 70, 80, 90 -> Last 3 average  = 80.0%
    # Expected improvement_pct: 80.0 - 50.0 = +30.0%
    t_start = datetime(2026, 2, 1, 10, 0, tzinfo=timezone.utc)
    scores = [40.0, 50.0, 60.0, 70.0, 80.0, 90.0]
    sessions_to_add = [
        Session(
            trainee_id=learner.id,
            module_id=mod.id,
            score=sc,
            errors=2,
            time_seconds=1000,
            created_at=t_start + timedelta(days=idx)
        )
        for idx, sc in enumerate(scores)
    ]
    db_session.add_all(sessions_to_add)
    db_session.commit()

    res = client.get(f"/analytics/trainees/{learner.id}/summary", headers=data_ctx["trainer_headers"])
    assert res.status_code == 200
    summary = res.json()
    assert summary["session_count"] == 6
    assert summary["latest_score_pct"] == 90.0
    assert summary["best_score_pct"] == 90.0
    assert summary["improvement_pct"] == 30.0

def test_attention_endpoint_with_falling_weekly_scores(client, analytics_dataset, db_session):
    """Verifies that a trainee whose last 3 weekly averages are falling is flagged in the attention endpoint."""
    data_ctx = analytics_dataset
    cohort = data_ctx["cohort"]
    mod = data_ctx["mod_100"]

    struggling_trainee = Trainee(name="Falling Learner", email="falling@test.internal", batch_id=cohort.id)
    db_session.add(struggling_trainee)
    db_session.flush()

    # Place sessions into 3 distinct recent weeks with strictly falling averages:
    # Week 3 ago: score 85.0%
    # Week 2 ago: score 65.0%
    # Week 1 ago: score 45.0%
    now = datetime.now(timezone.utc)
    s_w3 = Session(trainee_id=struggling_trainee.id, module_id=mod.id, score=85.0, errors=2, time_seconds=1000, created_at=now - timedelta(days=21))
    s_w2 = Session(trainee_id=struggling_trainee.id, module_id=mod.id, score=65.0, errors=5, time_seconds=1200, created_at=now - timedelta(days=14))
    s_w1 = Session(trainee_id=struggling_trainee.id, module_id=mod.id, score=45.0, errors=8, time_seconds=1500, created_at=now - timedelta(days=7))
    db_session.add_all([s_w3, s_w2, s_w1])
    db_session.commit()

    res = client.get(f"/analytics/batches/{cohort.id}/attention", headers=data_ctx["trainer_headers"])
    assert res.status_code == 200
    attention_list = res.json()

    flagged_ids = [item["trainee_id"] for item in attention_list]
    assert struggling_trainee.id in flagged_ids

def test_rbac_leaderboard_and_attention_trainer_only(client, analytics_dataset):
    """Verifies that /leaderboard and /attention are strictly trainer-only, returning 403 to trainees."""
    data_ctx = analytics_dataset
    cohort_id = data_ctx["cohort"].id

    # Trainees must NOT be allowed to view leaderboard (403)
    res_lb_trainee = client.get(
        f"/analytics/batches/{cohort_id}/leaderboard",
        headers=data_ctx["alice_headers"]
    )
    assert res_lb_trainee.status_code == 403
    assert res_lb_trainee.json()["error"]["code"] == "FORBIDDEN_TRAINER_ONLY"

    # Trainees must NOT be allowed to view attention list (403)
    res_att_trainee = client.get(
        f"/analytics/batches/{cohort_id}/attention",
        headers=data_ctx["alice_headers"]
    )
    assert res_att_trainee.status_code == 403
    assert res_att_trainee.json()["error"]["code"] == "FORBIDDEN_TRAINER_ONLY"

    # Trainers can access both successfully (200)
    res_lb_trainer = client.get(
        f"/analytics/batches/{cohort_id}/leaderboard",
        headers=data_ctx["trainer_headers"]
    )
    assert res_lb_trainer.status_code == 200

    res_att_trainer = client.get(
        f"/analytics/batches/{cohort_id}/attention",
        headers=data_ctx["trainer_headers"]
    )
    assert res_att_trainer.status_code == 200
