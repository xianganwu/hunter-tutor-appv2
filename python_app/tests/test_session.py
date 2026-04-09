"""Tests for the session API routes."""
import pytest
from fastapi.testclient import TestClient


def _signup_and_login(client: TestClient, suffix: str = "") -> dict:
    resp = client.post("/api/auth", json={
        "action": "signup",
        "name": f"User{suffix}",
        "email": f"user{suffix}@example.com",
        "password": "password123",
    })
    assert resp.status_code == 200
    return resp.json()["user"]


def test_list_sessions_empty(client: TestClient):
    """New user has no sessions."""
    _signup_and_login(client, "s1")
    resp = client.get("/api/session")
    assert resp.status_code == 200
    assert resp.json()["sessions"] == []


def test_list_sessions_unauthenticated(client: TestClient):
    """Unauthenticated request returns 401."""
    resp = client.get("/api/session")
    assert resp.status_code == 401


def test_create_session(client: TestClient):
    """Creating a session returns session id."""
    _signup_and_login(client, "s2")
    resp = client.post("/api/session", json={
        "action": "create",
        "domain": "math_achievement",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "session" in data
    assert data["session"]["domain"] == "math_achievement"
    assert "id" in data["session"]
    assert "started_at" in data["session"]


def test_create_and_list_sessions(client: TestClient):
    """Created sessions appear in the list."""
    _signup_and_login(client, "s3")
    client.post("/api/session", json={"action": "create", "domain": "reading_comprehension"})
    client.post("/api/session", json={"action": "create", "domain": "math_achievement"})

    resp = client.get("/api/session")
    assert resp.status_code == 200
    sessions = resp.json()["sessions"]
    assert len(sessions) == 2
    domains = {s["domain"] for s in sessions}
    assert "reading_comprehension" in domains
    assert "math_achievement" in domains


def test_end_session(client: TestClient):
    """Ending a session sets ended_at."""
    _signup_and_login(client, "s4")
    create_resp = client.post("/api/session", json={"action": "create", "domain": "math_achievement"})
    session_id = create_resp.json()["session"]["id"]

    end_resp = client.post("/api/session", json={
        "action": "end",
        "session_id": session_id,
        "summary": "Great session!",
    })
    assert end_resp.status_code == 200
    data = end_resp.json()
    assert data["session"]["ended_at"] is not None
    assert data["session"]["session_summary"] == "Great session!"


def test_end_nonexistent_session(client: TestClient):
    """Ending a session that doesn't exist returns 404."""
    _signup_and_login(client, "s5")
    resp = client.post("/api/session", json={
        "action": "end",
        "session_id": "nonexistent-id",
    })
    assert resp.status_code == 404


def test_create_session_missing_domain(client: TestClient):
    """Creating a session without domain returns 400."""
    _signup_and_login(client, "s6")
    resp = client.post("/api/session", json={"action": "create", "domain": ""})
    assert resp.status_code == 400


def test_create_session_with_skills(client: TestClient):
    """Session can be created with skills_covered list."""
    _signup_and_login(client, "s7")
    resp = client.post("/api/session", json={
        "action": "create",
        "domain": "math_achievement",
        "skills_covered": ["ma_arithmetic", "ma_fractions"],
    })
    assert resp.status_code == 200


def test_session_limit_param(client: TestClient):
    """limit param is respected."""
    _signup_and_login(client, "s8")
    for i in range(5):
        client.post("/api/session", json={"action": "create", "domain": "math_achievement"})
    resp = client.get("/api/session?limit=3")
    assert len(resp.json()["sessions"]) == 3


def test_cannot_access_other_users_session(client: TestClient):
    """User cannot end another user's session."""
    # Create session as user A
    _signup_and_login(client, "s9a")
    create_resp = client.post("/api/session", json={"action": "create", "domain": "reading_comprehension"})
    session_id = create_resp.json()["session"]["id"]

    # Logout and login as user B
    client.post("/api/auth", json={"action": "logout"})
    client.post("/api/auth", json={
        "action": "signup",
        "name": "UserS9B",
        "email": "users9b@example.com",
        "password": "password123",
    })

    # Try to end user A's session
    resp = client.post("/api/session", json={
        "action": "end",
        "session_id": session_id,
    })
    assert resp.status_code == 404
