"""Unit tests for the policy engine.

These tests prove the critical safety invariant:
  - Offers exceeding max_discount are REJECTED and never reach order creation
  - Offers below min_price are REJECTED
  - Offers above max_auto_order are REJECTED
  - Valid offers pass through
"""
import pytest
from backend.services.policy_engine import (
    validate_offer,
    check_discount,
    check_min_price,
    check_order_amount,
    check_negotiation_enabled,
    check_negotiation_rate,
    check_anomaly_pattern,
    _rate_tracker,
)


# ─── Standard policy for tests ──────────────────────────────
DEFAULT_POLICY = {
    "max_discount": 10,
    "min_price": 100,
    "max_auto_order": 50000,
    "negotiation_enabled": True,
}


# ─── Discount tests ─────────────────────────────────────────
class TestDiscountCheck:
    def test_discount_within_limit(self):
        result = check_discount(1000, 950, 10)
        assert result["approved"] is True
        assert result["discount_percent"] == 5.0

    def test_discount_at_limit(self):
        result = check_discount(1000, 900, 10)
        assert result["approved"] is True
        assert result["discount_percent"] == 10.0

    def test_discount_exceeds_limit(self):
        """CRITICAL TEST: Discount above max MUST be rejected."""
        result = check_discount(1000, 800, 10)
        assert result["approved"] is False
        assert result["discount_percent"] == 20.0
        assert "exceeds" in result["reason"].lower()

    def test_discount_zero(self):
        result = check_discount(1000, 1000, 10)
        assert result["approved"] is True
        assert result["discount_percent"] == 0.0

    def test_price_above_original(self):
        result = check_discount(1000, 1100, 10)
        assert result["approved"] is False

    def test_invalid_original_price(self):
        result = check_discount(0, 100, 10)
        assert result["approved"] is False


# ─── Min price tests ────────────────────────────────────────
class TestMinPriceCheck:
    def test_above_min_price(self):
        result = check_min_price(500, 100)
        assert result["approved"] is True

    def test_at_min_price(self):
        result = check_min_price(100, 100)
        assert result["approved"] is True

    def test_below_min_price(self):
        result = check_min_price(50, 100)
        assert result["approved"] is False
        assert "below" in result["reason"].lower()


# ─── Order amount tests ─────────────────────────────────────
class TestOrderAmountCheck:
    def test_within_limit(self):
        result = check_order_amount(10000, 50000)
        assert result["approved"] is True

    def test_at_limit(self):
        result = check_order_amount(50000, 50000)
        assert result["approved"] is True

    def test_exceeds_limit(self):
        result = check_order_amount(60000, 50000)
        assert result["approved"] is False
        assert "exceeds" in result["reason"].lower()


# ─── Negotiation enabled tests ──────────────────────────────
class TestNegotiationEnabled:
    def test_enabled(self):
        result = check_negotiation_enabled({"negotiation_enabled": True})
        assert result["approved"] is True

    def test_disabled(self):
        result = check_negotiation_enabled({"negotiation_enabled": False})
        assert result["approved"] is False


# ─── Full validation tests ──────────────────────────────────
class TestValidateOffer:
    def test_valid_offer_passes(self):
        """A reasonable offer within all limits should pass."""
        result = validate_offer(1000, 950, DEFAULT_POLICY)
        assert result["approved"] is True
        assert result["discount_percent"] == 5.0

    def test_excessive_discount_blocked(self):
        """CRITICAL: 20% discount on 10% limit MUST be blocked."""
        result = validate_offer(1000, 800, DEFAULT_POLICY)
        assert result["approved"] is False
        assert "exceeds" in result["reason"].lower()

    def test_below_min_price_blocked(self):
        """Price below min_price MUST be blocked."""
        policy = {**DEFAULT_POLICY, "min_price": 500}
        result = validate_offer(1000, 450, policy)
        assert result["approved"] is False

    def test_above_max_order_blocked(self):
        """Order above max_auto_order MUST be blocked."""
        policy = {**DEFAULT_POLICY, "max_auto_order": 5000}
        result = validate_offer(10000, 9500, policy)
        assert result["approved"] is False

    def test_negotiation_disabled_blocked(self):
        """If negotiation is disabled, all offers are blocked."""
        policy = {**DEFAULT_POLICY, "negotiation_enabled": False}
        result = validate_offer(1000, 950, policy)
        assert result["approved"] is False

    def test_maximum_allowed_discount_passes(self):
        """Exactly the max discount should pass."""
        result = validate_offer(1000, 900, DEFAULT_POLICY)
        assert result["approved"] is True

    def test_just_over_max_discount_blocked(self):
        """Even slightly over max discount must be blocked."""
        result = validate_offer(1000, 899, DEFAULT_POLICY)
        assert result["approved"] is False


