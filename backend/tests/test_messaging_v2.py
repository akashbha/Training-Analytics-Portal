"""Tests for messaging v2: batch channels, private messages, and attachments.
Verifies authorization boundaries, batch constraints, file validation, and audit logging.
"""

from datetime import date, datetime, timezone
import io
import pytest
from sqlalchemy.exc import IntegrityError

from app.models.batch import Batch
from app.models.trainee import Trainee
from app.models.user import User
from app.models.batch_trainer import BatchTrainer
from app.models.message import Message
from app.models.audit_log import AuditLog
from app.core.security import create_access_token, get_password_hash


@pytest.fixture
def messaging_context_v2(db_session):
    """Sets up two batches with trainees and assigned/unassigned trainers."""
    b1 = db_session.query(Batch).filter(Batch.id == 1).first()
    if not b1:
        b1 = Batch(id=1, name="Cohort Alpha", start_date=date(2026, 1, 1), end_date=date(2026, 6, 1))
        db_session.add(b1)
        db_session.commit()
        db_session.refresh(b1)

    # Assign Trainer 10 to Batch 1
    bt1 = db_session.query(BatchTrainer).filter(
        BatchTrainer.batch_id == b1.id,
        BatchTrainer.trainer_id == 10
    ).first()
    if not bt1:
        bt1 = BatchTrainer(batch_id=b1.id, trainer_id=10)
        db_session.add(bt1)
        db_session.commit()

    # Batch 2
    b2 = db_session.query(Batch).filter(Batch.name == "Cohort Beta").first()
    if not b2:
        b2 = Batch(name="Cohort Beta", start_date=date(2026, 1, 1), end_date=date(2026, 6, 1))
        db_session.add(b2)
        db_session.commit()
        db_session.refresh(b2)

    # Trainee 3 in Batch 2
    t3 = db_session.query(Trainee).filter(Trainee.email == "trainee3.b2@test.internal").first()
    if not t3:
        t3 = Trainee(name="Charlie Beta", email="trainee3.b2@test.internal", batch_id=b2.id)
        db_session.add(t3)
        db_session.commit()
        db_session.refresh(t3)

    u_t3 = db_session.query(User).filter(User.email == "charlie.v2@test.internal").first()
    if not u_t3:
        u_t3 = User(
            email="charlie.v2@test.internal",
            password_hash=get_password_hash("Trainee@123"),
            role="trainee",
            is_active=True,
            trainee_id=t3.id
        )
        db_session.add(u_t3)
        db_session.commit()
        db_session.refresh(u_t3)

    # Trainer 2 not assigned to Batch 1
    u_tr2 = db_session.query(User).filter(User.email == "trainer2.v2@example.com").first()
    if not u_tr2:
        u_tr2 = User(
            email="trainer2.v2@example.com",
            password_hash=get_password_hash("Trainer@123"),
            role="trainer",
            is_active=True
        )
        db_session.add(u_tr2)
        db_session.commit()
        db_session.refresh(u_tr2)

    return {
        "b1_id": b1.id,
        "b2_id": b2.id,
        "trainer1_id": 10,
        "trainer2_id": u_tr2.id,
        "trainee1_user_id": 11,
        "trainee2_user_id": 12,
        "trainee3_user_id": u_t3.id,
    }


@pytest.fixture
def trainee2_headers():
    token = create_access_token(data={"sub": "12", "role": "trainee", "trainee_id": 2})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def trainee3_headers(messaging_context_v2):
    token = create_access_token(data={
        "sub": str(messaging_context_v2["trainee3_user_id"]),
        "role": "trainee",
        "trainee_id": 3
    })
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def trainer2_headers(messaging_context_v2):
    token = create_access_token(data={
        "sub": str(messaging_context_v2["trainer2_id"]),
        "role": "trainer"
    })
    return {"Authorization": f"Bearer {token}"}


# ============================================================================
# 1. BATCH CHANNEL TESTS
# ============================================================================

