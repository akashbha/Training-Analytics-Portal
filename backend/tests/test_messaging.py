"""Integration tests for private messaging between trainees and trainers.
Verifies participant authorization rules, boundary scoping, input validation,
audit logging, and read state tracking.
"""

from datetime import date
import pytest
from app.models.batch import Batch
from app.models.trainee import Trainee
from app.models.user import User
from app.models.batch_trainer import BatchTrainer
from app.models.audit_log import AuditLog
from app.core.security import create_access_token, get_password_hash

@pytest.fixture
def messaging_context(db_session):
    """Sets up batch, trainee, and trainer entities for messaging rule verification."""
    # Ensure Batch 1 exists
    b1 = db_session.query(Batch).filter(Batch.id == 1).first()
    if not b1:
        b1 = Batch(id=1, name="Cohort Alpha", start_date=date(2026, 1, 1), end_date=date(2026, 6, 1))
        db_session.add(b1)
        db_session.commit()

    # Assign Trainer 10 to Batch 1
    bt1 = db_session.query(BatchTrainer).filter(
        BatchTrainer.batch_id == b1.id,
        BatchTrainer.trainer_id == 10
    ).first()
    if not bt1:
        bt1 = BatchTrainer(batch_id=b1.id, trainer_id=10)
        db_session.add(bt1)
        db_session.commit()

    # Create Batch 2 with separate Trainee and separate User
    b2 = db_session.query(Batch).filter(Batch.name == "Cohort Beta").first()
    if not b2:
        b2 = Batch(name="Cohort Beta", start_date=date(2026, 1, 1), end_date=date(2026, 6, 1))
        db_session.add(b2)
        db_session.commit()
        db_session.refresh(b2)

    t3 = db_session.query(Trainee).filter(Trainee.email == "charlie.b2@test.internal").first()
    if not t3:
        t3 = Trainee(name="Charlie Beta", email="charlie.b2@test.internal", batch_id=b2.id)
        db_session.add(t3)
        db_session.commit()
        db_session.refresh(t3)

    u_t3 = db_session.query(User).filter(User.email == "charlie.user@test.internal").first()
    if not u_t3:
        u_t3 = User(
            email="charlie.user@test.internal",
            password_hash=get_password_hash("Trainee@123"),
            role="trainee",
            is_active=True,
            trainee_id=t3.id
        )
        db_session.add(u_t3)
        db_session.commit()
        db_session.refresh(u_t3)

    # Create a second trainer (Trainer 2) not assigned to Batch 1
    u_trainer2 = db_session.query(User).filter(User.email == "trainer2@example.com").first()
    if not u_trainer2:
        u_trainer2 = User(
            email="trainer2@example.com",
            password_hash=get_password_hash("Trainer@123"),
            role="trainer",
            is_active=True
        )
        db_session.add(u_trainer2)
        db_session.commit()
        db_session.refresh(u_trainer2)

    return {
        "b1": b1,
        "b2": b2,
        "trainer1_id": 10,
        "trainer2_id": u_trainer2.id,
        "trainee1_user_id": 11,
        "trainee2_user_id": 12,
        "trainee3_user_id": u_t3.id,
    }

@pytest.fixture
def trainee2_headers():
    token = create_access_token(data={"sub": "12", "role": "trainee", "trainee_id": 2})
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def trainee3_headers(messaging_context):
    token = create_access_token(data={"sub": str(messaging_context["trainee3_user_id"]), "role": "trainee", "trainee_id": 3})
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def trainer2_headers(messaging_context):
    token = create_access_token(data={"sub": str(messaging_context["trainer2_id"]), "role": "trainer"})
    return {"Authorization": f"Bearer {token}"}

