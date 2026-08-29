"""Unit tests for Firebase Admin SDK integration."""
import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.services.firebase_service import init_firebase, get_firebase_status, is_firebase_connected


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def test_firebase_service_initialization():
    """Verify Firebase Admin SDK initializes successfully with credentials."""
    app_instance = init_firebase()
    assert app_instance is not None
    assert is_firebase_connected() is True

    status = get_firebase_status()
    assert status["connected"] is True
    assert status["project_id"] == "agent-ray"
    assert "firebase-adminsdk" in status["client_email"]
    assert status["error"] is None


def test_firebase_status_endpoint(client):
    """Verify GET /api/firebase/status returns correct metadata."""
    response = client.get("/api/firebase/status")
    assert response.status_code == 200
    data = response.json()
    assert data["connected"] is True
    assert data["project_id"] == "agent-ray"
    assert data["features"]["admin_sdk"] is True


def test_firebase_ping_endpoint(client):
    """Verify POST /api/firebase/ping returns healthy connection."""
    response = client.post("/api/firebase/ping")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["connected"] is True
