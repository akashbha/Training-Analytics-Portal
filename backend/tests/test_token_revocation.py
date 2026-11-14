"""Test suite verifying Sprint 1C: Server-Side Token Revocation and WebSocket Lifecycle Hardening.
Tests JTI claims, explicit logout revocation, password change universal invalidation,
admin deactivation/role change invalidation, single-use WebSocket tickets, cohort-isolated broadcasts,
and instant WebSocket severance upon revocation.
"""

import io
import time
from datetime import date, datetime, timezone, timedelta
import pytest
from starlette.websockets import WebSocketDisconnect

from app.core.security import create_access_token, decode_access_token, get_password_hash
from app.core.ws_ticket import ws_tickets
from app.models.user import User
from app.models.trainee import Trainee
from app.models.batch import Batch
from app.models.module import Module
from app.models.batch_trainer import BatchTrainer
from app.models.revoked_token import RevokedToken

@pytest.fixture
def revocation_dataset(db_session):
    """Creates isolated batches, trainers, trainees, and users for revocation and scoping tests."""
    from app.models.session import Session as AssessmentSession

    def _cleanup():
        try:
            trainee_ids = [
                t.id for t in db_session.query(Trainee).filter(
                    Trainee.email.in_(["alice.alpha@test.internal", "bob.beta@test.internal"])
                ).all()
            ]
            if trainee_ids:
                db_session.query(AssessmentSession).filter(
                    AssessmentSession.trainee_id.in_(trainee_ids)
                ).delete(synchronize_session=False)

            batch_ids = [
                b.id for b in db_session.query(Batch).filter(
                    Batch.name.in_(["Cohort Alpha", "Cohort Beta"])
                ).all()
            ]
            if batch_ids:
                db_session.query(BatchTrainer).filter(
                    BatchTrainer.batch_id.in_(batch_ids)
                ).delete(synchronize_session=False)

            db_session.query(User).filter(
                User.email.in_([
                    "admin.rev@test.internal",
                    "trainer.alpha@test.internal",
                    "trainer.beta@test.internal",
                    "alice.user@test.internal"
                ])
            ).delete(synchronize_session=False)

            db_session.query(Trainee).filter(
                Trainee.email.in_(["alice.alpha@test.internal", "bob.beta@test.internal"])
            ).delete(synchronize_session=False)

            db_session.query(Module).filter(
                Module.name == "Security Hardening"
            ).delete(synchronize_session=False)

            if batch_ids:
                db_session.query(Batch).filter(
                    Batch.id.in_(batch_ids)
                ).delete(synchronize_session=False)

            db_session.query(RevokedToken).delete(synchronize_session=False)
            db_session.commit()
        except Exception:
            db_session.rollback()

    # Pre-clean
    _cleanup()

    batch_a = Batch(name="Cohort Alpha", start_date=date(2026, 1, 1), end_date=date(2026, 6, 1))
    batch_b = Batch(name="Cohort Beta", start_date=date(2026, 1, 1), end_date=date(2026, 6, 1))
    db_session.add_all([batch_a, batch_b])
    db_session.flush()

    mod = Module(name="Security Hardening", max_score=100.0)
    db_session.add(mod)
    db_session.flush()

    t_alice = Trainee(name="Alice Alpha", email="alice.alpha@test.internal", batch_id=batch_a.id)
    t_bob = Trainee(name="Bob Beta", email="bob.beta@test.internal", batch_id=batch_b.id)
    db_session.add_all([t_alice, t_bob])
    db_session.flush()

    u_admin = User(
        email="admin.rev@test.internal",
        password_hash=get_password_hash("AdminPass123!"),
        role="admin"
    )
    u_trainer_a = User(
        email="trainer.alpha@test.internal",
        password_hash=get_password_hash("TrainerA@123"),
        role="trainer"
    )
    u_trainer_b = User(
        email="trainer.beta@test.internal",
        password_hash=get_password_hash("TrainerB@123"),
        role="trainer"
    )
    u_alice = User(
        email="alice.user@test.internal",
        password_hash=get_password_hash("Alice@12345"),
        role="trainee",
        trainee_id=t_alice.id
    )
    db_session.add_all([u_admin, u_trainer_a, u_trainer_b, u_alice])
    db_session.flush()

    bt_a = BatchTrainer(batch_id=batch_a.id, trainer_id=u_trainer_a.id)
    bt_b = BatchTrainer(batch_id=batch_b.id, trainer_id=u_trainer_b.id)
    db_session.add_all([bt_a, bt_b])
    db_session.commit()

    yield {
        "batch_a": batch_a,
        "batch_b": batch_b,
        "mod": mod,
        "t_alice": t_alice,
        "t_bob": t_bob,
        "admin": u_admin,
        "trainer_a": u_trainer_a,
        "trainer_b": u_trainer_b,
        "alice": u_alice,
    }

    # Post-clean
    _cleanup()


