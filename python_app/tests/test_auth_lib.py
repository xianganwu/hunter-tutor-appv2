"""Tests for the auth library (password hashing and JWT)."""
import pytest
import time
from app.auth import hash_password, verify_password, create_session_token, verify_session_token


def test_hash_password_returns_string():
    hashed = hash_password("mysecretpassword")
    assert isinstance(hashed, str)
    assert len(hashed) > 0


def test_hash_password_different_hashes():
    """Same password produces different hashes (bcrypt salts)."""
    h1 = hash_password("samepassword")
    h2 = hash_password("samepassword")
    assert h1 != h2


def test_verify_password_correct():
    hashed = hash_password("correctpass")
    assert verify_password("correctpass", hashed) is True


def test_verify_password_wrong():
    hashed = hash_password("correctpass")
    assert verify_password("wrongpass", hashed) is False


def test_verify_password_empty():
    hashed = hash_password("somepass")
    assert verify_password("", hashed) is False


def test_verify_password_invalid_hash():
    """Invalid hash format returns False without raising."""
    result = verify_password("anything", "not-a-valid-hash")
    assert result is False


def test_create_session_token_returns_string():
    token = create_session_token("user-123", "Alice", "alice@example.com")
    assert isinstance(token, str)
    assert len(token) > 0


def test_verify_session_token_valid():
    token = create_session_token("user-456", "Bob", "bob@example.com")
    payload = verify_session_token(token)
    assert payload is not None
    assert payload["sub"] == "user-456"
    assert payload["name"] == "Bob"
    assert payload["email"] == "bob@example.com"


def test_verify_session_token_invalid():
    result = verify_session_token("not.a.valid.token")
    assert result is None


def test_verify_session_token_empty():
    result = verify_session_token("")
    assert result is None


def test_verify_session_token_tampered():
    """Tampered token fails verification."""
    token = create_session_token("user-789", "Carol", "carol@example.com")
    tampered = token[:-5] + "XXXXX"
    result = verify_session_token(tampered)
    assert result is None


def test_token_payload_includes_all_fields():
    token = create_session_token("student-001", "Dave", "dave@example.com")
    payload = verify_session_token(token)
    assert "sub" in payload
    assert "name" in payload
    assert "email" in payload
