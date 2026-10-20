"""Comprehensive CRUD integration tests covering pagination, filters, conflict checks, and RBAC rules.
Verifies score limits (422), duplicates (409), bulk CSV ingestion, and cascade delete guards.
"""

import io
from app.core.security import create_access_token

def get_admin_headers():
    token = create_access_token(data={"sub": "9", "role": "admin"})
    return {"Authorization": f"Bearer {token}"}

def get_trainer_headers():
    token = create_access_token(data={"sub": "10", "role": "trainer", "trainee_id": None})
    return {"Authorization": f"Bearer {token}"}

def get_trainee_headers(trainee_id: int = 1):
    token = create_access_token(data={"sub": "11", "role": "trainee", "trainee_id": trainee_id})
    return {"Authorization": f"Bearer {token}"}

def test_pagination_and_batches_crud(client):
    """Verifies batch creation, paginated listing, and envelope response structure."""
    admin_headers = get_admin_headers()
    trainer_headers = get_trainer_headers()

    # Create Batch (Admin only)
    payload = {"name": "Pagination Batch 2026", "start_date": "2026-02-01", "end_date": "2026-08-01"}
    create_res = client.post("/batches", json=payload, headers=admin_headers)
    assert create_res.status_code == 201
    batch_data = create_res.json()
    assert batch_data["name"] == "Pagination Batch 2026"

    # Paginated List (accessible by staff)
    list_res = client.get("/batches?page=1&page_size=1", headers=trainer_headers)
    assert list_res.status_code == 200
    p_data = list_res.json()
    assert "items" in p_data
    assert p_data["page"] == 1
    assert p_data["page_size"] == 1
    assert p_data["total"] >= 2
    assert p_data["pages"] >= 2
    assert len(p_data["items"]) == 1

def test_duplicate_conflicts_return_409(client):
    """Verifies that duplicate batch names and duplicate trainee emails return HTTP 409."""
    admin_headers = get_admin_headers()
    trainer_headers = get_trainer_headers()

    # 1. Duplicate Batch Name (Admin created)
    payload_batch = {"name": "Unique Batch", "start_date": "2026-01-01", "end_date": "2026-05-01"}
    res1 = client.post("/batches", json=payload_batch, headers=admin_headers)
    assert res1.status_code == 201

    res2 = client.post("/batches", json=payload_batch, headers=admin_headers)
    assert res2.status_code == 409
    assert res2.json()["error"]["code"] == "BATCH_NAME_CONFLICT"

    # 2. Duplicate Trainee Email (Staff created)
    payload_trainee = {
        "name": "Original Student",
        "email": "unique.student@domain.com",
        "batch_id": res1.json()["id"]
    }
    t_res1 = client.post("/trainees", json=payload_trainee, headers=trainer_headers)
    assert t_res1.status_code == 201

    t_res2 = client.post("/trainees", json=payload_trainee, headers=trainer_headers)
    assert t_res2.status_code == 409
    assert t_res2.json()["error"]["code"] == "TRAINEE_EMAIL_CONFLICT"

def test_trainee_search_and_filtering(client):
    """Verifies case-insensitive search and batch_id filtering on trainees."""
    trainer_headers = get_trainer_headers()

    # Search by keyword in name
    res = client.get("/trainees?search=alice", headers=trainer_headers)
    assert res.status_code == 200
    items = res.json()["items"]
    assert len(items) >= 1
    assert "Alice" in items[0]["name"]

    # Filter by non-existent batch
    res_empty = client.get("/trainees?batch_id=99999", headers=trainer_headers)
    assert res_empty.status_code == 200
    assert res_empty.json()["total"] == 0

def test_score_above_max_score_returns_422(client):
    """Verifies that submitting a session score above module.max_score fails with HTTP 422."""
    admin_headers = get_admin_headers()
    trainer_headers = get_trainer_headers()

    # Create module with max_score of 50 (Admin only)
    mod_res = client.post(
        "/modules",
        json={"name": "Strict Test Module", "max_score": 50.0},
        headers=admin_headers
    )
    assert mod_res.status_code == 201
    mod_id = mod_res.json()["id"]

    # Attempt to submit score of 55 (exceeds max_score)
    session_payload = {
        "trainee_id": 1,
        "module_id": mod_id,
        "score": 55.0,
        "errors": 2,
        "time_seconds": 900
    }
    sess_res = client.post("/sessions", json=session_payload, headers=trainer_headers)
    assert sess_res.status_code == 422
    assert sess_res.json()["error"]["code"] == "SCORE_EXCEEDS_MAX"
    assert "exceeds" in sess_res.json()["error"]["message"]

    # Valid score passes
    session_payload["score"] = 48.0
    valid_res = client.post("/sessions", json=session_payload, headers=trainer_headers)
    assert valid_res.status_code == 201
    assert valid_res.json()["score"] == 48.0

def test_trainee_access_rules(client):
    """Verifies that trainees are restricted from other records while accessing their own."""
    trainee_headers = get_trainee_headers(trainee_id=1)

    # 1. Trainee cannot access trainee list
    list_res = client.get("/trainees", headers=trainee_headers)
    assert list_res.status_code == 403

    # 2. Trainee 1 cannot access trainee 2's record
    other_res = client.get("/trainees/2", headers=trainee_headers)
    assert other_res.status_code == 403

    # 3. Trainee 1 can access trainee 1's record
    own_res = client.get("/trainees/1", headers=trainee_headers)
    assert own_res.status_code == 200
    assert own_res.json()["id"] == 1

def test_batch_delete_rules(client):
    """Verifies that non-empty batches reject deletion with 409 unless ?force=true is provided."""
    admin_headers = get_admin_headers()

    # Attempt to delete batch 1 (contains Alice and Bob) without force
    del_res = client.delete("/batches/1", headers=admin_headers)
    assert del_res.status_code == 409
    assert del_res.json()["error"]["code"] == "BATCH_NOT_EMPTY"
    assert "force=true" in del_res.json()["error"]["message"]

    # Create empty batch and delete without force
    empty_batch = client.post(
        "/batches",
        json={"name": "Temporary Empty Batch", "start_date": "2026-03-01", "end_date": "2026-07-01"},
        headers=admin_headers
    ).json()

    del_empty = client.delete(f"/batches/{empty_batch['id']}", headers=admin_headers)
    assert del_empty.status_code == 204

def test_bulk_session_upload_with_partial_failure(client):
    """Verifies CSV upload handling: valid rows are inserted while invalid rows report clear errors."""
    admin_headers = get_admin_headers()
    trainer_headers = get_trainer_headers()

    # Module with max_score 100
    client.post("/modules", json={"name": "Bulk Module A", "max_score": 100.0}, headers=admin_headers)

    # Row 2 is valid (Alice Walker)
    # Row 3 has score 150 which exceeds max_score 100
    csv_content = (
        "trainee_email,module_name,score,errors,time_seconds,created_at\n"
        "alice.walker@test.internal,Bulk Module A,92.0,1,1100,\n"
        "alice.walker@test.internal,Bulk Module A,150.0,0,1000,\n"
    )

    files = {"file": ("test_sessions.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")}
    bulk_res = client.post("/sessions/bulk", files=files, headers=trainer_headers)
    assert bulk_res.status_code == 200

    data = bulk_res.json()
    assert data["inserted"] == 1
    assert data["failed"] == 1
    assert len(data["errors"]) == 1
    assert data["errors"][0]["row"] == 3
    assert "exceeds" in data["errors"][0]["message"]