def test_admin_cannot_send_or_read_messages(client, admin_headers, messaging_context):
    """Admin accounts receive 403 FORBIDDEN_ROLE on POST, GET thread, and GET contacts."""
    # POST
    resp_post = client.post(
        "/messages",
        json={"recipient_id": messaging_context["trainee1_user_id"], "body": "Admin message attempt"},
        headers=admin_headers
    )
    assert resp_post.status_code == 403
    assert resp_post.json()["error"]["code"] == "FORBIDDEN_ROLE"

    # GET thread
    resp_get = client.get(
        f"/messages/with/{messaging_context['trainee1_user_id']}",
        headers=admin_headers
    )
    assert resp_get.status_code == 403
    assert resp_get.json()["error"]["code"] == "FORBIDDEN_ROLE"

    # GET contacts
    resp_contacts = client.get("/messages/contacts", headers=admin_headers)
    assert resp_contacts.status_code == 403
    assert resp_contacts.json()["error"]["code"] == "FORBIDDEN_ROLE"

def test_send_to_admin_returns_422_invalid_recipient(client, trainer_headers, trainee_headers):
    """Sending a message targeting an admin user ID is rejected with 422 INVALID_RECIPIENT."""
    # Trainer sends to Admin (ID 9)
    resp1 = client.post(
        "/messages",
        json={"recipient_id": 9, "body": "Hello admin from trainer"},
        headers=trainer_headers
    )
    assert resp1.status_code == 422
    assert resp1.json()["error"]["code"] == "INVALID_RECIPIENT"

    # Trainee sends to Admin (ID 9)
    resp2 = client.post(
        "/messages",
        json={"recipient_id": 9, "body": "Hello admin from trainee"},
        headers=trainee_headers
    )
    assert resp2.status_code == 422
    assert resp2.json()["error"]["code"] == "INVALID_RECIPIENT"

