"""Comprehensive unit and integration test suite for Stage 9b: Admin Role and Audit Logs.
Validates permission matrix, safety invariants, inactive user rejections, and audit log tracking.
"""

from datetime import date
import pytest
from app.models.user import User
from app.models.batch import Batch
from app.models.module import Module
from app.models.trainee import Trainee
from app.models.session import Session
from app.models.audit_log import AuditLog
from app.core.security import get_password_hash, create_access_token

def test_login_rejects_inactive_user(client, db_session):
    """Inactive users must be rejected during login with the generic credentials error."""
    inactive_user = User(
        email="inactive@example.com",
        password_hash=get_password_hash("Secret@123"),
        role="trainer",
        is_active=False
    )
    db_session.add(inactive_user)
    db_session.commit()

    resp = client.post("/auth/login", json={"email": "inactive@example.com", "password": "Secret@123"})
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "INVALID_CREDENTIALS"
    assert "Invalid email or password" in resp.json()["error"]["message"]

def test_old_token_rejected_for_inactive_user(client, db_session):
    """An old active token must be rejected with 401 when the user account is deactivated."""
    user = User(
        email="temp_inactive@example.com",
        password_hash=get_password_hash("Secret@123"),
        role="trainer",
        is_active=True
    )
    db_session.add(user)
    db_session.commit()

    # Generate token while active
    token = create_access_token(data={"sub": str(user.id), "role": "trainer"})

    # Deactivate user
    user.is_active = False
    db_session.commit()

    resp = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "USER_INACTIVE"

def test_batch_crud_matrix(client, admin_headers, trainer_headers, trainee_headers):
    """Batches: trainer gets 403 on create/edit/delete; admin gets 201/200/204; all get 200 on read."""
    # 1. Read: all roles can list
    assert client.get("/batches", headers=trainee_headers).status_code == 200
    assert client.get("/batches", headers=trainer_headers).status_code == 200
    assert client.get("/batches", headers=admin_headers).status_code == 200

    # 2. Create: Trainer forbidden (403)
    batch_payload = {"name": "Trainer Blocked Batch", "start_date": "2026-06-01", "end_date": "2026-09-01"}
    resp = client.post("/batches", json=batch_payload, headers=trainer_headers)
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN_ADMIN_ONLY"

    # Trainee forbidden (403)
    assert client.post("/batches", json=batch_payload, headers=trainee_headers).status_code == 403

    # Admin allowed (201)
    admin_batch_payload = {"name": "Admin Success Batch", "start_date": "2026-06-01", "end_date": "2026-09-01"}
    resp_create = client.post("/batches", json=admin_batch_payload, headers=admin_headers)
    assert resp_create.status_code == 201
    batch_id = resp_create.json()["id"]

    # 3. Update: Trainer forbidden (403)
    update_payload = {"name": "Admin Updated Batch", "start_date": "2026-06-01", "end_date": "2026-09-01"}
    assert client.put(f"/batches/{batch_id}", json=update_payload, headers=trainer_headers).status_code == 403

    # Admin allowed (200)
    resp_update = client.put(f"/batches/{batch_id}", json=update_payload, headers=admin_headers)
    assert resp_update.status_code == 200
    assert resp_update.json()["name"] == "Admin Updated Batch"

    # 4. Delete: Trainer forbidden (403)
    assert client.delete(f"/batches/{batch_id}", headers=trainer_headers).status_code == 403

    # Admin allowed (204)
    assert client.delete(f"/batches/{batch_id}", headers=admin_headers).status_code == 204

def test_module_crud_matrix(client, admin_headers, trainer_headers):
    """Modules: trainer gets 403 on create/edit/delete; admin gets 201/200/204."""
    mod_payload = {"name": "Test Module 99", "max_score": 100.0}

    # Trainer create forbidden (403)
    assert client.post("/modules", json=mod_payload, headers=trainer_headers).status_code == 403

    # Admin create allowed (201)
    res = client.post("/modules", json=mod_payload, headers=admin_headers)
    assert res.status_code == 201
    mod_id = res.json()["id"]

    # Trainer update forbidden (403)
    assert client.put(f"/modules/{mod_id}", json={"name": "Updated Mod 99", "max_score": 50.0}, headers=trainer_headers).status_code == 403

    # Admin update allowed (200)
    res_up = client.put(f"/modules/{mod_id}", json={"name": "Updated Mod 99", "max_score": 50.0}, headers=admin_headers)
    assert res_up.status_code == 200

    # Trainer delete forbidden (403)
    assert client.delete(f"/modules/{mod_id}", headers=trainer_headers).status_code == 403

    # Admin delete allowed (204)
    assert client.delete(f"/modules/{mod_id}", headers=admin_headers).status_code == 204

def test_trainee_delete_matrix(client, admin_headers, trainer_headers, db_session):
    """Trainees: trainer cannot delete (403); admin can delete empty trainee (204)."""
    batch = db_session.query(Batch).first()
    t = Trainee(name="Trainee For Del", email="del_me@test.internal", batch_id=batch.id)
    db_session.add(t)
    db_session.commit()

    # Trainer delete forbidden (403)
    res_trainer = client.delete(f"/trainees/{t.id}", headers=trainer_headers)
    assert res_trainer.status_code == 403
    assert res_trainer.json()["error"]["code"] == "FORBIDDEN_ADMIN_ONLY"

    # Admin delete allowed (204)
    res_admin = client.delete(f"/trainees/{t.id}", headers=admin_headers)
    assert res_admin.status_code == 204

