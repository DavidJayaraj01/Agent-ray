"""Unit & Integration tests for Firebase Auth and Role-Based Access Control."""
import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.services.auth_service import get_current_user, get_optional_user, require_own_merchant, AuthUser
from backend.models import AuditLog
from backend.database import SessionLocal


@pytest.fixture
def client():
    # Clear any overrides before each test
    app.dependency_overrides.clear()
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


# ─── 1. Unauthenticated / Invalid Token Tests ─────────────────────────────

def test_unauthenticated_request_rejected(client):
    """Calling protected merchant endpoint without token must return 401."""
    response = client.get("/api/policy/1")
    assert response.status_code == 401
    assert "Missing or invalid Authorization header" in response.json()["detail"]


def test_invalid_token_rejected(client):
    """Calling with fake/malformed token must return 401."""
    response = client.get("/api/policy/1", headers={"Authorization": "Bearer fake_token_12345"})
    assert response.status_code == 401
    assert "Invalid or expired" in response.json()["detail"]


# ─── 2. Role-Based Access Control Tests ───────────────────────────────────

def test_buyer_cannot_access_merchant_policy(client):
    """A buyer account attempting to edit merchant policy must receive 403."""
    buyer_user = AuthUser(
        uid="buyer_user_123",
        email="buyer@example.com",
        display_name="Buyer Joe",
        role="buyer",
        merchant_id=None,
    )
    app.dependency_overrides[get_current_user] = lambda: buyer_user

    response = client.put("/api/policy/1", json={"max_discount": 15})
    assert response.status_code == 403
    assert "Cannot access another merchant's data" in response.json()["detail"]


def test_cross_merchant_access_rejected(client):
    """Merchant #2 attempting to access Merchant #1's policy MUST receive 403.
    This proves strict tenant isolation."""
    merchant_2_user = AuthUser(
        uid="merchant_user_456",
        email="merchant2@example.com",
        display_name="Merchant Two",
        role="merchant",
        merchant_id=2,
    )
    app.dependency_overrides[get_current_user] = lambda: merchant_2_user

    # Attempting to read merchant 1's policy
    response = client.get("/api/policy/1")
    assert response.status_code == 403
    assert "Cannot access another merchant's data" in response.json()["detail"]

    # Attempting to update merchant 1's policy
    response = client.put("/api/policy/1", json={"max_discount": 20})
    assert response.status_code == 403
    assert "Cannot access another merchant's data" in response.json()["detail"]


def test_merchant_can_access_own_data(client):
    """Merchant #1 accessing Merchant #1's policy must succeed with 200."""
    merchant_1_user = AuthUser(
        uid="merchant_user_111",
        email="merchant1@example.com",
        display_name="SportGear Pro Owner",
        role="merchant",
        merchant_id=1,
    )
    app.dependency_overrides[get_current_user] = lambda: merchant_1_user

    response = client.get("/api/policy/1")
    assert response.status_code == 200
    data = response.json()
    assert "max_discount" in data


def test_admin_has_global_access(client):
    """Admin role can access any merchant data and admin endpoints."""
    admin_user = AuthUser(
        uid="admin_user_777",
        email="admin@agentready.ai",
        display_name="Global Administrator",
        role="admin",
        merchant_id=None,
    )
    app.dependency_overrides[get_current_user] = lambda: admin_user

    # Admin accessing merchant 1
    response = client.get("/api/policy/1")
    assert response.status_code == 200

    # Admin accessing full audit log
    response = client.get("/api/audit")
    assert response.status_code == 200


def test_non_admin_cannot_access_admin_audit(client):
    """Buyer or Merchant cannot access full audit log."""
    buyer_user = AuthUser(
        uid="buyer_user_123",
        email="buyer@example.com",
        display_name="Buyer Joe",
        role="buyer",
        merchant_id=None,
    )
    app.dependency_overrides[get_current_user] = lambda: buyer_user

    response = client.get("/api/audit")
    assert response.status_code == 403
    assert "Access denied" in response.json()["detail"]


# ─── 3. Actor Identity in Audit Trail ─────────────────────────────────────

def test_audit_trail_captures_actor_uid_and_role(client):
    """Audit log writes must persist actor_uid and actor_role from the verified session."""
    admin_user = AuthUser(
        uid="audit_test_admin_uid_999",
        email="admin_auditor@test.com",
        display_name="Test Auditor",
        role="admin",
        merchant_id=None,
    )
    app.dependency_overrides[get_current_user] = lambda: admin_user

    response = client.put("/api/policy/1", json={"max_discount": 12})
    assert response.status_code == 200

    # Verify latest audit log record in SQLite
    db = SessionLocal()
    try:
        entry = (
            db.query(AuditLog)
            .filter(AuditLog.merchant_id == 1, AuditLog.action == "policy_updated")
            .order_by(AuditLog.timestamp.desc())
            .first()
        )
        assert entry is not None
        assert entry.actor_uid == "audit_test_admin_uid_999"
        assert entry.actor_email == "admin_auditor@test.com"
        assert entry.actor_role == "admin"
    finally:
        db.close()
