"""Unit and integration test suite for DevOps Learning Path, Video Streaming (HTTP 206), and Capstone Assignments."""

import pytest
from fastapi.testclient import TestClient
from app.db.seed_learning import seed_devops_curriculum
from app.models.learning import LearningSubject, LearningModule, LearningLesson, LearningAssignment, LearningProgress, LearningSubmission


@pytest.fixture(autouse=True)
def setup_learning_curriculum(db_session):
    """Ensures DevOps curriculum is seeded in the test database and state is cleaned."""
    db_session.query(LearningProgress).delete()
    db_session.query(LearningSubmission).delete()
    db_session.commit()
    seed_devops_curriculum(db_session)
    yield
    db_session.query(LearningProgress).delete()
    db_session.query(LearningSubmission).delete()
    db_session.commit()


def test_list_learning_subjects(client: TestClient, trainee_headers: dict):
    """Verifies trainee can list active subjects with overall progress percentage."""
    response = client.get("/learning/subjects", headers=trainee_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    devops = next(s for s in data if s["slug"] == "devops-engineering")
    assert devops["title"] == "DevOps Engineering & Containerization"
    assert devops["total_modules"] == 5
    assert devops["overall_progress_pct"] == 0.0


def test_get_devops_subject_detail_and_modules(client: TestClient, trainee_headers: dict):
    """Verifies subject roadmap exposes Module 1 with 8 lessons, assignment, and unlocking rules."""
    response = client.get("/learning/subjects/devops-engineering", headers=trainee_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data["modules"]) == 5

    m1 = data["modules"][0]
    assert m1["slug"] == "docker-fundamentals"
    assert m1["is_unlocked"] is True
    assert len(m1["lessons"]) == 8
    assert m1["assignment"] is not None
    assert m1["assignment"]["title"] == "Containerize & Interconnect a Web Service"

    # Module 2 should be locked for trainee until Module 1 is passed
    m2 = data["modules"][1]
    assert m2["slug"] == "custom-images-dockerfiles"
    assert m2["is_unlocked"] is False


def test_get_lesson_detail(client: TestClient, trainee_headers: dict):
    """Verifies lesson detail contains playback URLs, companion files, and initial watch state."""
    response = client.get("/learning/lessons/1", headers=trainee_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == 1
    assert data["title"] == "Docker Setup & Architecture"
    assert data["has_video"] is True
    assert data["has_subtitles"] is True
    assert data["stream_url"] == "/learning/lessons/1/stream"
    assert data["subtitles_url"] == "/learning/lessons/1/subtitles"
    assert data["is_completed"] is False


def test_lesson_progress_tracking_and_completion(client: TestClient, trainee_headers: dict):
    """Verifies watched seconds update and enforces 60% completion threshold."""
    # 1. Update with low watch time (e.g. 50s on a 407s video)
    r1 = client.post(
        "/learning/lessons/1/progress",
        json={"watched_seconds": 50, "is_completed": True},
        headers=trainee_headers
    )
    assert r1.status_code == 200
    assert r1.json()["watched_seconds"] == 50
    assert r1.json()["is_completed"] is False  # Rejected completion because 50s < 60% of 407s

    # 2. Update with sufficient watch time (> 60% of 407s is 245s, send 300s)
    r2 = client.post(
        "/learning/lessons/1/progress",
        json={"watched_seconds": 300, "is_completed": True},
        headers=trainee_headers
    )
    assert r2.status_code == 200
    assert r2.json()["watched_seconds"] == 300
    assert r2.json()["is_completed"] is True
    assert r2.json()["completed_at"] is not None


def test_subtitles_webvtt_stream(client: TestClient, trainee_headers: dict):
    """Verifies that subtitles are streamed as valid WebVTT format."""
    response = client.get("/learning/lessons/1/subtitles", headers=trainee_headers)
    assert response.status_code == 200
    assert "text/vtt" in response.headers["Content-Type"]
    content = response.text
    assert content.startswith("WEBVTT")
    assert "-->" in content


def test_video_http_206_range_streaming(client: TestClient, trainee_headers: dict):
    """Verifies HTTP 206 Partial Content range requests for video streaming."""
    headers = dict(trainee_headers)
    headers["Range"] = "bytes=0-999"
    response = client.get("/learning/lessons/1/stream", headers=headers)
    assert response.status_code == 206
    assert response.headers["Accept-Ranges"] == "bytes"
    assert "Content-Range" in response.headers
    assert response.headers["Content-Range"].startswith("bytes 0-999/")
    assert len(response.content) == 1000
    assert response.headers["Content-Type"] == "video/mp4"


def test_invalid_range_returns_416(client: TestClient, trainee_headers: dict):
    """Verifies out-of-bounds byte range returns HTTP 416 Range Not Satisfiable."""
    headers = dict(trainee_headers)
    headers["Range"] = "bytes=99999999999-999999999999"
    response = client.get("/learning/lessons/1/stream", headers=headers)
    assert response.status_code == 416


def test_companion_file_download(client: TestClient, trainee_headers: dict):
    """Verifies downloading an attached slide deck or command cheat sheet."""
    response = client.get("/learning/lessons/1/companion-files/0", headers=trainee_headers)
    assert response.status_code == 200
    assert "application/pdf" in response.headers["Content-Type"] or "text/plain" in response.headers["Content-Type"]
    assert len(response.content) > 0


def test_assignment_submission_and_trainer_review_lifecycle(
    client: TestClient, trainee_headers: dict, trainer_headers: dict
):
    """Verifies complete Capstone Assignment lifecycle: submission -> trainer review -> revision/pass."""
    # 1. Trainee submits assignment evidence
    sub_payload = {
        "commands_used": "docker network create devops-net\ndocker run -d --name web-app --net devops-net nginx:alpine",
        "explanation": "Custom bridge networks have automatic DNS resolution enabled by Docker's embedded DNS server at 127.0.0.11."
    }
    r_sub = client.post(
        "/learning/assignments/1/submit",
        json=sub_payload,
        headers=trainee_headers
    )
    assert r_sub.status_code == 201
    sub_data = r_sub.json()
    assert sub_data["status"] == "submitted"
    assert sub_data["commands_used"] == sub_payload["commands_used"]
    sub_id = sub_data["id"]

    # 2. Trainee can see their submission
    r_my = client.get("/learning/submissions/my", headers=trainee_headers)
    assert r_my.status_code == 200
    assert any(s["id"] == sub_id for s in r_my.json())

    # 3. Trainer reviews submission with "needs_changes"
    rev1_payload = {
        "status": "needs_changes",
        "score": 50,
        "trainer_feedback": "Please include the curl command output proving DNS connectivity."
    }
    r_rev1 = client.post(
        f"/learning/trainer/submissions/{sub_id}/review",
        json=rev1_payload,
        headers=trainer_headers
    )
    assert r_rev1.status_code == 200
    assert r_rev1.json()["status"] == "needs_changes"
    assert r_rev1.json()["score"] == 50

    # 4. Trainee updates submission with revised evidence
    revised_payload = {
        "commands_used": "docker run --rm --net devops-net curlimages/curl curl -s http://web-app",
        "explanation": "Added curl proof confirming HTTP 200 from web-app container."
    }
    r_resub = client.post(
        "/learning/assignments/1/submit",
        json=revised_payload,
        headers=trainee_headers
    )
    assert r_resub.status_code == 201
    assert r_resub.json()["status"] == "submitted"

    # 5. Trainer awards passing grade
    rev2_payload = {
        "status": "passed",
        "score": 95,
        "trainer_feedback": "Excellent work! Full container DNS interconnectivity demonstrated."
    }
    r_rev2 = client.post(
        f"/learning/trainer/submissions/{sub_id}/review",
        json=rev2_payload,
        headers=trainer_headers
    )
    assert r_rev2.status_code == 200
    assert r_rev2.json()["status"] == "passed"
    assert r_rev2.json()["score"] == 95


def test_unauthenticated_requests_denied(client: TestClient):
    """Verifies that all learning endpoints reject unauthenticated requests with 401."""
    assert client.get("/learning/subjects").status_code == 401
    assert client.get("/learning/subjects/devops-engineering").status_code == 401
    assert client.get("/learning/lessons/1").status_code == 401
    assert client.get("/learning/lessons/1/stream").status_code == 401
    assert client.get("/learning/lessons/1/subtitles").status_code == 401
    assert client.post("/learning/assignments/1/submit", json={}).status_code == 401
    assert client.get("/learning/trainer/submissions").status_code == 401