def test_trainee_can_message_same_batch_trainee(client, trainee_headers, messaging_context, db_session):
    """Trainee can message a peer in the same batch; audit row is created without message body."""
    recipient_id = messaging_context["trainee2_user_id"]
    body_text = "Hey Bob, let's review the SQL join exercise."

    resp = client.post(
        "/messages",
        json={"recipient_id": recipient_id, "body": body_text},
        headers=trainee_headers
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["sender_id"] == 11
    assert data["recipient_id"] == recipient_id
    assert data["body"] == body_text
    assert "created_at" in data

    # Verify audit log recorded without body text
    audit_entry = (
        db_session.query(AuditLog)
        .filter(
            AuditLog.action == "create",
            AuditLog.entity_type == "message",
            AuditLog.entity_id == data["id"]
        )
        .first()
    )
    assert audit_entry is not None
    assert audit_entry.actor_id == 11
    assert audit_entry.after["recipient_id"] == recipient_id
    assert "body" not in audit_entry.after

def test_trainee_can_message_own_batch_trainer(client, trainee_headers, messaging_context):
    """Trainee can message a trainer assigned to their batch."""
    resp = client.post(
        "/messages",
        json={"recipient_id": messaging_context["trainer1_id"], "body": "Question about session 3."},
        headers=trainee_headers
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["sender_id"] == 11
    assert data["recipient_id"] == messaging_context["trainer1_id"]

def test_trainee_cannot_message_trainee_in_another_batch(client, trainee_headers, messaging_context):
    """Trainee cannot message a trainee in another batch (403 FORBIDDEN_RESOURCE_ACCESS)."""
    resp = client.post(
        "/messages",
        json={"recipient_id": messaging_context["trainee3_user_id"], "body": "Cross-batch outreach"},
        headers=trainee_headers
    )
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN_RESOURCE_ACCESS"

def test_trainer_can_message_trainee_in_assigned_batch(client, trainer_headers, messaging_context):
    """Trainer can message a trainee in an assigned batch."""
    resp = client.post(
        "/messages",
        json={"recipient_id": messaging_context["trainee1_user_id"], "body": "Great progress on today's drill."},
        headers=trainer_headers
    )
    assert resp.status_code == 201

def test_trainer_cannot_message_another_trainer(client, trainer_headers, messaging_context):
    """Trainer-to-trainer messaging is forbidden (403 FORBIDDEN_ROLE)."""
    resp = client.post(
        "/messages",
        json={"recipient_id": messaging_context["trainer2_id"], "body": "Trainer to trainer note."},
        headers=trainer_headers
    )
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN_ROLE"

def test_trainee_cannot_read_thread_with_unauthorized_user(client, trainee_headers, messaging_context):
    """Trainee cannot read messages with a trainee in another batch (403 FORBIDDEN_RESOURCE_ACCESS)."""
    resp = client.get(
        f"/messages/with/{messaging_context['trainee3_user_id']}",
        headers=trainee_headers
    )
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN_RESOURCE_ACCESS"

def test_body_length_and_empty_validation(client, trainee_headers, messaging_context):
    """Body over 500 characters or whitespace-only/empty is rejected with 422."""
    recipient_id = messaging_context["trainee2_user_id"]

    # 501 chars
    resp_oversized = client.post(
        "/messages",
        json={"recipient_id": recipient_id, "body": "A" * 501},
        headers=trainee_headers
    )
    assert resp_oversized.status_code == 422

    # Empty
    resp_empty = client.post(
        "/messages",
        json={"recipient_id": recipient_id, "body": ""},
        headers=trainee_headers
    )
    assert resp_empty.status_code == 422

    # Whitespace only
    resp_whitespace = client.post(
        "/messages",
        json={"recipient_id": recipient_id, "body": "    "},
        headers=trainee_headers
    )
    assert resp_whitespace.status_code == 422

def test_sending_to_yourself_rejected(client, trainee_headers):
    """Sending a message to oneself is rejected with 422."""
    resp = client.post(
        "/messages",
        json={"recipient_id": 11, "body": "Talking to myself"},
        headers=trainee_headers
    )
    assert resp.status_code == 422

def test_contacts_for_trainee(client, trainee_headers, messaging_context):
    """Trainee contacts list contains only same-batch peers and batch trainer, never admins."""
    resp = client.get("/messages/contacts", headers=trainee_headers)
    assert resp.status_code == 200
    contacts = resp.json()

    contact_ids = [c["id"] for c in contacts]
    assert messaging_context["trainee2_user_id"] in contact_ids
    assert messaging_context["trainer1_id"] in contact_ids
    assert 9 not in contact_ids  # Admin never in contacts
    assert messaging_context["trainee3_user_id"] not in contact_ids  # Other batch never in contacts

def test_mark_as_read_inbound_only(client, trainee_headers, trainer_headers, messaging_context):
    """PUT /messages/with/{user_id}/read sets read_at only on inbound messages."""
    t1_id = messaging_context["trainee1_user_id"]
    trainer_id = messaging_context["trainer1_id"]

    # Trainee sends message to Trainer
    resp_msg1 = client.post(
        "/messages",
        json={"recipient_id": trainer_id, "body": "Inbound to trainer"},
        headers=trainee_headers
    )
    msg1_id = resp_msg1.json()["id"]

    # Trainer sends reply to Trainee
    resp_msg2 = client.post(
        "/messages",
        json={"recipient_id": t1_id, "body": "Outbound from trainer"},
        headers=trainer_headers
    )
    msg2_id = resp_msg2.json()["id"]

    # Trainer marks thread with Trainee as read
    read_resp = client.put(f"/messages/with/{t1_id}/read", headers=trainer_headers)
    assert read_resp.status_code == 200

    # Fetch thread
    thread_resp = client.get(f"/messages/with/{t1_id}", headers=trainer_headers)
    assert thread_resp.status_code == 200
    messages = thread_resp.json()["items"]

    msg1 = next(m for m in messages if m["id"] == msg1_id)
    msg2 = next(m for m in messages if m["id"] == msg2_id)

    # Inbound to trainer: read_at must be populated
    assert msg1["read_at"] is not None
    # Outbound from trainer: read_at was not affected by trainer reading
    assert msg2["read_at"] is None

