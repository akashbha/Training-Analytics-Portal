"""Integration tests for batch trainer assignment endpoints.
Verifies admin-only access, non-trainer validation rejection (422 INVALID_TRAINER),
listing, deletion, and audit trail logging.
"""

import pytest
from app.models.batch import Batch
from app.models.batch_trainer import BatchTrainer
from app.models.audit_log import AuditLog
from app.models.user import User

@pytest.fixture
def sample_batch(db_session):
    """Creates an isolated batch for trainer assignment testing."""
    import uuid
    from datetime import date
    b = Batch(name=f"Test Cohort For Trainers {uuid.uuid4().hex[:6]}", start_date=date(2026, 1, 1), end_date=date(2026, 6, 1))
    db_session.add(b)
    db_session.commit()
    db_session.refresh(b)
    return b

def test_admin_can_assign_and_list_batch_trainer(client, admin_headers, sample_batch, db_session):
    """Admin can assign a trainer to a batch and list assignments; writes audit log."""
    # Find trainer user
    trainer = db_session.query(User).filter(User.role == "trainer").first()
    assert trainer is not None

    resp = client.post(
        f"/batches/{sample_batch.id}/trainers",
        json={"trainer_id": trainer.id},
        headers=admin_headers
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["batch_id"] == sample_batch.id
    assert data["trainer_id"] == trainer.id
    assert "assigned_at" in data

    # Verify audit log was recorded
    audit_entry = (
        db_session.query(AuditLog)
        .filter(
            AuditLog.action == "assign_batch_trainer",
            AuditLog.entity_id == data["id"]
        )
        .first()
    )
    assert audit_entry is not None
    assert audit_entry.actor_id == 9  # admin fixture user id

    # List batch trainers
    list_resp = client.get(f"/batches/{sample_batch.id}/trainers", headers=admin_headers)
    assert list_resp.status_code == 200
    trainers_list = list_resp.json()
    assert any(t["trainer_id"] == trainer.id for t in trainers_list)

def test_assign_non_trainer_rejected(client, admin_headers, sample_batch, db_session):
    """Assigning a trainee or admin as batch trainer is rejected with 422 INVALID_TRAINER."""
    trainee_user = db_session.query(User).filter(User.role == "trainee").first()
    assert trainee_user is not None

    resp = client.post(
        f"/batches/{sample_batch.id}/trainers",
        json={"trainer_id": trainee_user.id},
        headers=admin_headers
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "INVALID_TRAINER"

def test_non_admin_cannot_assign_batch_trainer(client, trainer_headers, trainee_headers, sample_batch, db_session):
    """Trainers and trainees receive 403 when attempting to assign a batch trainer."""
    trainer = db_session.query(User).filter(User.role == "trainer").first()
    payload = {"trainer_id": trainer.id}

    resp_trainer = client.post(f"/batches/{sample_batch.id}/trainers", json=payload, headers=trainer_headers)
    assert resp_trainer.status_code == 403

    resp_trainee = client.post(f"/batches/{sample_batch.id}/trainers", json=payload, headers=trainee_headers)
    assert resp_trainee.status_code == 403

def test_admin_can_unassign_batch_trainer(client, admin_headers, sample_batch, db_session):
    """Admin can remove a trainer assignment (204); writes audit log."""
    trainer = db_session.query(User).filter(User.role == "trainer").first()
    # Ensure assigned
    client.post(
        f"/batches/{sample_batch.id}/trainers",
        json={"trainer_id": trainer.id},
        headers=admin_headers
    )

    del_resp = client.delete(
        f"/batches/{sample_batch.id}/trainers/{trainer.id}",
        headers=admin_headers
    )
    assert del_resp.status_code == 204

    # Verify audit log was recorded
    audit_entry = (
        db_session.query(AuditLog)
        .filter(AuditLog.action == "unassign_batch_trainer")
        .order_by(AuditLog.id.desc())
        .first()
    )
    assert audit_entry is not None
    assert audit_entry.before["batch_id"] == sample_batch.id
    assert audit_entry.before["trainer_id"] == trainer.id


def test_inactive_and_duplicate_trainer_assignment_blocked(client, admin_headers, sample_batch, db_session):
    """Inactive trainers return 422 INACTIVE_TRAINER and duplicate assignment returns 409 TRAINER_ALREADY_ASSIGNED."""
    from app.core.security import get_password_hash

    active_trainer = User(
        email="active_extra_trainer@example.com",
        password_hash=get_password_hash("Trainer@123"),
        role="trainer",
        is_active=True,
    )
    inactive_trainer = User(
        email="inactive_extra_trainer@example.com",
        password_hash=get_password_hash("Trainer@123"),
        role="trainer",
        is_active=False,
    )
    db_session.add_all([active_trainer, inactive_trainer])
    db_session.commit()
    db_session.refresh(active_trainer)
    db_session.refresh(inactive_trainer)

    # Inactive trainer rejected
    resp_inactive = client.post(
        f"/batches/{sample_batch.id}/trainers",
        json={"trainer_id": inactive_trainer.id},
        headers=admin_headers,
    )
    assert resp_inactive.status_code == 422
    assert resp_inactive.json()["error"]["code"] == "INACTIVE_TRAINER"

    # Active trainer assigned cleanly once
    resp_first = client.post(
        f"/batches/{sample_batch.id}/trainers",
        json={"trainer_id": active_trainer.id},
        headers=admin_headers,
    )
    assert resp_first.status_code == 201

    # Assigning same trainer twice returns 409
    resp_dup = client.post(
        f"/batches/{sample_batch.id}/trainers",
        json={"trainer_id": active_trainer.id},
        headers=admin_headers,
    )
    assert resp_dup.status_code == 409
    assert resp_dup.json()["error"]["code"] == "TRAINER_ALREADY_ASSIGNED"

    # Admin users role + is_active filter excludes inactive trainer
    users_active = client.get("/admin/users?role=trainer&is_active=true&page_size=100", headers=admin_headers)
    assert users_active.status_code == 200
    emails = [u["email"] for u in users_active.json()["items"]]
    assert "active_extra_trainer@example.com" in emails
    assert "inactive_extra_trainer@example.com" not in emails