def test_session_delete_ownership_rule(client, admin_headers, trainer_headers, db_session):
    """Sessions: trainer can only delete sessions where created_by is their id; admin can delete any."""
    trainee = db_session.query(Trainee).first()
    mod = db_session.query(Module).first()
    if not mod:
        mod = Module(name="Mod For Sess", max_score=100.0)
        db_session.add(mod)
        db_session.commit()

    # Session created by trainer (id=10)
    s1 = Session(trainee_id=trainee.id, module_id=mod.id, score=90, errors=1, time_seconds=1000, created_by=10)
    # Session created by someone else (id=99)
    s2 = Session(trainee_id=trainee.id, module_id=mod.id, score=85, errors=2, time_seconds=1200, created_by=99)
    db_session.add_all([s1, s2])
    db_session.commit()

    # Trainer (id=10) tries to delete s2 (created_by=99) -> 403
    res_denied = client.delete(f"/sessions/{s2.id}", headers=trainer_headers)
    assert res_denied.status_code == 403
    assert res_denied.json()["error"]["code"] == "FORBIDDEN_DELETE_SESSION"

    # Trainer (id=10) deletes own session s1 (created_by=10) -> 204
    res_ok = client.delete(f"/sessions/{s1.id}", headers=trainer_headers)
    assert res_ok.status_code == 204

    # Admin (id=9) deletes s2 (created_by=99) -> 204
    res_admin = client.delete(f"/sessions/{s2.id}", headers=admin_headers)
    assert res_admin.status_code == 204

def test_admin_user_management_and_safety_rules(client, admin_headers, trainer_headers, db_session):
    """Admin user management, self-protection, and last-admin rule."""
    # 1. Non-admin forbidden from /admin/users
    assert client.get("/admin/users", headers=trainer_headers).status_code == 403

    # 2. Admin creates trainer user
    create_payload = {
        "email": "new_trainer@example.com",
        "role": "trainer",
        "password": "Temporary@123"
    }
    res_create = client.post("/admin/users", json=create_payload, headers=admin_headers)
    assert res_create.status_code == 201
    created_user_id = res_create.json()["user"]["id"]
    assert res_create.json()["temporary_password"] == "Temporary@123"

    # 3. Trainee creation requires existing valid trainee_id
    trainee_fail = client.post("/admin/users", json={"email": "bad_trainee@example.com", "role": "trainee"}, headers=admin_headers)
    assert trainee_fail.status_code == 400

    trainee_not_found = client.post("/admin/users", json={"email": "bad_trainee@example.com", "role": "trainee", "trainee_id": 99999}, headers=admin_headers)
    assert trainee_not_found.status_code == 404

    # Trainee creation linking to trainee 1 (which was already linked to user 11 in conftest) -> 409
    trainee_conflict = client.post("/admin/users", json={"email": "conflict@example.com", "role": "trainee", "trainee_id": 1}, headers=admin_headers)
    assert trainee_conflict.status_code == 409

    # 4. Self-protection: Admin cannot deactivate self (409)
    res_self_deact = client.patch("/admin/users/9", json={"is_active": False}, headers=admin_headers)
    assert res_self_deact.status_code == 409
    assert res_self_deact.json()["error"]["code"] == "CANNOT_DEACTIVATE_SELF"

    # Admin cannot demote self (409)
    res_self_demote = client.patch("/admin/users/9", json={"role": "trainer"}, headers=admin_headers)
    assert res_self_demote.status_code == 409
    assert res_self_demote.json()["error"]["code"] == "CANNOT_DEMOTE_SELF"

    # 5. Last active admin rule: Since admin (id=9) is the only active admin, demoting/deactivating cannot occur
    # Create second admin
    res_admin2 = client.post("/admin/users", json={"email": "admin2@example.com", "role": "admin", "password": "Admin2@Password"}, headers=admin_headers)
    assert res_admin2.status_code == 201
    admin2_id = res_admin2.json()["user"]["id"]

    # Deactivate admin2 (now allowed because admin id=9 is still active)
    res_deact2 = client.patch(f"/admin/users/{admin2_id}", json={"is_active": False}, headers=admin_headers)
    assert res_deact2.status_code == 200
    assert res_deact2.json()["is_active"] is False

    # 6. Reset password endpoint
    res_reset = client.post(f"/admin/users/{created_user_id}/reset-password", headers=admin_headers)
    assert res_reset.status_code == 200
    assert "temporary_password" in res_reset.json()

def test_change_password_endpoint(client, trainer_headers):
    """All roles can change their password at POST /auth/change-password."""
    # Wrong current password -> 400
    bad_curr = client.post(
        "/auth/change-password",
        json={"current_password": "WrongPassword", "new_password": "NewSecret@123"},
        headers=trainer_headers
    )
    assert bad_curr.status_code == 400
    assert bad_curr.json()["error"]["code"] == "INVALID_CURRENT_PASSWORD"

    # Password too short -> 422
    too_short = client.post(
        "/auth/change-password",
        json={"current_password": "Trainer@123", "new_password": "short"},
        headers=trainer_headers
    )
    assert too_short.status_code == 422

    # Success -> 200
    ok = client.post(
        "/auth/change-password",
        json={"current_password": "Trainer@123", "new_password": "NewTrainer@123"},
        headers=trainer_headers
    )
    assert ok.status_code == 200

def test_audit_logs_written_and_queried(client, admin_headers, db_session):
    """Audit logs must be written for entity mutations and queryable at GET /admin/audit-logs."""
    res_logs = client.get("/admin/audit-logs", headers=admin_headers)
    assert res_logs.status_code == 200
    logs_data = res_logs.json()
    assert "items" in logs_data
    assert logs_data["total"] >= 1

    # Verify no passwords in details
    for item in logs_data["items"]:
        if item.get("details"):
            assert "password" not in str(item["details"]).lower() or "[REDACTED]" in str(item["details"])
