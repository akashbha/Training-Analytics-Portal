"""Integration and unit tests for help assistant stage 2 (role-filtered retrieval).
Tests query sanitization, participant role scoping, response schema, and error handling.
"""

import pytest
from scripts.build_help_index import build_index
from app.services.help_service import help_search

@pytest.fixture(autouse=True)
def populate_index(db_session):
    """Ensures help index and SQLite FTS5 table are populated for each test."""
    build_index(db_session)

def test_trainee_query_pass_threshold_never_returns_admin_chunk(client, trainee_headers):
    """Trainee query for 'pass threshold' returns matching documentation but never admin-tagged chunks."""
    response = client.get("/help/search?q=pass+threshold", headers=trainee_headers)
    assert response.status_code == 200
    data = response.json()

    assert data["answer_found"] is True
    assert data["message"] == "Matches from project documentation."
    assert len(data["results"]) > 0

    allowed_roles = {"trainee", "all"}
    for item in data["results"]:
        assert item["role"] in allowed_roles, f"Trainee received unauthorized chunk with role '{item['role']}'"
        assert item["role"] != "admin"

def test_trainee_query_audit_log_returns_no_results(client, trainee_headers):
    """Trainee query for 'audit log' returns no results (admin-only topic, not covered for trainees)."""
    response = client.get("/help/search?q=audit+log", headers=trainee_headers)
    assert response.status_code == 200
    data = response.json()

    assert data["answer_found"] is False
    assert data["message"] == "This is not covered in the project documentation."
    assert data["results"] == []

def test_trainer_query_never_returns_admin_chunk(client, trainer_headers):
    """Trainer query never returns an admin-tagged chunk."""
    response = client.get("/help/search?q=database+schema", headers=trainer_headers)
    assert response.status_code == 200
    data = response.json()

    allowed_roles = {"trainer", "all"}
    for item in data["results"]:
        assert item["role"] in allowed_roles, f"Trainer received unauthorized chunk with role '{item['role']}'"
        assert item["role"] != "admin"

def test_admin_query_can_return_trainer_and_trainee_chunks(client, admin_headers):
    """Admin role can retrieve chunks tagged for admin, trainer, trainee, or all."""
    response = client.get("/help/search?q=remediation", headers=admin_headers)
    assert response.status_code == 200
    data = response.json()

    assert data["answer_found"] is True
    returned_roles = {item["role"] for item in data["results"]}
    # Admin is authorized to access trainee and trainer chunks
    assert "trainee" in returned_roles or "trainer" in returned_roles

def test_empty_query_returns_422_invalid_query(client, trainee_headers):
    """Empty query or blank query returns 422 INVALID_QUERY."""
    res_empty = client.get("/help/search?q=", headers=trainee_headers)
    assert res_empty.status_code == 422
    assert "INVALID_QUERY" in res_empty.text

    res_spaces = client.get("/help/search?q=%20%20%20", headers=trainee_headers)
    assert res_spaces.status_code == 422
    assert "INVALID_QUERY" in res_spaces.text

def test_query_with_fts_operators_does_not_raise_500(client, trainee_headers):
    """Queries containing raw FTS5 operators and quotes do not cause an internal server error."""
    # Query with operators mixed with keywords
    res_mixed = client.get('/help/search?q=remediation+AND+OR+*+(+)+%22', headers=trainee_headers)
    assert res_mixed.status_code != 500

    # Query with only operators
    res_only_ops = client.get('/help/search?q=AND+OR+*+(+)+%22', headers=trainee_headers)
    assert res_only_ops.status_code in [200, 422]
    assert res_only_ops.status_code != 500

def test_query_over_200_characters_is_truncated_not_rejected(client, trainee_headers):
    """Query exceeding 200 characters is capped/truncated rather than rejected."""
    long_query = "threshold " + ("learning progress review " * 15)
    assert len(long_query) > 200

    response = client.get(f"/help/search?q={long_query}", headers=trainee_headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data["results"], list)

def test_every_result_has_non_empty_source_path_and_heading(client, admin_headers):
    """Every returned result has non-empty source_path, heading, text, role, and numeric score."""
    response = client.get("/help/search?q=threshold", headers=admin_headers)
    assert response.status_code == 200
    data = response.json()

    assert data["answer_found"] is True
    assert len(data["results"]) > 0

    for item in data["results"]:
        assert item["source_path"] and item["source_path"].strip()
        assert item["heading"] and item["heading"].strip()
        assert item["text"] and item["text"].strip()
        assert item["role"] in {"admin", "trainer", "trainee", "all"}
        assert isinstance(item["score"], (int, float))

def test_unauthenticated_request_returns_401(client):
    """Unauthenticated requests to /help/search return 401 Unauthorized."""
    response = client.get("/help/search?q=threshold")
    assert response.status_code == 401
