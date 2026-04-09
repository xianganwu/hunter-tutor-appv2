"""Tests for the auth API routes."""
import pytest
from fastapi.testclient import TestClient


def test_get_auth_unauthenticated(client: TestClient):
    """GET /api/auth returns null user when not logged in."""
    resp = client.get("/api/auth")
    assert resp.status_code == 200
    assert resp.json()["user"] is None


def test_signup_success(client: TestClient):
    """Successful signup returns user data and sets cookie."""
    resp = client.post("/api/auth", json={
        "action": "signup",
        "name": "Alice",
        "email": "alice@example.com",
        "password": "securepass123",
        "mascot_type": "penguin",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["user"]["name"] == "Alice"
    assert data["user"]["email"] == "alice@example.com"
    assert data["user"]["mascot_type"] == "penguin"
    assert not data["user"]["onboarding_complete"]
    # Cookie should be set
    assert "hunter-tutor-session" in resp.cookies


def test_signup_duplicate_email(client: TestClient):
    """Duplicate email returns 409."""
    for _ in range(2):
        resp = client.post("/api/auth", json={
            "action": "signup",
            "name": "Bob",
            "email": "bob@example.com",
            "password": "password123",
        })
    assert resp.status_code == 409
    assert "already exists" in resp.json()["detail"]


def test_signup_short_password(client: TestClient):
    """Password shorter than 6 chars returns 400."""
    resp = client.post("/api/auth", json={
        "action": "signup",
        "name": "Charlie",
        "email": "charlie@example.com",
        "password": "abc",
    })
    assert resp.status_code == 400


def test_login_success(client: TestClient):
    """Login with correct credentials returns user and sets cookie."""
    # Signup first
    client.post("/api/auth", json={
        "action": "signup",
        "name": "Diana",
        "email": "diana@example.com",
        "password": "mypassword",
    })
    # Logout
    client.post("/api/auth", json={"action": "logout"})

    # Login
    resp = client.post("/api/auth", json={
        "action": "login",
        "email": "diana@example.com",
        "password": "mypassword",
    })
    assert resp.status_code == 200
    assert resp.json()["user"]["email"] == "diana@example.com"
    assert "hunter-tutor-session" in resp.cookies


def test_login_wrong_password(client: TestClient):
    """Wrong password returns 401."""
    client.post("/api/auth", json={
        "action": "signup",
        "name": "Eve",
        "email": "eve@example.com",
        "password": "correctpass",
    })
    resp = client.post("/api/auth", json={
        "action": "login",
        "email": "eve@example.com",
        "password": "wrongpass",
    })
    assert resp.status_code == 401


def test_login_unknown_email(client: TestClient):
    """Unknown email returns 401."""
    resp = client.post("/api/auth", json={
        "action": "login",
        "email": "nobody@example.com",
        "password": "anything",
    })
    assert resp.status_code == 401


def test_logout(client: TestClient):
    """Logout clears the session cookie."""
    client.post("/api/auth", json={
        "action": "signup",
        "name": "Frank",
        "email": "frank@example.com",
        "password": "frankpass",
    })
    resp = client.post("/api/auth", json={"action": "logout"})
    assert resp.status_code == 200
    # After logout, /api/auth returns null
    resp = client.get("/api/auth")
    assert resp.json()["user"] is None


def test_get_auth_authenticated(client: TestClient):
    """GET /api/auth returns user when logged in."""
    client.post("/api/auth", json={
        "action": "signup",
        "name": "Grace",
        "email": "grace@example.com",
        "password": "gracepass",
    })
    resp = client.get("/api/auth")
    assert resp.status_code == 200
    assert resp.json()["user"]["name"] == "Grace"


def test_complete_onboarding(client: TestClient):
    """complete_onboarding sets the flag."""
    client.post("/api/auth", json={
        "action": "signup",
        "name": "Henry",
        "email": "henry@example.com",
        "password": "henrypass",
    })
    resp = client.post("/api/auth", json={"action": "complete_onboarding"})
    assert resp.status_code == 200
    assert resp.json()["success"] is True

    # Verify flag
    resp = client.get("/api/auth")
    assert resp.json()["user"]["onboarding_complete"] is True


def test_update_mascot(client: TestClient):
    """update_mascot changes the mascot type."""
    client.post("/api/auth", json={
        "action": "signup",
        "name": "Iris",
        "email": "iris@example.com",
        "password": "irispass",
    })
    resp = client.post("/api/auth", json={"action": "update_mascot", "mascot_type": "dragon"})
    assert resp.status_code == 200
    assert resp.json()["user"]["mascot_type"] == "dragon"


def test_update_mascot_invalid(client: TestClient):
    """Invalid mascot type returns 400."""
    client.post("/api/auth", json={
        "action": "signup",
        "name": "Jack",
        "email": "jack@example.com",
        "password": "jackpass",
    })
    resp = client.post("/api/auth", json={"action": "update_mascot", "mascot_type": "unicorn"})
    assert resp.status_code == 400


def test_update_mascot_name(client: TestClient):
    """update_mascot_name sets mascot name."""
    client.post("/api/auth", json={
        "action": "signup",
        "name": "Kate",
        "email": "kate@example.com",
        "password": "katepass",
    })
    resp = client.post("/api/auth", json={"action": "update_mascot_name", "mascot_name": "Sparky"})
    assert resp.status_code == 200
    assert resp.json()["user"]["mascot_name"] == "Sparky"


def test_set_parent_pin_and_reset_password(client: TestClient):
    """Set PIN and use it to reset password."""
    # Sign up
    client.post("/api/auth", json={
        "action": "signup",
        "name": "Leo",
        "email": "leo@example.com",
        "password": "originalpass",
    })
    # Set parent PIN
    resp = client.post("/api/auth", json={"action": "set_pin", "parent_pin": "1234"})
    assert resp.status_code == 200

    # Reset password using PIN
    resp = client.post("/api/auth", json={
        "action": "reset_password",
        "email": "leo@example.com",
        "parent_pin": "1234",
        "new_password": "newpassword123",
    })
    assert resp.status_code == 200

    # Verify new password works
    client.post("/api/auth", json={"action": "logout"})
    resp = client.post("/api/auth", json={
        "action": "login",
        "email": "leo@example.com",
        "password": "newpassword123",
    })
    assert resp.status_code == 200


def test_reset_password_wrong_pin(client: TestClient):
    """Wrong parent PIN returns 401."""
    client.post("/api/auth", json={
        "action": "signup",
        "name": "Mia",
        "email": "mia@example.com",
        "password": "miapass",
        "parent_pin": "5678",
    })
    resp = client.post("/api/auth", json={
        "action": "reset_password",
        "email": "mia@example.com",
        "parent_pin": "9999",
        "new_password": "newpass123",
    })
    assert resp.status_code == 401


def test_unknown_action_returns_400(client: TestClient):
    """Unknown action returns 400."""
    resp = client.post("/api/auth", json={"action": "delete_everything"})
    assert resp.status_code == 400
