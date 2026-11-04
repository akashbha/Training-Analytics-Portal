"""Test suite for Step 4: Append-only audit log system.
Verifies:
- Append-only repository guards: update and delete on AuditRepository raise NotImplementedError.
- Create writes one audit row with after set and before null.
- Update writes one audit row with before and after set.
- Delete writes one audit row with before set and after null.
- Comprehensive audit coverage across Trainees, Batches, Modules, and Sessions.
"""

import pytest
from app.models.audit_log import AuditLog
from app.repositories.audit_repository import AuditRepository
from app.core.security import create_access_token


def get_admin_headers():
    token = create_access_token(data={"sub": "9", "role": "admin"})
    return {"Authorization": f"Bearer {token}"}


def get_trainer_headers():
    token = create_access_token(data={"sub": "10", "role": "trainer", "trainee_id": None})
    return {"Authorization": f"Bearer {token}"}


def test_audit_repository_append_only_guards(db_session):
    """AuditRepository must strictly reject updates and deletions to maintain append-only ledger semantics."""
    repo = AuditRepository(db_session)

    # 1. Update must raise NotImplementedError
    with pytest.raises(NotImplementedError) as exc_update:
        repo.update(1, {"details": "tampered"})
    assert "append-only" in str(exc_update.value)

    # 2. Delete must raise NotImplementedError
    with pytest.raises(NotImplementedError) as exc_delete:
        repo.delete(1)
    assert "append-only" in str(exc_delete.value)


def test_batch_audit_lifecycle(client, db_session):
    """Batch lifecycle (create, update, delete) writes exact audit rows with before/after state snapshots."""
    admin_headers = get_admin_headers()

    # 1. CREATE BATCH
    payload_create = {"name": "Audit Batch Alpha", "start_date": "2026-03-01", "end_date": "2026-09-01"}
    res_c = client.post("/batches", json=payload_create, headers=admin_headers)
    assert res_c.status_code == 201
    batch_id = res_c.json()["id"]

    # Verify create audit row: after is set, before is null
    c_log = db_session.query(AuditLog).filter(
        AuditLog.entity_type == "batch",
        AuditLog.entity_id == batch_id,
        AuditLog.action == "create"
    ).order_by(AuditLog.id.desc()).first()
    assert c_log is not None
    assert c_log.actor_id == 9
    assert c_log.before is None
    assert c_log.after is not None
    assert c_log.after["name"] == "Audit Batch Alpha"

    # 2. UPDATE BATCH
    payload_update = {"name": "Audit Batch Alpha Renamed", "start_date": "2026-03-01", "end_date": "2026-09-15"}
    res_u = client.put(f"/batches/{batch_id}", json=payload_update, headers=admin_headers)
    assert res_u.status_code == 200

    # Verify update audit row: before and after are both set
    u_log = db_session.query(AuditLog).filter(
        AuditLog.entity_type == "batch",
        AuditLog.entity_id == batch_id,
        AuditLog.action == "update"
    ).order_by(AuditLog.id.desc()).first()
    assert u_log is not None
    assert u_log.actor_id == 9
    assert u_log.before is not None
    assert u_log.before["name"] == "Audit Batch Alpha"
    assert u_log.after is not None
    assert u_log.after["name"] == "Audit Batch Alpha Renamed"

    # 3. DELETE BATCH
    res_d = client.delete(f"/batches/{batch_id}?force=true", headers=admin_headers)
    assert res_d.status_code == 204

    # Verify delete audit row: before is set, after is null
    d_log = db_session.query(AuditLog).filter(
        AuditLog.entity_type == "batch",
        AuditLog.entity_id == batch_id,
        AuditLog.action == "delete"
    ).order_by(AuditLog.id.desc()).first()
    assert d_log is not None
    assert d_log.actor_id == 9
    assert d_log.before is not None
    assert d_log.before["name"] == "Audit Batch Alpha Renamed"
    assert d_log.after is None


def test_trainee_audit_lifecycle(client, db_session):
    """Trainee lifecycle (create, update, delete) writes exact audit rows with before/after state snapshots."""
    trainer_headers = get_trainer_headers()
    admin_headers = get_admin_headers()

    # 1. CREATE TRAINEE
    payload_create = {
        "name": "Audit Trainee",
        "email": "audit.trainee@test.internal",
        "batch_id": 1
    }
    res_c = client.post("/trainees", json=payload_create, headers=trainer_headers)
    assert res_c.status_code == 201
    trainee_id = res_c.json()["id"]

    c_log = db_session.query(AuditLog).filter(
        AuditLog.entity_type == "trainee",
        AuditLog.entity_id == trainee_id,
        AuditLog.action == "create"
    ).order_by(AuditLog.id.desc()).first()
    assert c_log is not None
    assert c_log.actor_id == 10
    assert c_log.before is None
    assert c_log.after is not None
    assert c_log.after["email"] == "audit.trainee@test.internal"

    # 2. UPDATE TRAINEE
    payload_update = {
        "name": "Audit Trainee Updated",
        "email": "audit.trainee.updated@test.internal",
        "batch_id": 1
    }
    res_u = client.put(f"/trainees/{trainee_id}", json=payload_update, headers=trainer_headers)
    assert res_u.status_code == 200

    u_log = db_session.query(AuditLog).filter(
        AuditLog.entity_type == "trainee",
        AuditLog.entity_id == trainee_id,
        AuditLog.action == "update"
    ).order_by(AuditLog.id.desc()).first()
    assert u_log is not None
    assert u_log.actor_id == 10
    assert u_log.before is not None
    assert u_log.before["name"] == "Audit Trainee"
    assert u_log.after is not None
    assert u_log.after["name"] == "Audit Trainee Updated"

    # 3. DELETE TRAINEE
    res_d = client.delete(f"/trainees/{trainee_id}", headers=admin_headers)
    assert res_d.status_code == 204

    d_log = db_session.query(AuditLog).filter(
        AuditLog.entity_type == "trainee",
        AuditLog.entity_id == trainee_id,
        AuditLog.action == "delete"
    ).order_by(AuditLog.id.desc()).first()
    assert d_log is not None
    assert d_log.actor_id == 9
    assert d_log.before is not None
    assert d_log.before["email"] == "audit.trainee.updated@test.internal"
    assert d_log.after is None