def test_jwt_contains_jti_and_iat():
    """Verifies that create_access_token automatically injects UUID4 jti and integer iat claims."""
    token = create_access_token(data={"sub": "42", "role": "trainee"})
    payload = decode_access_token(token)
    assert "jti" in payload
    assert isinstance(payload["jti"], str)
    assert len(payload["jti"]) >= 32
    assert "iat" in payload
    assert isinstance(payload["iat"], (int, float))


def test_logout_revokes_token_jti(client, revocation_dataset):
    """Verifies that POST /auth/logout revokes the token and blocks subsequent access with 401."""
    alice = revocation_dataset["alice"]
    token = create_access_token(data={"sub": str(alice.id), "role": "trainee", "trainee_id": alice.trainee_id})
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Verify token works
    me_res = client.get("/auth/me", headers=headers)
    assert me_res.status_code == 200
    assert me_res.json()["email"] == "alice.user@test.internal"

    # 2. Call Logout
    logout_res = client.post("/auth/logout", headers=headers)
    assert logout_res.status_code == 200
    assert logout_res.json()["message"] == "Logged out successfully"

    # 3. Verify token is now blocked
    subsequent_res = client.get("/auth/me", headers=headers)
    assert subsequent_res.status_code == 401
    assert subsequent_res.json()["error"]["code"] == "TOKEN_REVOKED"


def test_change_password_invalidates_prior_tokens(client, revocation_dataset):
    """Verifies that changing password revokes older active tokens and allows new credentials."""
    alice = revocation_dataset["alice"]
    old_token = create_access_token(data={"sub": str(alice.id), "role": "trainee", "trainee_id": alice.trainee_id})
    old_headers = {"Authorization": f"Bearer {old_token}"}

    # 1. Change password
    change_res = client.post(
        "/auth/change-password",
        json={"current_password": "Alice@12345", "new_password": "NewSecretPass999!"},
        headers=old_headers
    )
    assert change_res.status_code == 200

    # 2. Old token should now be rejected
    rejected_res = client.get("/auth/me", headers=old_headers)
    assert rejected_res.status_code == 401
    assert rejected_res.json()["error"]["code"] == "TOKEN_REVOKED"

    # 3. Newly issued token after password change works
    new_token = create_access_token(data={"sub": str(alice.id), "role": "trainee", "trainee_id": alice.trainee_id})
    new_headers = {"Authorization": f"Bearer {new_token}"}
    assert client.get("/auth/me", headers=new_headers).status_code == 200


def test_admin_deactivation_revokes_active_tokens(client, revocation_dataset):
    """Verifies that deactivating a user via Admin API immediately blocks their active tokens."""
    admin = revocation_dataset["admin"]
    alice = revocation_dataset["alice"]

    admin_token = create_access_token(data={"sub": str(admin.id), "role": "admin"})
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    alice_token = create_access_token(data={"sub": str(alice.id), "role": "trainee", "trainee_id": alice.trainee_id})
    alice_headers = {"Authorization": f"Bearer {alice_token}"}

    # Alice token works initially
    assert client.get("/auth/me", headers=alice_headers).status_code == 200

    # Admin deactivates Alice
    deact_res = client.patch(f"/admin/users/{alice.id}", json={"is_active": False}, headers=admin_headers)
    assert deact_res.status_code == 200
    assert deact_res.json()["is_active"] is False

    # Alice token is immediately rejected
    blocked_res = client.get("/auth/me", headers=alice_headers)
    assert blocked_res.status_code == 401
    assert blocked_res.json()["error"]["code"] in ("TOKEN_REVOKED", "USER_INACTIVE")


def test_admin_role_change_revokes_old_role_tokens(client, revocation_dataset):
    """Verifies that changing a user's role revokes existing tokens to prevent role spoofing."""
    admin = revocation_dataset["admin"]
    trainer = revocation_dataset["trainer_a"]

    admin_token = create_access_token(data={"sub": str(admin.id), "role": "admin"})
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    trainer_token = create_access_token(data={"sub": str(trainer.id), "role": "trainer"})
    trainer_headers = {"Authorization": f"Bearer {trainer_token}"}

    # Trainer token works on trainer-only route
    assert client.get("/auth/trainer-only-ping", headers=trainer_headers).status_code == 200

    # Admin demotes trainer to trainee
    role_res = client.patch(f"/admin/users/{trainer.id}", json={"role": "trainee"}, headers=admin_headers)
    assert role_res.status_code == 200
    assert role_res.json()["role"] == "trainee"

    # Old trainer token with "role": "trainer" is revoked
    check_res = client.get("/auth/trainer-only-ping", headers=trainer_headers)
    assert check_res.status_code == 401
    assert check_res.json()["error"]["code"] == "TOKEN_REVOKED"


