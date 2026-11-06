"""Integration tests for session feedback notes.
Verifies role authorization matrix, ownership scoping, character limit bounds, and audit logging.
"""

import pytest
from app.models.batch import Batch
from app.models.module import Module
from app.models.trainee import Trainee
from app.models.session import Session
from app.models.session_note import SessionNote
from app.models.audit_log import AuditLog
from app.core.security import create_access_token

@pytest.fixture
def trainee2_headers():
    token = create_access_token(data={"sub": "12", "role": "trainee", "trainee_id": 2})
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def session_for_trainee1(db_session):
    """Creates a sample module and session belonging to trainee 1 (Alice Walker)."""
    mod = db_session.query(Module).first()
    if not mod:
        mod = Module(name="Test Assessment Module", max_score=100.0)
        db_session.add(mod)
        db_session.commit()

    sess = Session(
        trainee_id=1,
        module_id=mod.id,
        score=88.5,
        errors=2,
        time_seconds=1150,
        created_by=10
    )
    db_session.add(sess)
    db_session.commit()
    db_session.refresh(sess)
    return sess

def test_trainer_can_create_session_note(client, trainer_headers, session_for_trainee1, db_session):
    """Trainer can create a feedback note on a session; writes an audit log row."""
    payload = {"text": "Great accuracy during today's debugging drill."}
    resp = client.post(
        f"/sessions/{session_for_trainee1.id}/notes",
        json=payload,
        headers=trainer_headers
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["session_id"] == session_for_trainee1.id
    assert data["author_id"] == 10
    assert data["text"] == payload["text"]
    assert "created_at" in data

    # Verify audit log was recorded
    audit_entry = (
        db_session.query(AuditLog)
        .filter(
            AuditLog.action == "create_session_note",
            AuditLog.entity_id == data["id"]
        )
        .first()
    )
    assert audit_entry is not None
    assert audit_entry.actor_id == 10
    assert audit_entry.entity_type == "session_note"

def test_trainee_cannot_create_session_note(client, trainee_headers, session_for_trainee1):
    """Trainee cannot create a feedback note (403 Forbidden)."""
    payload = {"text": "Attempted trainee feedback note."}
    resp = client.post(
        f"/sessions/{session_for_trainee1.id}/notes",
        json=payload,
        headers=trainee_headers
    )
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN_ROLE"

def test_trainee_can_read_own_session_note(client, trainer_headers, trainee_headers, session_for_trainee1):
    """Trainee can read feedback notes for their own session (200 OK)."""
    # Trainer creates note first
    client.post(
        f"/sessions/{session_for_trainee1.id}/notes",
        json={"text": "Review module section 4 for syntax tips."},
        headers=trainer_headers
    )

    # Trainee reads own notes
    resp = client.get(
        f"/sessions/{session_for_trainee1.id}/notes",
        headers=trainee_headers
    )
    assert resp.status_code == 200
    notes = resp.json()
    assert len(notes) >= 1
    assert any("Review module section 4" in n["text"] for n in notes)

def test_trainee_cannot_read_another_trainee_session_note(client, trainer_headers, trainee2_headers, session_for_trainee1):
    """Trainee cannot read another trainee's session notes (403 Forbidden)."""
    # Trainer creates note for trainee 1's session
    client.post(
        f"/sessions/{session_for_trainee1.id}/notes",
        json={"text": "Confidential trainer review notes."},
        headers=trainer_headers
    )

    # Trainee 2 attempts to read trainee 1's session notes
    resp = client.get(
        f"/sessions/{session_for_trainee1.id}/notes",
        headers=trainee2_headers
    )
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN_RESOURCE_ACCESS"

def test_session_note_text_over_300_chars_rejected(client, trainer_headers, session_for_trainee1):
    """Text over 300 characters is rejected by validation (422 Unprocessable Entity)."""
    oversized_text = "A" * 301
    resp = client.post(
        f"/sessions/{session_for_trainee1.id}/notes",
        json={"text": oversized_text},
        headers=trainer_headers
    )
    assert resp.status_code == 422

def test_admin_cannot_create_session_note(client, admin_headers, session_for_trainee1):
    """Admin cannot create a feedback note (403 Forbidden with FORBIDDEN_ROLE)."""
    payload = {"text": "Administrative note attempt."}
    resp = client.post(
        f"/sessions/{session_for_trainee1.id}/notes",
        json=payload,
        headers=admin_headers
    )
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN_ROLE"
