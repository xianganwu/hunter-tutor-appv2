"""Tests for health check and frontend routes."""
import pytest
from fastapi.testclient import TestClient


def test_health_check(client: TestClient):
    resp = client.get("/api/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert "version" in data


def test_landing_page(client: TestClient):
    resp = client.get("/")
    assert resp.status_code == 200
    assert "Hunter" in resp.text


def test_dashboard_page(client: TestClient):
    resp = client.get("/dashboard")
    assert resp.status_code == 200
    assert "dashboard" in resp.text.lower() or "Dashboard" in resp.text


def test_tutor_reading_page(client: TestClient):
    resp = client.get("/tutor/reading_comprehension")
    assert resp.status_code == 200


def test_tutor_math_page(client: TestClient):
    resp = client.get("/tutor/math_achievement")
    assert resp.status_code == 200


def test_tutor_invalid_subject(client: TestClient):
    resp = client.get("/tutor/invalid_subject_xyz")
    assert resp.status_code == 404


def test_progress_page(client: TestClient):
    resp = client.get("/progress")
    assert resp.status_code == 200


def test_writing_page(client: TestClient):
    resp = client.get("/writing")
    assert resp.status_code == 200


def test_mistakes_page(client: TestClient):
    resp = client.get("/mistakes")
    assert resp.status_code == 200


def test_onboarding_page(client: TestClient):
    resp = client.get("/onboarding")
    assert resp.status_code == 200


def test_api_docs_available(client: TestClient):
    resp = client.get("/api/docs")
    assert resp.status_code == 200


def test_rate_limit_not_triggered_by_normal_traffic(client: TestClient):
    """Normal traffic doesn't hit rate limit."""
    for _ in range(5):
        resp = client.get("/api/health")
        assert resp.status_code == 200
