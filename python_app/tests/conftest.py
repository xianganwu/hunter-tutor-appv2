"""Pytest configuration and shared fixtures."""
import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Set test environment before importing app modules
os.environ.setdefault("ANTHROPIC_API_KEY", "test-key-not-real")
os.environ.setdefault("JWT_SECRET", "test-jwt-secret-at-least-32-characters-long")
os.environ.setdefault("DATABASE_URL", "sqlite:///./test.db")

from app.database import Base, get_db
from app.config import get_settings
from main import app

# Use a separate in-memory test database
TEST_DB_URL = "sqlite:///./test.db"

test_engine = create_engine(
    TEST_DB_URL,
    connect_args={"check_same_thread": False},
)
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


def override_get_db():
    db = TestSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    """Create all tables for testing."""
    from app import models  # noqa — register models
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)
    # Clean up test db file
    if os.path.exists("./test.db"):
        os.remove("./test.db")


@pytest.fixture(autouse=True)
def clean_db():
    """Clear all data between tests."""
    yield
    db = TestSessionLocal()
    try:
        from app import models
        db.query(models.QuestionAttempt).delete()
        db.query(models.WritingSubmission).delete()
        db.query(models.TutoringSession).delete()
        db.query(models.SkillMastery).delete()
        db.query(models.UserData).delete()
        db.query(models.QuestionCache).delete()
        db.query(models.Student).delete()
        db.commit()
    finally:
        db.close()


@pytest.fixture
def client():
    """FastAPI test client with overridden DB."""
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app, raise_server_exceptions=True) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def db():
    """Direct DB session for test setup."""
    session = TestSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def registered_user(client):
    """Create and log in a test user. Returns (client_with_cookie, user_data)."""
    resp = client.post("/api/auth", json={
        "action": "signup",
        "name": "Test Student",
        "email": "test@example.com",
        "password": "password123",
    })
    assert resp.status_code == 200, resp.text
    return client, resp.json()["user"]