def test_websocket_ticket_issuance_and_single_use(client, revocation_dataset):
    """Verifies POST /auth/ws-ticket issues short-lived nonce and consumes atomically on handshake."""
    alice = revocation_dataset["alice"]
    alice_token = create_access_token(data={"sub": str(alice.id), "role": "trainee", "trainee_id": alice.trainee_id})
    alice_headers = {"Authorization": f"Bearer {alice_token}"}

    # 1. Issue ticket
    ticket_res = client.post("/auth/ws-ticket", headers=alice_headers)
    assert ticket_res.status_code == 200
    ticket_data = ticket_res.json()
    assert "ticket" in ticket_data
    assert ticket_data["expires_in"] == 60
    ticket = ticket_data["ticket"]

    # 2. First connection with ticket succeeds
    with client.websocket_connect(f"/ws?ticket={ticket}") as ws:
        pass

    # 3. Second connection with the SAME ticket fails with 4401 (single-use consumed!)
    with pytest.raises(WebSocketDisconnect) as exc:
        with client.websocket_connect(f"/ws?ticket={ticket}"):
            pass
    assert exc.value.code == 4401


def test_websocket_invalid_or_expired_ticket_rejected(client):
    """Verifies that non-existent or expired tickets are rejected before WebSocket accept with 4401."""
    # 1. Non-existent ticket
    with pytest.raises(WebSocketDisconnect) as exc_fake:
        with client.websocket_connect("/ws?ticket=wst_fake_nonexistent_token_123"):
            pass
    assert exc_fake.value.code == 4401

    # 2. Artificially expired ticket
    expired_ticket = ws_tickets.create_ticket(user_id=999, role="trainee", trainee_id=None)
    ws_tickets._tickets[expired_ticket]["expires_at"] = time.time() - 10.0

    with pytest.raises(WebSocketDisconnect) as exc_exp:
        with client.websocket_connect(f"/ws?ticket={expired_ticket}"):
            pass
    assert exc_exp.value.code == 4401


def test_websocket_cohort_scoping_prevents_cross_cohort_leak(client, revocation_dataset):
    """Verifies that Trainer A (assigned to Cohort A) does NOT receive events for Cohort B."""
    trainer_a = revocation_dataset["trainer_a"]
    trainer_b = revocation_dataset["trainer_b"]
    t_alice = revocation_dataset["t_alice"]
    t_bob = revocation_dataset["t_bob"]
    mod = revocation_dataset["mod"]

    token_a = create_access_token(data={"sub": str(trainer_a.id), "role": "trainer"})
    token_b = create_access_token(data={"sub": str(trainer_b.id), "role": "trainer"})
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # Connect Trainer A
    with client.websocket_connect(f"/ws?token={token_a}") as ws_trainer_a:
        # Connect Trainer B
        with client.websocket_connect(f"/ws?token={token_b}") as ws_trainer_b:
            # Post a session in Cohort B (for Bob)
            post_res = client.post(
                "/sessions",
                json={
                    "trainee_id": t_bob.id,
                    "module_id": mod.id,
                    "score": 95.0,
                    "errors": 0,
                    "time_seconds": 900
                },
                headers=headers_b
            )
            assert post_res.status_code == 201

            # Trainer B MUST receive the Cohort B event
            event_b = ws_trainer_b.receive_json()
            assert event_b["type"] == "session_created"
            assert event_b["trainee_id"] == t_bob.id
            assert event_b["batch_id"] == revocation_dataset["batch_b"].id

            # Now post a session in Cohort A (for Alice) using Trainer A
            headers_a = {"Authorization": f"Bearer {token_a}"}
            post_res_a = client.post(
                "/sessions",
                json={
                    "trainee_id": t_alice.id,
                    "module_id": mod.id,
                    "score": 88.0,
                    "errors": 1,
                    "time_seconds": 1050
                },
                headers=headers_a
            )
            assert post_res_a.status_code == 201

            # Trainer A's FIRST received event must be for Alice in Cohort A!
            # If Bob's Cohort B event had leaked to Trainer A, it would have been received first.
            event_a = ws_trainer_a.receive_json()
            assert event_a["type"] == "session_created"
            assert event_a["trainee_id"] == t_alice.id
            assert event_a["batch_id"] == revocation_dataset["batch_a"].id


def test_revocation_severs_live_websocket(client, revocation_dataset):
    """Verifies that calling logout actively disconnects an open WebSocket connection with code 4401."""
    alice = revocation_dataset["alice"]
    token = create_access_token(data={"sub": str(alice.id), "role": "trainee", "trainee_id": alice.trainee_id})
    headers = {"Authorization": f"Bearer {token}"}

    # Open WebSocket
    with client.websocket_connect(f"/ws?token={token}") as ws:
        # Call logout via HTTP in the background
        logout_res = client.post("/auth/logout", headers=headers)
        assert logout_res.status_code == 200

        # The server severs the socket connection
        with pytest.raises(WebSocketDisconnect) as exc:
            ws.receive_text()
        assert exc.value.code == 4401
