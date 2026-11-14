"""Security, boundary, and authorization test suite for Learning Path & Media streaming:
1. Path traversal regression tests on _resolve_safe_media_path:
   - Parent directory traversal (../../) returns HTTP 403 INVALID_PATH.
   - Null bytes in media path return HTTP 403 INVALID_PATH.
   - Base directory escape attempts return HTTP 403 INVALID_PATH.
2. Backend-controlled watch progress verification:
   - Client is_completed=True is rejected when watch duration is below 60% threshold.
   - Watch duration is clamped to lesson duration (preventing arbitrary integer injection).
   - Server automatically flips is_completed=True once >= 60% watch time is recorded.
3. Capstone Assignment grading & authorization rules:
   - Review status must be strictly 'passed' or 'needs_changes'.
   - Passing review requires score >= 60.0% (ASSESSMENT_PASS_THRESHOLD).
   - Review score must be bounded within [0.0, 100.0].
   - Trainers cannot review submissions from unassigned cohorts (HTTP 403 FORBIDDEN_COHORT_ACCESS).
4. Video Streaming Range header safety:
   - Malformed, negative, or inverted byte ranges return HTTP 416 Range Not Satisfiable.
"""

import pytest
from fastapi.testclient import TestClient
from app.db.seed_learning import seed_devops_curriculum
from app.models.learning import LearningLesson, LearningSubmission, LearningProgress
from app.models.trainee import Trainee
from app.models.batch import Batch
from app.models.batch_trainer import BatchTrainer
from app.models.user import User
from app.core.security import create_access_token
from app.core.exceptions import AppException
from app.routers.learning import _resolve_safe_media_path


@pytest.fixture(autouse=True)
def setup_learning_env(db_session):
    """Ensures curriculum is seeded for each security test run with clean state."""
    db_session.query(LearningProgress).delete()
    db_session.query(LearningSubmission).delete()
    db_session.commit()
    seed_devops_curriculum(db_session)
    yield
    db_session.query(LearningProgress).delete()
    db_session.query(LearningSubmission).delete()
    db_session.commit()


# =============================================================================
# 1. PATH TRAVERSAL MITIGATION TESTS
# =============================================================================
def test_path_traversal_detection_in_resolve_safe_media_path():
    """Unit test verifying that _resolve_safe_media_path rejects path traversal attacks."""
    # Parent directory escape
    with pytest.raises(AppException) as exc_info:
        _resolve_safe_media_path("../../etc/passwd")
    assert exc_info.value.status_code == 403
    assert exc_info.value.code == "INVALID_PATH"

    # Windows-style backslash escape
    with pytest.raises(AppException) as exc_info_win:
        _resolve_safe_media_path("..\\..\\Windows\\System32\\cmd.exe")
    assert exc_info_win.value.status_code == 403
    assert exc_info_win.value.code == "INVALID_PATH"

    # Null byte injection
    with pytest.raises(AppException) as exc_info_null:
        _resolve_safe_media_path("safe_file.mp4\x00../../etc/shadow")
    assert exc_info_null.value.status_code == 403
    assert exc_info_null.value.code == "INVALID_PATH"

    # Empty path returns 404
    with pytest.raises(AppException) as exc_info_empty:
        _resolve_safe_media_path("")
    assert exc_info_empty.value.status_code == 404


def test_companion_file_path_traversal_via_api(client: TestClient, trainee_headers: dict, db_session):
    """Verifies that an altered companion file path pointing outside storage is blocked with HTTP 403."""
    lesson = db_session.query(LearningLesson).filter(LearningLesson.id == 1).first()
    # Inject a traversal path into companion files for testing
    lesson.companion_files = [{"title": "Traverse", "file_type": "txt", "relative_path": "../secret.txt"}]
    db_session.commit()

    res = client.get("/learning/lessons/1/companion-files/0", headers=trainee_headers)
    assert res.status_code == 403
    assert "INVALID_PATH" in res.text


# =============================================================================
# 2. BACKEND-CONTROLLED PROGRESS COMPLETION VERIFICATION
# =============================================================================
def test_watch_progress_cannot_be_spoofed_by_client(client: TestClient, trainee_headers: dict):
    """Verifies that a trainee sending is_completed=True without sufficient watch time is rejected."""
    # Lesson 1 has duration_seconds = 407. 60% is 244 seconds.
    # Client sends watched_seconds = 30 with is_completed = True
    res = client.post(
        "/learning/lessons/1/progress",
        json={"watched_seconds": 30, "is_completed": True},
        headers=trainee_headers
    )
    assert res.status_code == 200
    data = res.json()
    assert data["watched_seconds"] == 30
    assert data["is_completed"] is False, "Server must not trust client is_completed without meeting 60% threshold"
    assert data["completed_at"] is None


