"""Tests for the progress sync API routes."""
import pytest
from fastapi.testclient import TestClient


def _signup(client: TestClient, suffix: str = "") -> dict:
    resp = client.post("/api/auth", json={
        "action": "signup",
        "name": f"Prog{suffix}",
        "email": f"prog{suffix}@example.com",
        "password": "password123",
    })
    assert resp.status_code == 200
    return resp.json()["user"]


def test_get_progress_empty(client: TestClient):
    """New user has no progress."""
    _signup(client, "p1")
    resp = client.get("/api/progress")
    assert resp.status_code == 200
    data = resp.json()
    assert data["progress"] == {}
    assert data["timestamps"] == {}


def test_get_progress_unauthenticated(client: TestClient):
    """Unauthenticated request returns 401."""
    resp = client.get("/api/progress")
    assert resp.status_code == 401


def test_post_progress_unauthenticated(client: TestClient):
    """Unauthenticated POST returns 401."""
    resp = client.post("/api/progress", json={"progress": {}})
    assert resp.status_code == 401


def test_sync_progress_single_key(client: TestClient):
    """Can sync a single valid key."""
    _signup(client, "p2")
    resp = client.post("/api/progress", json={
        "progress": {
            "skill-mastery": {"rc_main_idea": 0.7}
        }
    })
    assert resp.status_code == 200
    assert resp.json()["keys_updated"] == 1


def test_sync_progress_invalid_key_filtered(client: TestClient):
    """Invalid keys are filtered out."""
    _signup(client, "p3")
    resp = client.post("/api/progress", json={
        "progress": {
            "skill-mastery": {"rc_main_idea": 0.7},
            "invalid-key-xyz": {"data": "nope"},
        }
    })
    assert resp.status_code == 200
    assert resp.json()["keys_updated"] == 1
    assert resp.json()["keys_skipped"] == 0  # invalid key filtered, not counted as skipped


def test_sync_and_retrieve_progress(client: TestClient):
    """Synced progress is retrievable."""
    _signup(client, "p4")
    payload = {"skill-mastery": {"rc_main_idea": 0.65, "ma_fractions": 0.3}}
    client.post("/api/progress", json={"progress": payload})

    resp = client.get("/api/progress")
    assert resp.status_code == 200
    progress = resp.json()["progress"]
    assert "skill-mastery" in progress
    assert progress["skill-mastery"]["rc_main_idea"] == 0.65


def test_sync_multiple_valid_keys(client: TestClient):
    """Multiple valid keys all synced."""
    _signup(client, "p5")
    resp = client.post("/api/progress", json={
        "progress": {
            "skill-mastery": {"ma_arithmetic": 0.5},
            "mistakes": [{"skill_id": "ma_fractions", "count": 3}],
            "drills": [{"skill_id": "ma_arithmetic", "score": 80}],
        }
    })
    assert resp.status_code == 200
    assert resp.json()["keys_updated"] == 3


def test_empty_payload_guard(client: TestClient):
    """Empty payload does not overwrite existing data."""
    _signup(client, "p6")
    # First sync: add real data
    client.post("/api/progress", json={
        "progress": {"skill-mastery": {"ma_arithmetic": 0.7}}
    })

    # Second sync: try to overwrite with empty
    from datetime import datetime, UTC
    past_ts = "2020-01-01T00:00:00"
    resp = client.post("/api/progress", json={
        "progress": {"skill-mastery": {}},
        "timestamps": {"skill-mastery": past_ts},
    })
    assert resp.status_code == 200
    assert resp.json()["keys_skipped"] == 1

    # Original data preserved
    get_resp = client.get("/api/progress")
    assert get_resp.json()["progress"]["skill-mastery"]["ma_arithmetic"] == 0.7


def test_overwrite_with_new_data(client: TestClient):
    """New data can overwrite old data."""
    _signup(client, "p7")
    client.post("/api/progress", json={
        "progress": {"skill-mastery": {"ma_arithmetic": 0.3}}
    })
    client.post("/api/progress", json={
        "progress": {"skill-mastery": {"ma_arithmetic": 0.8}}
    })
    resp = client.get("/api/progress")
    assert resp.json()["progress"]["skill-mastery"]["ma_arithmetic"] == 0.8


def test_sync_empty_progress_object(client: TestClient):
    """Empty progress dict returns 0 updated."""
    _signup(client, "p8")
    resp = client.post("/api/progress", json={"progress": {}})
    assert resp.status_code == 200
    assert resp.json()["keys_updated"] == 0


def test_all_valid_data_keys(client: TestClient):
    """All 16 valid data keys are accepted."""
    from app.lib.data_keys import DATA_KEYS
    _signup(client, "p9")
    progress = {k: [{"x": 1}] for k in DATA_KEYS}
    resp = client.post("/api/progress", json={"progress": progress})
    assert resp.status_code == 200
    assert resp.json()["keys_updated"] == len(DATA_KEYS)
