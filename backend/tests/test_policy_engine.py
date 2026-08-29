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
