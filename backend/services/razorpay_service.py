"""Razorpay test-mode integration — order creation + signature verification.

SAFETY: Only test-mode keys (rzp_test_ prefix) are accepted.
"""
import os
import hmac
import hashlib
from typing import Any

try:
    import razorpay  # type: ignore[import-untyped, import-not-found]
except ImportError:
    razorpay: Any = None


class RazorpayServiceError(Exception):
    pass


def get_razorpay_client() -> Any:
    """Create and return a Razorpay client. Rejects live keys."""
    if razorpay is None:
        raise RazorpayServiceError(
            "Razorpay library is not installed. Please run: pip install razorpay"
        )

    key_id = os.getenv("RAZORPAY_KEY_ID", "")
    key_secret = os.getenv("RAZORPAY_KEY_SECRET", "")

    if not key_id or not key_secret:
        raise RazorpayServiceError(
            "Razorpay keys not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env"
        )

    if key_id.startswith("rzp_live_"):
        raise RazorpayServiceError(
            "FATAL: Live Razorpay keys detected! Only test-mode keys (rzp_test_) are allowed."
        )

    if not key_id.startswith("rzp_test_"):
        raise RazorpayServiceError(
            "Invalid Razorpay key format. Keys must start with 'rzp_test_'."
        )

    return razorpay.Client(auth=(key_id, key_secret))


def create_order(amount_inr: float, receipt: str = "", notes: dict | None = None) -> dict:
    """Create a Razorpay test-mode order.

    Args:
        amount_inr: Amount in INR (will be converted to paise)
        receipt: Optional receipt identifier
        notes: Optional metadata
    Returns:
        Razorpay order dict with id, amount, currency, status
    """
    client: Any = get_razorpay_client()

    amount_paise = int(amount_inr * 100)

    order_data = {
        "amount": amount_paise,
        "currency": "INR",
        "receipt": receipt or f"agentready_{os.urandom(4).hex()}",
        "notes": notes or {},
    }

    try:
        order = client.order.create(data=order_data)
        return order
    except Exception as e:
        raise RazorpayServiceError(f"Failed to create Razorpay order: {str(e)}")


def verify_payment_signature(
    razorpay_order_id: str,
    razorpay_payment_id: str,
    razorpay_signature: str
) -> bool:
    """Verify Razorpay payment signature using HMAC-SHA256.

    This validates that the payment callback is genuinely from Razorpay.
    """
    key_secret = os.getenv("RAZORPAY_KEY_SECRET", "")

    if not key_secret:
        raise RazorpayServiceError("Razorpay key secret not configured")

    message = f"{razorpay_order_id}|{razorpay_payment_id}"
    expected_signature = hmac.new(
        key_secret.encode("utf-8"),
        message.encode("utf-8"),
        hashlib.sha256
    ).hexdigest()

    return hmac.compare_digest(expected_signature, razorpay_signature)


def get_key_id() -> str:
    """Return the public Razorpay key ID (safe for frontend)."""
    key_id = os.getenv("RAZORPAY_KEY_ID", "")
    if not key_id:
        return ""
    if key_id.startswith("rzp_live_"):
        raise RazorpayServiceError("Live keys are not allowed")
    return key_id