def test_trainee_reads_and_posts_in_own_batch(client, trainee_headers, messaging_context_v2):
    """Trainee can post to own batch channel (201) and read batch channel history (200)."""
    b1_id = messaging_context_v2["b1_id"]

    # Post
    resp = client.post(
        "/messages",
        json={"channel": "batch", "batch_id": b1_id, "body": "Hello batch cohort 1"},
        headers=trainee_headers
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["channel"] == "batch"
    assert data["batch_id"] == b1_id
    assert data["recipient_id"] is None
    assert data["body"] == "Hello batch cohort 1"

    # Read
    resp_read = client.get(f"/messages/batch/{b1_id}", headers=trainee_headers)
    assert resp_read.status_code == 200
    items = resp_read.json()["items"]
    assert any(m["id"] == data["id"] for m in items)


def test_trainee_in_another_batch_forbidden_on_read_and_post(client, trainee3_headers, messaging_context_v2):
    """Trainee from batch 2 receives 403 FORBIDDEN_RESOURCE_ACCESS on batch 1 read and post."""
    b1_id = messaging_context_v2["b1_id"]

    # Post attempt
    resp_post = client.post(
        "/messages",
        json={"channel": "batch", "batch_id": b1_id, "body": "Unauthorized cross batch post"},
        headers=trainee3_headers
    )
    assert resp_post.status_code == 403
    assert resp_post.json()["error"]["code"] == "FORBIDDEN_RESOURCE_ACCESS"

    # Read attempt
    resp_read = client.get(f"/messages/batch/{b1_id}", headers=trainee3_headers)
    assert resp_read.status_code == 403
    assert resp_read.json()["error"]["code"] == "FORBIDDEN_RESOURCE_ACCESS"


def test_batch_trainer_reads_and_posts_in_assigned_batch(client, trainer_headers, messaging_context_v2):
    """Assigned batch trainer can read and post to the batch channel (201)."""
    b1_id = messaging_context_v2["b1_id"]

    resp = client.post(
        "/messages",
        json={"channel": "batch", "batch_id": b1_id, "body": "Welcome everyone to batch 1."},
        headers=trainer_headers
    )
    assert resp.status_code == 201

    resp_read = client.get(f"/messages/batch/{b1_id}", headers=trainer_headers)
    assert resp_read.status_code == 200


def test_trainer_not_assigned_to_batch_gets_403(client, trainer2_headers, messaging_context_v2):
    """Trainer not assigned to batch receives 403 FORBIDDEN_RESOURCE_ACCESS on read and post."""
    b1_id = messaging_context_v2["b1_id"]

    # Post
    resp_post = client.post(
        "/messages",
        json={"channel": "batch", "batch_id": b1_id, "body": "Unassigned trainer attempting to post"},
        headers=trainer2_headers
    )
    assert resp_post.status_code == 403
    assert resp_post.json()["error"]["code"] == "FORBIDDEN_RESOURCE_ACCESS"

    # Read
    resp_read = client.get(f"/messages/batch/{b1_id}", headers=trainer2_headers)
    assert resp_read.status_code == 403
    assert resp_read.json()["error"]["code"] == "FORBIDDEN_RESOURCE_ACCESS"


def test_admin_gets_403_on_batch_channel(client, admin_headers, messaging_context_v2):
    """Admins receive 403 FORBIDDEN_ROLE on batch post and read."""
    b1_id = messaging_context_v2["b1_id"]

    resp_post = client.post(
        "/messages",
        json={"channel": "batch", "batch_id": b1_id, "body": "Admin message to batch"},
        headers=admin_headers
    )
    assert resp_post.status_code == 403
    assert resp_post.json()["error"]["code"] == "FORBIDDEN_ROLE"

    resp_read = client.get(f"/messages/batch/{b1_id}", headers=admin_headers)
    assert resp_read.status_code == 403
    assert resp_read.json()["error"]["code"] == "FORBIDDEN_ROLE"


# ============================================================================
# 2. PRIVATE MESSAGING RULES
# ============================================================================

def test_private_message_end_to_end(client, trainee_headers, messaging_context_v2, db_session):
    """Trainee can send private message to same-batch peer; audit row logged without body."""
    peer_id = messaging_context_v2["trainee2_user_id"]

    resp = client.post(
        "/messages",
        json={"channel": "private", "recipient_id": peer_id, "body": "Private peer note"},
        headers=trainee_headers
    )
    assert resp.status_code == 201
    msg_data = resp.json()
    assert msg_data["channel"] == "private"
    assert msg_data["batch_id"] is None
    assert msg_data["recipient_id"] == peer_id

    # Verify audit row
    audit_entry = (
        db_session.query(AuditLog)
        .filter(
            AuditLog.action == "create",
            AuditLog.entity_type == "message",
            AuditLog.entity_id == msg_data["id"]
        )
        .first()
    )
    assert audit_entry is not None
    assert audit_entry.actor_id == 11
    assert audit_entry.after["channel"] == "private"
    assert audit_entry.after["recipient_id"] == peer_id
    assert "body" not in audit_entry.after

    # Read thread via /messages/private/{user_id}
    resp_thread = client.get(f"/messages/private/{peer_id}", headers=trainee_headers)
    assert resp_thread.status_code == 200
    items = resp_thread.json()["items"]
    assert any(m["id"] == msg_data["id"] for m in items)


def test_private_message_restrictions(client, trainee_headers, trainer_headers, admin_headers, messaging_context_v2):
    """Verifies existing participant restrictions remain intact."""
    # Trainee to unassigned trainer -> 403
    r1 = client.post(
        "/messages",
        json={"channel": "private", "recipient_id": messaging_context_v2["trainer2_id"], "body": "Hi"},
        headers=trainee_headers
    )
    assert r1.status_code == 403

    # Trainee to batch 2 trainee -> 403
    r2 = client.post(
        "/messages",
        json={"channel": "private", "recipient_id": messaging_context_v2["trainee3_user_id"], "body": "Hi"},
        headers=trainee_headers
    )
    assert r2.status_code == 403

    # Trainer to trainer -> 403
    r3 = client.post(
        "/messages",
        json={"channel": "private", "recipient_id": messaging_context_v2["trainer2_id"], "body": "Hi"},
        headers=trainer_headers
    )
    assert r3.status_code == 403
    assert r3.json()["error"]["code"] == "FORBIDDEN_ROLE"

    # Send to admin -> 422 INVALID_RECIPIENT
    r4 = client.post(
        "/messages",
        json={"channel": "private", "recipient_id": 9, "body": "Hi"},
        headers=trainee_headers
    )
    assert r4.status_code == 422
    assert r4.json()["error"]["code"] == "INVALID_RECIPIENT"

    # Admin sending -> 403 FORBIDDEN_ROLE
    r5 = client.post(
        "/messages",
        json={"channel": "private", "recipient_id": 11, "body": "Hi"},
        headers=admin_headers
    )
    assert r5.status_code == 403
    assert r5.json()["error"]["code"] == "FORBIDDEN_ROLE"


# ============================================================================
# 3. ATTACHMENT VALIDATION AND PERMISSION TESTS
# ============================================================================

def test_pdf_attachment_accepted_and_downloadable(client, trainee_headers, trainer_headers, messaging_context_v2):
    """PDF with real magic bytes is accepted and can be downloaded by authorized recipient."""
    trainer_id = messaging_context_v2["trainer1_id"]

    # 1. Create private message
    msg_resp = client.post(
        "/messages",
        json={"channel": "private", "recipient_id": trainer_id, "body": "Report attached"},
        headers=trainee_headers
    )
    assert msg_resp.status_code == 201
    msg_id = msg_resp.json()["id"]

    # 2. Upload valid PDF
    pdf_bytes = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF"
    upload_resp = client.post(
        f"/messages/{msg_id}/attachments",
        files={"file": ("report.pdf", io.BytesIO(pdf_bytes), "application/pdf")},
        headers=trainee_headers
    )
    assert upload_resp.status_code == 201
    attach_data = upload_resp.json()
    assert attach_data["original_filename"] == "report.pdf"
    assert "stored_path" not in attach_data
    attach_id = attach_data["id"]

    # 3. Trainer downloads attachment
    dl_resp = client.get(f"/messages/attachments/{attach_id}", headers=trainer_headers)
    assert dl_resp.status_code == 200
    assert dl_resp.content == pdf_bytes
    assert "attachment" in dl_resp.headers.get("content-disposition", "")
    assert "report.pdf" in dl_resp.headers.get("content-disposition", "")


def test_fake_pdf_rejected_with_invalid_file_type(client, trainee_headers, messaging_context_v2):
    """File named .pdf but containing plain text is rejected with 422 INVALID_FILE_TYPE."""
    trainer_id = messaging_context_v2["trainer1_id"]

    msg_resp = client.post(
        "/messages",
        json={"channel": "private", "recipient_id": trainer_id, "body": "Fake pdf test"},
        headers=trainee_headers
    )
    assert msg_resp.status_code == 201
    msg_id = msg_resp.json()["id"]

    fake_pdf = b"This is plain text pretending to be a PDF file."
    upload_resp = client.post(
        f"/messages/{msg_id}/attachments",
        files={"file": ("fake.pdf", io.BytesIO(fake_pdf), "application/pdf")},
        headers=trainee_headers
    )
    assert upload_resp.status_code == 422
    assert upload_resp.json()["error"]["code"] == "INVALID_FILE_TYPE"


def test_oversized_attachment_rejected(client, trainee_headers, messaging_context_v2):
    """File over 5 MB is rejected with 422 FILE_TOO_LARGE."""
    trainer_id = messaging_context_v2["trainer1_id"]

    msg_resp = client.post(
        "/messages",
        json={"channel": "private", "recipient_id": trainer_id, "body": "Large file test"},
        headers=trainee_headers
    )
    assert msg_resp.status_code == 201
    msg_id = msg_resp.json()["id"]

    # 5 MB + 1 byte
    oversized = b"%PDF-1.4 " + b"0" * (5 * 1024 * 1024)
    upload_resp = client.post(
        f"/messages/{msg_id}/attachments",
        files={"file": ("large.pdf", io.BytesIO(oversized), "application/pdf")},
        headers=trainee_headers
    )
    assert upload_resp.status_code == 422
    assert upload_resp.json()["error"]["code"] == "FILE_TOO_LARGE"


def test_max_three_attachments_limit(client, trainee_headers, messaging_context_v2):
    """A message can accept at most 3 attachments; fourth is rejected."""
    trainer_id = messaging_context_v2["trainer1_id"]

    msg_resp = client.post(
        "/messages",
        json={"channel": "private", "recipient_id": trainer_id, "body": "Three attachments test"},
        headers=trainee_headers
    )
    assert msg_resp.status_code == 201
    msg_id = msg_resp.json()["id"]

    png_bytes = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"

    # Upload 3 attachments
    for i in range(1, 4):
        res = client.post(
            f"/messages/{msg_id}/attachments",
            files={"file": (f"img_{i}.png", io.BytesIO(png_bytes), "image/png")},
            headers=trainee_headers
        )
        assert res.status_code == 201

    # Fourth attachment rejected
    res_fourth = client.post(
        f"/messages/{msg_id}/attachments",
        files={"file": ("img_4.png", io.BytesIO(png_bytes), "image/png")},
        headers=trainee_headers
    )
    assert res_fourth.status_code == 422 or res_fourth.status_code == 400


def test_unauthorized_user_cannot_download_private_attachment(client, trainee_headers, trainee3_headers, messaging_context_v2):
    """A trainee not part of a private thread receives 403 on attachment download."""
    peer_id = messaging_context_v2["trainee2_user_id"]

    msg_resp = client.post(
        "/messages",
        json={"channel": "private", "recipient_id": peer_id, "body": "Confidential file"},
        headers=trainee_headers
    )
    msg_id = msg_resp.json()["id"]

    pdf_bytes = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF"
    upload_resp = client.post(
        f"/messages/{msg_id}/attachments",
        files={"file": ("confidential.pdf", io.BytesIO(pdf_bytes), "application/pdf")},
        headers=trainee_headers
    )
    attach_id = upload_resp.json()["id"]

    # Trainee 3 from batch 2 attempts download
    dl_resp = client.get(f"/messages/attachments/{attach_id}", headers=trainee3_headers)
    assert dl_resp.status_code == 403
    assert dl_resp.json()["error"]["code"] == "FORBIDDEN_RESOURCE_ACCESS"


def test_batch_member_can_download_batch_attachment(client, trainee_headers, trainer_headers, messaging_context_v2):
    """Any member of the batch can download an attachment posted to the batch channel."""
    b1_id = messaging_context_v2["b1_id"]

    # Trainee posts batch message with attachment
    msg_resp = client.post(
        "/messages",
        json={"channel": "batch", "batch_id": b1_id, "body": "Batch syllabus"},
        headers=trainee_headers
    )
    msg_id = msg_resp.json()["id"]

    pdf_bytes = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF"
    upload_resp = client.post(
        f"/messages/{msg_id}/attachments",
        files={"file": ("syllabus.pdf", io.BytesIO(pdf_bytes), "application/pdf")},
        headers=trainee_headers
    )
    attach_id = upload_resp.json()["id"]

    # Batch trainer downloads it -> 200
    dl_resp = client.get(f"/messages/attachments/{attach_id}", headers=trainer_headers)
    assert dl_resp.status_code == 200
    assert dl_resp.content == pdf_bytes


def test_stored_path_never_in_responses(client, trainee_headers, messaging_context_v2):
    """Responses must never expose stored_path in any endpoint payload."""
    peer_id = messaging_context_v2["trainee2_user_id"]

    msg_resp = client.post(
        "/messages",
        json={"channel": "private", "recipient_id": peer_id, "body": "Inspection check"},
        headers=trainee_headers
    )
    msg_id = msg_resp.json()["id"]

    pdf_bytes = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF"
    upload_resp = client.post(
        f"/messages/{msg_id}/attachments",
        files={"file": ("check.pdf", io.BytesIO(pdf_bytes), "application/pdf")},
        headers=trainee_headers
    )
    assert "stored_path" not in upload_resp.text

    # Fetch thread
    thread_resp = client.get(f"/messages/private/{peer_id}", headers=trainee_headers)
    assert "stored_path" not in thread_resp.text


# ============================================================================
# 4. DATABASE CHECK CONSTRAINT TEST
# ============================================================================

def test_database_check_constraint_channel_batch_with_recipient(db_session):
    """Inserting a message with channel='batch' and recipient_id set violates check constraint."""
    invalid_msg = Message(
        channel="batch",
        batch_id=1,
        sender_id=11,
        recipient_id=12,  # Invalid: batch message must have recipient_id NULL
        body="Violating check constraint",
        created_at=datetime.now(timezone.utc)
    )
    db_session.add(invalid_msg)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_message_response_includes_sender_role(client, trainee_headers, trainer_headers, messaging_context_v2):
    """Sent and fetched messages expose sender_role ('trainee' or 'trainer') for UI badges."""
    peer_id = messaging_context_v2["trainee2_user_id"]
    trainer_id = messaging_context_v2["trainer1_id"]

    res_peer = client.post(
        "/messages",
        json={"channel": "private", "recipient_id": peer_id, "body": "Peer role check"},
        headers=trainee_headers
    )
    assert res_peer.status_code == 201
    assert res_peer.json()["sender_role"] == "trainee"

    res_trainer = client.post(
        "/messages",
        json={"channel": "batch", "batch_id": messaging_context_v2["b1_id"], "body": "Trainer batch check"},
        headers=trainer_headers
    )
    assert res_trainer.status_code == 201
    assert res_trainer.json()["sender_role"] == "trainer"


def test_upgrade_existing_db_rebuilds_legacy_notnull_messages(tmp_path):
    """Legacy SQLite messages tables with NOT NULL recipient_id are rebuilt cleanly preserving rows."""
    from sqlalchemy import create_engine, text
    from scripts.upgrade_existing_db import upgrade_existing_database

    db_file = tmp_path / "legacy_messages.db"
    test_engine = create_engine(f"sqlite:///{db_file}", connect_args={"check_same_thread": False})
    with test_engine.begin() as conn:
        conn.execute(text("CREATE TABLE batches (id INTEGER PRIMARY KEY, name VARCHAR(100) NOT NULL UNIQUE, start_date DATE NOT NULL, end_date DATE NOT NULL)"))
        conn.execute(text("CREATE TABLE users (id INTEGER PRIMARY KEY, email VARCHAR(255) NOT NULL UNIQUE, password_hash VARCHAR(255) NOT NULL, role VARCHAR(20) NOT NULL, is_active BOOLEAN NOT NULL DEFAULT 1, trainee_id INTEGER)"))
        conn.execute(text("INSERT INTO batches VALUES (1, 'Batch A', '2026-01-01', '2026-06-01')"))
        conn.execute(text("INSERT INTO users VALUES (1, 'a@example.com', 'x', 'trainee', 1, NULL)"))
        conn.execute(text("INSERT INTO users VALUES (2, 'b@example.com', 'x', 'trainee', 1, NULL)"))
        conn.execute(text(
            "CREATE TABLE messages ("
            "id INTEGER NOT NULL PRIMARY KEY, "
            "sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, "
            "recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, "
            "body VARCHAR(500) NOT NULL, "
            "created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "
            "read_at DATETIME, "
            "channel VARCHAR(20) NOT NULL DEFAULT 'private', "
            "batch_id INTEGER REFERENCES batches(id) ON DELETE CASCADE)"
        ))
        conn.execute(text("INSERT INTO messages (id, sender_id, recipient_id, body, channel) VALUES (1, 1, 2, 'Legacy note', 'private')"))

    upgrade_existing_database(engine=test_engine)

    with test_engine.begin() as conn:
        cols = {row[1]: row[3] for row in conn.exec_driver_sql("PRAGMA table_info(messages)").fetchall()}
        assert cols["recipient_id"] == 0  # Nullable now
        assert cols["body"] == 0
        # Batch message with NULL recipient_id must succeed and preserve legacy private message
        conn.execute(text("INSERT INTO messages (channel, sender_id, recipient_id, batch_id, body) VALUES ('batch', 1, NULL, 1, 'Cohort hello')"))
        rows = conn.execute(text("SELECT channel, body FROM messages ORDER BY id")).fetchall()
        assert rows == [("private", "Legacy note"), ("batch", "Cohort hello")]
    test_engine.dispose()