# ─── Integration: Blocked offer never reaches order ─────────
class TestBlockedOfferNeverReachesOrder:
    """Simulate the full negotiate → policy → order flow."""

    def test_blocked_offer_flow(self):
        """An offer exceeding policy MUST be blocked BEFORE order creation.
        This is the critical safety invariant of the system."""

        # Simulate: buyer asks for 25% off on a ₹10,000 product
        original_price = 10000
        proposed_price = 7500  # 25% discount

        policy = {
            "max_discount": 10,
            "min_price": 1000,
            "max_auto_order": 50000,
            "negotiation_enabled": True,
        }

        # Step 1: Policy check
        result = validate_offer(original_price, proposed_price, policy)

        # Step 2: MUST be blocked
        assert result["approved"] is False, "Excessive discount was not blocked!"
        assert result["discount_percent"] == 25.0

        # Step 3: Order creation should NEVER happen
        order_created = False
        if result["approved"]:
            order_created = True  # This line should NEVER execute

        assert order_created is False, "Order was created despite policy rejection!"

    def test_mock_razorpay_zero_calls_on_blocked_order(self):
        """Mock Razorpay create_order and assert it is called ZERO times when policy rejects."""
        from unittest.mock import patch
        from fastapi.testclient import TestClient
        from backend.main import app

        client = TestClient(app)

        with patch("backend.services.razorpay_service.create_order") as mock_rp:
            from backend.database import SessionLocal
            from backend.models import Product
            db = SessionLocal()
            sample_product = db.query(Product).filter(Product.price > 1000).first()
            prod_id = sample_product.id if sample_product else 1
            db.close()

            # Attempt to create order with excessive discount (e.g. amount = 10 on a >1000 item)
            response = client.post("/api/order/create", json={
                "product_id": prod_id,
                "amount": 10.0,
                "buyer_intent": "Attempting unauthorized 99% discount",
            })

            # Assert request was blocked by policy with HTTP 403
            assert response.status_code == 403
            # Assert Razorpay create_order was called exactly ZERO times
            assert mock_rp.call_count == 0, f"Razorpay create_order called {mock_rp.call_count} times on blocked offer!"


# ─── Rate limiting tests ────────────────────────────────────
class TestRateLimiting:
    def setup_method(self):
        """Clear rate tracker before each test."""
        _rate_tracker.clear()

    def test_first_attempt_allowed(self):
        result = check_negotiation_rate(product_id=999, max_attempts=5)
        assert result["approved"] is True

    def test_within_limit_allowed(self):
        for _ in range(4):
            check_negotiation_rate(product_id=998, max_attempts=5)
        result = check_negotiation_rate(product_id=998, max_attempts=5)
        assert result["approved"] is True

    def test_exceeds_limit_blocked(self):
        for _ in range(5):
            check_negotiation_rate(product_id=997, max_attempts=5)
        result = check_negotiation_rate(product_id=997, max_attempts=5)
        assert result["approved"] is False
        assert "Rate limit exceeded" in result["reason"]

    def test_different_products_independent(self):
        for _ in range(5):
            check_negotiation_rate(product_id=996, max_attempts=5)
        # Product 996 should be blocked
        result_996 = check_negotiation_rate(product_id=996, max_attempts=5)
        assert result_996["approved"] is False
        # Product 995 should still be fine
        result_995 = check_negotiation_rate(product_id=995, max_attempts=5)
        assert result_995["approved"] is True


# ─── Anomaly detection tests ────────────────────────────────
class TestAnomalyDetection:
    def test_normal_discount_not_flagged(self):
        result = check_anomaly_pattern(proposed_price=900, original_price=1000)
        assert result["approved"] is True
        assert result["anomaly"] is False

    def test_aggressive_discount_flagged(self):
        result = check_anomaly_pattern(proposed_price=400, original_price=1000)
        assert result["approved"] is False
        assert result["anomaly"] is True
        assert "Anomaly detected" in result["reason"]

    def test_50_percent_boundary_allowed(self):
        result = check_anomaly_pattern(proposed_price=500, original_price=1000)
        assert result["approved"] is True

    def test_zero_price_flagged(self):
        result = check_anomaly_pattern(proposed_price=0, original_price=1000)
        assert result["approved"] is False
        assert result["anomaly"] is True

    def test_zero_original_price_safe(self):
        result = check_anomaly_pattern(proposed_price=100, original_price=0)
        assert result["approved"] is True
