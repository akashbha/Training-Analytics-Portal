"""Pytest fixtures and isolated database setup for test runs.
Provides in-memory SQLite database, seeded test credentials, and configured TestClient instances.
"""

import pytest
from datetime import date
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.core.deps import get_db
from app.core.security import get_password_hash
from app.models.batch import Batch
from app.models.trainee import Trainee
from app.models.user import User
from app.main import app

# Isolated in-memory SQLite database with single-connection StaticPool
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    """Creates database schema and test fixtures once for the entire test session."""
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        # Seed test cohort
        batch = Batch(name="Test Batch 101", start_date=date(2026, 1, 1), end_date=date(2026, 6, 1))
        db.add(batch)
        db.flush()

        # Seed two test trainees
        trainee1 = Trainee(id=1, name="Alice Walker", email="alice.walker@test.internal", batch_id=batch.id)
        trainee2 = Trainee(id=2, name="Bob Davis", email="bob.davis@test.internal", batch_id=batch.id)
        db.add_all([trainee1, trainee2])
        db.flush()

        # Seed users
        admin_user = User(
            id=9,
            email="test_admin@example.com",
            password_hash=get_password_hash("Admin@123"),
            role="admin",
            is_active=True,
            trainee_id=None
        )
        trainer_user = User(
            id=10,
            email="test_trainer@example.com",
            password_hash=get_password_hash("Trainer@123"),
            role="trainer",
            is_active=True,
            trainee_id=None
        )
        trainee1_user = User(
            id=11,
            email="test_trainee1@example.com",
            password_hash=get_password_hash("Trainee@123"),
            role="trainee",
            is_active=True,
            trainee_id=1
        )
        trainee2_user = User(
            id=12,
            email="test_trainee2@example.com",
            password_hash=get_password_hash("Trainee@123"),
            role="trainee",
            is_active=True,
            trainee_id=2
        )
        db.add_all([admin_user, trainer_user, trainee1_user, trainee2_user])
        db.commit()
    finally:
        db.close()

    yield

    Base.metadata.drop_all(bind=engine)

@pytest.fixture
def db_session():
    """Provides a fresh database session fixture for individual tests."""
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

@pytest.fixture
def client():
    """Provides a FastAPI TestClient with the dependency overridden to use the test database."""
    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()

@pytest.fixture
def admin_headers():
    from app.core.security import create_access_token
    token = create_access_token(data={"sub": "9", "role": "admin"})
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def trainer_headers():
    from app.core.security import create_access_token
    token = create_access_token(data={"sub": "10", "role": "trainer"})
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def trainee_headers():
    from app.core.security import create_access_token
    token = create_access_token(data={"sub": "11", "role": "trainee", "trainee_id": 1})
    return {"Authorization": f"Bearer {token}"}

