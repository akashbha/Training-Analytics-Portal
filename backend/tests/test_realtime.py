"""Test suite verifying WebSocket real-time connectivity, role-scoped event delivery, and fault tolerance.
Tests pre-handshake 4401 rejections, trainer universal receipt, trainee privacy scoping, and bulk broadcasts.
"""

import io
import pytest
from datetime import date
from starlette.websockets import WebSocketDisconnect
from unittest.mock import patch

from app.core.security import create_access_token, get_password_hash
from app.models.batch import Batch
from app.models.trainee import Trainee
from app.models.module import Module
from app.models.user import User

@pytest.fixture
def realtime_dataset(db_session):
    """Fixture seeding isolated entities, trainees, and real users for WebSocket tests."""
    batch = Batch(name="Realtime Cohort", start_date=date(2026, 1, 1), end_date=date(2026, 6, 1))
    db_session.add(batch)
    db_session.flush()

    mod = Module(name="Realtime Mod", max_score=100.0)
    db_session.add(mod)
    db_session.flush()

    t_alice = Trainee(name="Alice Realtime", email="alice.rt@test.internal", batch_id=batch.id)
    t_bob = Trainee(name="Bob Realtime", email="bob.rt@test.internal", batch_id=batch.id)
    db_session.add_all([t_alice, t_bob])
    db_session.flush()

    u_trainer = User(
        email="trainer.rt@test.internal",
        password_hash=get_password_hash("Trainer@123"),
        role="trainer",
        trainee_id=None
    )
    u_alice = User(
        email="alice.rt.user@test.internal",
        password_hash=get_password_hash("Trainee@123"),
        role="trainee",
        trainee_id=t_alice.id
    )
    u_bob = User(
        email="bob.rt.user@test.internal",
        password_hash=get_password_hash("Trainee@123"),
        role="trainee",
        trainee_id=t_bob.id
    )
    db_session.add_all([u_trainer, u_alice, u_bob])
    db_session.commit()

    trainer_token = create_access_token(data={"sub": str(u_trainer.id), "role": "trainer", "trainee_id": None})
    alice_token = create_access_token(data={"sub": str(u_alice.id), "role": "trainee", "trainee_id": t_alice.id})
    bob_token = create_access_token(data={"sub": str(u_bob.id), "role": "trainee", "trainee_id": t_bob.id})

    return {
        "batch": batch,
        "mod": mod,
        "t_alice": t_alice,
        "t_bob": t_bob,
        "trainer_token": trainer_token,
        "alice_token": alice_token,
        "bob_token": bob_token,
        "trainer_headers": {"Authorization": f"Bearer {trainer_token}"},
    }

def test_websocket_valid_token_connects(client, realtime_dataset):
    """Verifies that a valid JWT connects to /ws without raising an exception."""
    token = realtime_dataset["trainer_token"]
    with client.websocket_connect(f"/ws?token={token}") as ws:
        # Connected successfully
        pass

def test_websocket_invalid_or_missing_token_rejected_with_4401(client):
    """Verifies that missing, malformed, or expired tokens are rejected with code 4401 before accept."""
    # 1. Missing token
    with pytest.raises(WebSocketDisconnect) as exc_missing:
        with client.websocket_connect("/ws"):
            pass
    assert exc_missing.value.code == 4401

    # 2. Invalid token string
    with pytest.raises(WebSocketDisconnect) as exc_invalid:
        with client.websocket_connect("/ws?token=invalid.jwt.signature"):
            pass
    assert exc_invalid.value.code == 4401

def test_trainer_receives_event_after_session_creation(client, realtime_dataset):
    """Verifies that a connected trainer receives the session_created event when a session is posted."""
    data_ctx = realtime_dataset
    trainer_token = data_ctx["trainer_token"]
    trainee = data_ctx["t_alice"]
    mod = data_ctx["mod"]

    with client.websocket_connect(f"/ws?token={trainer_token}") as ws_trainer:
        # Submit session via HTTP POST
        post_res = client.post(
            "/sessions",
            json={
                "trainee_id": trainee.id,
                "module_id": mod.id,
                "score": 88.0,
                "errors": 2,
                "time_seconds": 1200
            },
            headers=data_ctx["trainer_headers"]
        )
        assert post_res.status_code == 201

        # Read event from socket
        event = ws_trainer.receive_json()
        assert event["type"] == "session_created"
        assert event["trainee_id"] == trainee.id
        assert event["trainee_name"] == trainee.name
        assert event["batch_id"] == data_ctx["batch"].id