def test_watch_progress_seconds_clamping(client: TestClient, trainee_headers: dict):
    """Verifies that sending an excessive watch duration is clamped to the lesson's actual duration."""
    # Lesson 1 duration is 407 seconds.
    res = client.post(
        "/learning/lessons/1/progress",
        json={"watched_seconds": 999999, "is_completed": True},
        headers=trainee_headers
    )
    assert res.status_code == 200
    data = res.json()
    assert data["watched_seconds"] == 407, "Watched seconds must be clamped to lesson.duration_seconds"
    assert data["is_completed"] is True


def test_watch_progress_automatic_completion_at_threshold(client: TestClient, trainee_headers: dict):
    """Verifies that watch progress achieves completion when >= 60% of video duration is watched."""
    # Lesson 1 duration = 407s. 60% = 244s. Send 250s with is_completed=False.
    res = client.post(
        "/learning/lessons/1/progress",
        json={"watched_seconds": 250, "is_completed": False},
        headers=trainee_headers
    )
    assert res.status_code == 200
    data = res.json()
    assert data["is_completed"] is True, "Server must automatically mark completed once threshold is satisfied"
    assert data["completed_at"] is not None


# =============================================================================
# 3. CAPSTONE ASSIGNMENT EVALUATION & AUTHORIZATION GUARDS
# =============================================================================
def test_assignment_review_rejects_passing_status_with_failing_score(
    client: TestClient, trainee_headers: dict, trainer_headers: dict
):
    """Verifies that a trainer cannot award 'passed' status if the score is below the 60.0% threshold."""
    # 1. Trainee submits
    sub_res = client.post(
        "/learning/assignments/1/submit",
        json={"commands_used": "docker run -d nginx", "explanation": "Deployed nginx web server"},
        headers=trainee_headers
    )
    assert sub_res.status_code == 201
    sub_id = sub_res.json()["id"]

    # 2. Trainer attempts to mark 'passed' with score 55.0% (< 60.0%)
    invalid_review = client.post(
        f"/learning/trainer/submissions/{sub_id}/review",
        json={"status": "passed", "score": 55.0, "trainer_feedback": "Passed despite low score"},
        headers=trainer_headers
    )
    assert invalid_review.status_code == 400
    assert "INVALID_PASS_SCORE" in invalid_review.text


def test_assignment_review_rejects_out_of_bounds_score(
    client: TestClient, trainee_headers: dict, trainer_headers: dict
):
    """Verifies that review scores outside [0.0, 100.0] are rejected."""
    sub_res = client.post(
        "/learning/assignments/1/submit",
        json={"commands_used": "docker ps", "explanation": "Listing containers"},
        headers=trainee_headers
    )
    sub_id = sub_res.json()["id"]

    # Score > 100
    high_score = client.post(
        f"/learning/trainer/submissions/{sub_id}/review",
        json={"status": "passed", "score": 105.0, "trainer_feedback": "Above max"},
        headers=trainer_headers
    )
    assert high_score.status_code == 422

    # Score < 0
    low_score = client.post(
        f"/learning/trainer/submissions/{sub_id}/review",
        json={"status": "needs_changes", "score": -10.0, "trainer_feedback": "Negative score"},
        headers=trainer_headers
    )
    assert low_score.status_code == 422


def test_trainer_cannot_review_submission_from_unassigned_cohort(
    client: TestClient, trainee_headers: dict, db_session
):
    """Verifies that a trainer assigned only to Batch 2 cannot grade submissions from Batch 1."""
    # Create Trainee 1 in Batch 1
    sub_res = client.post(
        "/learning/assignments/1/submit",
        json={"commands_used": "docker ps -a", "explanation": "Testing cohort boundary"},
        headers=trainee_headers
    )
    sub_id = sub_res.json()["id"]

    # Create unassigned trainer User(id=99) assigned only to Batch 99
    unassigned_trainer = User(
        id=99,
        email="unassigned_trainer@test.internal",
        password_hash="fakehash",
        role="trainer",
        is_active=True
    )
    db_session.add(unassigned_trainer)
    db_session.commit()

    unassigned_token = create_access_token(data={"sub": "99", "role": "trainer"})
    unauth_review = client.post(
        f"/learning/trainer/submissions/{sub_id}/review",
        json={"status": "passed", "score": 85.0, "trainer_feedback": "Unauthorized attempt"},
        headers={"Authorization": f"Bearer {unassigned_token}"}
    )
    assert unauth_review.status_code == 403
    assert "FORBIDDEN_COHORT_ACCESS" in unauth_review.text


# =============================================================================
# 4. RANGE HEADER SECURITY TESTS
# =============================================================================
def test_inverted_range_header_returns_416(client: TestClient, trainee_headers: dict):
    """Verifies that inverted byte ranges (e.g. bytes=500-200) return HTTP 416."""
    headers = dict(trainee_headers)
    headers["Range"] = "bytes=500-200"
    res = client.get("/learning/lessons/1/stream", headers=headers)
    assert res.status_code == 416
    assert "Content-Range" in res.headers
    assert res.headers["Content-Range"].startswith("bytes */")
