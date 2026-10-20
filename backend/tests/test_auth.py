"""Integration tests covering authentication, authorization, token expiration, and rate limiting.
Verifies all role constraints, ownership scoping, and brute-force protection requirements.
"""

from datetime import timedelta
from app.core.security import create_access_token

def test_login_success(client):
    """Verifies that valid credentials return a 200 response with JWT and user identity."""
    response = client.post(
        "/auth/login",
        json={"email": "test_trainer@example.com", "password": "Trainer@123"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "test_trainer@example.com"
    assert data["user"]["role"] == "trainer"
    assert data["user"]["trainee_id"] is None

def test_login_wrong_password(client):
    """Verifies that an incorrect password produces a 401 error with generic message."""
    response = client.post(
        "/auth/login",
        json={"email": "test_trainer@example.com", "password": "WrongPassword999"}
    )
    assert response.status_code == 401
    data = response.json()
    assert "error" in data
    assert data["error"]["code"] == "INVALID_CREDENTIALS"
    assert data["error"]["message"] == "Invalid email or password"

def test_login_unknown_email(client):
    """Verifies that non-existent emails return the identical 401 message to prevent enumeration."""
    response = client.post(
        "/auth/login",
        json={"email": "nonexistent.user@example.com", "password": "AnyPassword123"}
    )
    assert response.status_code == 401
    data = response.json()
    assert "error" in data
    assert data["error"]["code"] == "INVALID_CREDENTIALS"
    assert data["error"]["message"] == "Invalid email or password"

def test_expired_token(client):
    """Verifies that a token generated with a negative expiry returns a 401 error."""
    expired_token = create_access_token(
        data={"sub": "10", "role": "trainer", "trainee_id": None},
        expires_delta=timedelta(minutes=-10)
    )
    response = client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {expired_token}"}
    )
    assert response.status_code == 401
    data = response.json()
    assert "error" in data
    assert data["error"]["code"] == "INVALID_OR_EXPIRED_TOKEN"
    assert "WWW-Authenticate" in response.headers

def test_trainer_only_route_forbidden_for_trainee(client):
    """Verifies that a trainee user attempting to access a trainer route is blocked with 403."""
    trainee_token = create_access_token(
        data={"sub": "11", "role": "trainee", "trainee_id": 1}
    )
    response = client.get(
        "/auth/trainer-only-ping",
        headers={"Authorization": f"Bearer {trainee_token}"}
    )
    assert response.status_code == 403
    data = response.json()
    assert "error" in data
    assert data["error"]["code"] == "FORBIDDEN_TRAINER_ONLY"

def test_trainee_reading_another_trainees_data_forbidden(client):
    """Verifies that trainee 1 cannot view trainee 2's data and receives a 403 response."""
    trainee1_token = create_access_token(
        data={"sub": "11", "role": "trainee", "trainee_id": 1}
    )
    response = client.get(
        "/auth/trainee/2/data",
        headers={"Authorization": f"Bearer {trainee1_token}"}
    )
    assert response.status_code == 403
    data = response.json()
    assert "error" in data
    assert data["error"]["code"] == "FORBIDDEN_RESOURCE_ACCESS"

def test_trainee_reading_own_data_success(client):
    """Verifies that trainee 1 can successfully view their own data (HTTP 200)."""
    trainee1_token = create_access_token(
        data={"sub": "11", "role": "trainee", "trainee_id": 1}
    )
    response = client.get(
        "/auth/trainee/1/data",
        headers={"Authorization": f"Bearer {trainee1_token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["trainee_id"] == 1

def test_trainer_can_read_any_trainee_data(client):
    """Verifies that trainers possess global authorization across any trainee profile."""
    trainer_token = create_access_token(
        data={"sub": "10", "role": "trainer", "trainee_id": None}
    )
    response = client.get(
        "/auth/trainee/2/data",
        headers={"Authorization": f"Bearer {trainer_token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["trainee_id"] == 2

def test_login_rate_limit(client):
    """Verifies that exceeding 5 login attempts per minute triggers a 429 Too Many Requests response."""
    # Send 5 attempts (may fail authentication, but accepted by rate limiter)
    for _ in range(5):
        client.post(
            "/auth/login",
            json={"email": "rate_limit_test@example.com", "password": "WrongPassword"}
        )

    # 6th attempt must be rejected by SlowAPI with HTTP 429
    sixth_response = client.post(
        "/auth/login",
        json={"email": "rate_limit_test@example.com", "password": "WrongPassword"}
    )
    assert sixth_response.status_code == 429
    data = sixth_response.json()
    assert "error" in data
    assert data["error"]["code"] == "RATE_LIMIT_EXCEEDED"