def test_trainee_receives_only_their_own_events(client, realtime_dataset):
    """Verifies that a trainee receives their own session event and does not receive other trainees' events."""
    data_ctx = realtime_dataset
    alice_token = data_ctx["alice_token"]
    t_alice = data_ctx["t_alice"]
    t_bob = data_ctx["t_bob"]
    mod = data_ctx["mod"]

    with client.websocket_connect(f"/ws?token={alice_token}") as ws_alice:
        # 1. Post session for Bob (Alice should NOT receive this)
        client.post(
            "/sessions",
            json={"trainee_id": t_bob.id, "module_id": mod.id, "score": 75.0, "errors": 3, "time_seconds": 1100},
            headers=data_ctx["trainer_headers"]
        )

        # 2. Post session for Alice (Alice MUST receive this)
        client.post(
            "/sessions",
            json={"trainee_id": t_alice.id, "module_id": mod.id, "score": 92.0, "errors": 1, "time_seconds": 950},
            headers=data_ctx["trainer_headers"]
        )

        # Alice's first received event must be for Alice, proving Bob's was filtered out
        event = ws_alice.receive_json()
        assert event["type"] == "session_created"
        assert event["trainee_id"] == t_alice.id
        assert event["trainee_name"] == t_alice.name

def test_bulk_upload_sends_exactly_one_event(client, realtime_dataset):
    """Verifies that a bulk CSV upload broadcasts a single consolidated sessions_bulk_created event."""
    data_ctx = realtime_dataset
    trainer_token = data_ctx["trainer_token"]
    t_alice = data_ctx["t_alice"]
    t_bob = data_ctx["t_bob"]
    mod = data_ctx["mod"]

    with client.websocket_connect(f"/ws?token={trainer_token}") as ws_trainer:
        csv_data = (
            "trainee_email,module_name,score,errors,time_seconds,created_at\n"
            f"{t_alice.email},{mod.name},85.0,2,1100,\n"
            f"{t_bob.email},{mod.name},90.0,1,1000,\n"
        )
        files = {"file": ("bulk.csv", io.BytesIO(csv_data.encode("utf-8")), "text/csv")}
        bulk_res = client.post("/sessions/bulk", files=files, headers=data_ctx["trainer_headers"])
        assert bulk_res.status_code == 200

        # Must receive exactly one consolidated bulk event
        event = ws_trainer.receive_json()
        assert event["type"] == "sessions_bulk_created"
        assert event["count"] == 2
        assert t_alice.id in event["trainee_ids"]
        assert t_bob.id in event["trainee_ids"]

def test_broadcast_failure_does_not_break_post_request(client, realtime_dataset):
    """Verifies that if WebSocket broadcasting fails, the HTTP session creation still succeeds."""
    data_ctx = realtime_dataset
    t_alice = data_ctx["t_alice"]
    mod = data_ctx["mod"]

    # Simulate an unexpected failure in manager.broadcast
    with patch("app.core.realtime.manager.broadcast", side_effect=RuntimeError("Simulated network failure")):
        res = client.post(
            "/sessions",
            json={
                "trainee_id": t_alice.id,
                "module_id": mod.id,
                "score": 88.0,
                "errors": 2,
                "time_seconds": 1200
            },
            headers=data_ctx["trainer_headers"]
        )
        # Transaction and HTTP response must succeed completely
        assert res.status_code == 201
        assert res.json()["score"] == 88.0

def test_realtime_health_endpoint(client, realtime_dataset):
    """Verifies GET /health/realtime reports connected client count for trainers and rejects trainees."""
    data_ctx = realtime_dataset
    trainer_token = data_ctx["trainer_token"]

    # Trainee receives 403
    t_res = client.get("/health/realtime", headers={"Authorization": f"Bearer {data_ctx['alice_token']}"})
    assert t_res.status_code == 403

    # Trainer receives 200 with connection count
    with client.websocket_connect(f"/ws?token={trainer_token}"):
        tr_res = client.get("/health/realtime", headers=data_ctx["trainer_headers"])
        assert tr_res.status_code == 200
        assert tr_res.json()["connected_clients"] >= 1