def test_module_audit_lifecycle(client, db_session):
    """Module lifecycle (create, update, delete) writes exact audit rows with before/after state snapshots."""
    admin_headers = get_admin_headers()

    # 1. CREATE MODULE
    payload_create = {"name": "Audit Module Test", "max_score": 50.0}
    res_c = client.post("/modules", json=payload_create, headers=admin_headers)
    assert res_c.status_code == 201
    module_id = res_c.json()["id"]

    c_log = db_session.query(AuditLog).filter(
        AuditLog.entity_type == "module",
        AuditLog.entity_id == module_id,
        AuditLog.action == "create"
    ).order_by(AuditLog.id.desc()).first()
    assert c_log is not None
    assert c_log.actor_id == 9
    assert c_log.before is None
    assert c_log.after is not None
    assert c_log.after["name"] == "Audit Module Test"

    # 2. UPDATE MODULE
    payload_update = {"name": "Audit Module Test Updated", "max_score": 75.0}
    res_u = client.put(f"/modules/{module_id}", json=payload_update, headers=admin_headers)
    assert res_u.status_code == 200

    u_log = db_session.query(AuditLog).filter(
        AuditLog.entity_type == "module",
        AuditLog.entity_id == module_id,
        AuditLog.action == "update"
    ).order_by(AuditLog.id.desc()).first()
    assert u_log is not None
    assert u_log.before is not None
    assert u_log.before["max_score"] == 50.0
    assert u_log.after is not None
    assert u_log.after["max_score"] == 75.0

    # 3. DELETE MODULE
    res_d = client.delete(f"/modules/{module_id}", headers=admin_headers)
    assert res_d.status_code == 204

    d_log = db_session.query(AuditLog).filter(
        AuditLog.entity_type == "module",
        AuditLog.entity_id == module_id,
        AuditLog.action == "delete"
    ).order_by(AuditLog.id.desc()).first()
    assert d_log is not None
    assert d_log.before is not None
    assert d_log.before["name"] == "Audit Module Test Updated"
    assert d_log.after is None


def test_session_audit_lifecycle(client, db_session):
    """Session lifecycle (create, update, delete) writes exact audit rows with before/after state snapshots."""
    from app.models.module import Module
    mod = Module(name="Session Audit Mod", max_score=100.0)
    db_session.add(mod)
    db_session.commit()

    trainer_headers = get_trainer_headers()

    # 1. CREATE SESSION
    payload_create = {
        "trainee_id": 1,
        "module_id": mod.id,
        "score": 85.0,
        "errors": 2,
        "time_seconds": 1500,
        "created_at": "2026-05-20T10:00:00Z"
    }
    res_c = client.post("/sessions", json=payload_create, headers=trainer_headers)
    assert res_c.status_code == 201
    session_id = res_c.json()["id"]

    c_log = db_session.query(AuditLog).filter(
        AuditLog.entity_type == "session",
        AuditLog.entity_id == session_id,
        AuditLog.action == "create"
    ).first()
    assert c_log is not None
    assert c_log.actor_id == 10
    assert c_log.before is None
    assert c_log.after is not None
    assert c_log.after["score"] == 85.0

    # 2. UPDATE SESSION
    payload_update = {
        "trainee_id": 1,
        "module_id": mod.id,
        "score": 90.0,
        "errors": 1,
        "time_seconds": 1400,
        "created_at": "2026-05-20T10:00:00Z"
    }
    res_u = client.put(f"/sessions/{session_id}", json=payload_update, headers=trainer_headers)
    assert res_u.status_code == 200

    u_log = db_session.query(AuditLog).filter(
        AuditLog.entity_type == "session",
        AuditLog.entity_id == session_id,
        AuditLog.action == "update"
    ).first()
    assert u_log is not None
    assert u_log.actor_id == 10
    assert u_log.before is not None
    assert u_log.before["score"] == 85.0
    assert u_log.after is not None
    assert u_log.after["score"] == 90.0

    # 3. DELETE SESSION
    res_d = client.delete(f"/sessions/{session_id}", headers=trainer_headers)
    assert res_d.status_code == 204

    d_log = db_session.query(AuditLog).filter(
        AuditLog.entity_type == "session",
        AuditLog.entity_id == session_id,
        AuditLog.action == "delete"
    ).first()
    assert d_log is not None
    assert d_log.actor_id == 10
    assert d_log.before is not None
    assert d_log.before["score"] == 90.0
    assert d_log.after is None
