"""Deterministic policy engine — pure Python, NO LLM involvement.

This is the safety gate between LLM proposals and payment actions.
Every offer MUST pass through this engine before reaching Razorpay.
"""


class PolicyViolation(Exception):
    """Raised when an offer violates merchant policy."""

    def __init__(self, reason: str, details: dict | None = None):
        self.reason = reason
        self.details = details or {}
        super().__init__(reason)


# ── Abuse / Anomaly Guard ───────────────────────────────────

import time as _time

# In-memory rate tracker (product_id -> list of timestamps)
_rate_tracker: dict[str, list[float]] = {}


def check_negotiation_rate(
    product_id: int,
    window_minutes: int = 10,
    max_attempts: int = 5,
) -> dict:
    """Rate-limit negotiations on the same product.

    Blocks buyer agents making more than max_attempts negotiations
    on the same product within the time window.
    """
    key = f"negotiate_{product_id}"
    now = _time.time()
    window_seconds = window_minutes * 60

    if key not in _rate_tracker:
        _rate_tracker[key] = []

    # Evict stale entries
    _rate_tracker[key] = [t for t in _rate_tracker[key] if now - t < window_seconds]

    if len(_rate_tracker[key]) >= max_attempts:
        return {
            "approved": False,
            "reason": (
                f"Rate limit exceeded: {max_attempts} negotiation attempts "
                f"on product #{product_id} in the last {window_minutes} minutes. "
                f"This may indicate automated abuse. Please wait and try again."
            ),
            "attempts": len(_rate_tracker[key]),
            "window_minutes": window_minutes,
        }

    _rate_tracker[key].append(now)
    return {"approved": True, "attempts": len(_rate_tracker[key])}


def check_anomaly_pattern(proposed_price: float, original_price: float) -> dict:
    """Flag suspiciously aggressive offers as potential abuse.

    Offers requesting >50% discount are flagged as anomalous.
    """
    if original_price <= 0:
        return {"approved": True, "anomaly": False}

    discount_pct = ((original_price - proposed_price) / original_price) * 100

    if discount_pct > 50:
        return {
            "approved": False,
            "anomaly": True,
            "reason": (
                f"Anomaly detected: {discount_pct:.1f}% discount request is "
                f"suspiciously aggressive (threshold: 50%). This offer has been "
                f"flagged for potential automated abuse."
            ),
            "discount_pct": round(discount_pct, 1),
        }

    return {"approved": True, "anomaly": False, "discount_pct": round(discount_pct, 1)}


def check_discount(
    original_price: float,
    proposed_price: float,
    max_discount: float
) -> dict:
    """Check if the proposed discount is within the allowed limit.

    Returns a dict with 'approved', 'reason', and 'discount_percent'.
    """
    if original_price <= 0:
        return {
            "approved": False,
            "reason": "Invalid original price",
            "discount_percent": 0.0,
            "max_allowed_discount": max_discount,
        }

    discount_percent = ((original_price - proposed_price) / original_price) * 100

    if discount_percent < 0:
        return {
            "approved": False,
            "reason": "Proposed price exceeds original price — not a valid discount",
            "discount_percent": round(discount_percent, 2),
            "max_allowed_discount": max_discount,
        }

    if discount_percent > max_discount:
        return {
            "approved": False,
            "reason": (
                f"Requested discount of {discount_percent:.1f}% exceeds "
                f"merchant's maximum allowed discount of {max_discount}%"
            ),
            "discount_percent": round(discount_percent, 2),
            "max_allowed_discount": max_discount,
        }

    return {
        "approved": True,
        "reason": f"Discount of {discount_percent:.1f}% is within the {max_discount}% limit",
        "discount_percent": round(discount_percent, 2),
        "max_allowed_discount": max_discount,
    }


def check_min_price(proposed_price: float, min_price: float) -> dict:
    """Check if the proposed price meets the minimum price threshold."""
    if proposed_price < min_price:
        return {
            "approved": False,
            "reason": (
                f"Proposed price ₹{proposed_price:.2f} is below "
                f"merchant's minimum price of ₹{min_price:.2f}"
            ),
        }
    return {
        "approved": True,
        "reason": f"Proposed price ₹{proposed_price:.2f} meets the minimum price threshold",
    }


def check_order_amount(amount: float, max_auto_order: float) -> dict:
    """Check if the order amount is within the auto-approval limit."""
    if amount > max_auto_order:
        return {
            "approved": False,
            "reason": (
                f"Order amount ₹{amount:.2f} exceeds merchant's "
                f"maximum auto-order limit of ₹{max_auto_order:.2f}"
            ),
        }
    return {
        "approved": True,
        "reason": f"Order amount ₹{amount:.2f} is within auto-order limit",
    }


def check_negotiation_enabled(policy_rules: dict) -> dict:
    """Check if the merchant has negotiation enabled."""
    if not policy_rules.get("negotiation_enabled", True):
        return {
            "approved": False,
            "reason": "Merchant has disabled negotiation for this catalog",
        }
    return {"approved": True, "reason": "Negotiation is enabled"}


def validate_offer(
    original_price: float,
    proposed_price: float,
    policy_rules: dict
) -> dict:
    """Run ALL policy checks against an offer. Returns combined result.

    This is the main entry point — the ONLY function that should be called
    from the negotiate/order endpoints.
    """
    max_discount = policy_rules.get("max_discount", 10)
    min_price = policy_rules.get("min_price", 100)
    max_auto_order = policy_rules.get("max_auto_order", 50000)

    # Check negotiation enabled
    neg_check = check_negotiation_enabled(policy_rules)
    if not neg_check["approved"]:
        return {
            "approved": False,
            "reason": neg_check["reason"],
            "discount_percent": 0.0,
            "max_allowed_discount": max_discount,
            "proposed_price": proposed_price,
            "min_allowed_price": min_price,
        }

    # Check discount limit
    discount_result = check_discount(original_price, proposed_price, max_discount)
    if not discount_result["approved"]:
        return {
            "approved": False,
            "reason": discount_result["reason"],
            "discount_percent": discount_result["discount_percent"],
            "max_allowed_discount": max_discount,
            "proposed_price": proposed_price,
            "min_allowed_price": min_price,
        }

    # Check minimum price
    min_result = check_min_price(proposed_price, min_price)
    if not min_result["approved"]:
        return {
            "approved": False,
            "reason": min_result["reason"],
            "discount_percent": discount_result["discount_percent"],
            "max_allowed_discount": max_discount,
            "proposed_price": proposed_price,
            "min_allowed_price": min_price,
        }

    # Check order amount limit
    amount_result = check_order_amount(proposed_price, max_auto_order)
    if not amount_result["approved"]:
        return {
            "approved": False,
            "reason": amount_result["reason"],
            "discount_percent": discount_result["discount_percent"],
            "max_allowed_discount": max_discount,
            "proposed_price": proposed_price,
            "min_allowed_price": min_price,
        }

    return {
        "approved": True,
        "reason": (
            f"Offer approved: {discount_result['discount_percent']:.1f}% discount "
            f"(within {max_discount}% limit), price ₹{proposed_price:.2f} "
            f"(above ₹{min_price:.2f} minimum)"
        ),
        "discount_percent": discount_result["discount_percent"],
        "max_allowed_discount": max_discount,
        "proposed_price": proposed_price,
        "min_allowed_price": min_price,
    }
