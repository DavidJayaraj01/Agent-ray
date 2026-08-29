"""Agent-Ready Certificate endpoint — public shareable trust score badge."""
import datetime
import hashlib
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Merchant, Product, Manifest
from backend.services.trust_scorer import compute_trust_score
from backend.services.auth_service import require_own_merchant, AuthUser

router = APIRouter(prefix="/api", tags=["certificate"])


@router.get("/merchant/{merchant_id}/certificate")
def get_certificate(merchant_id: int, db: Session = Depends(get_db), user: AuthUser = Depends(require_own_merchant)):
    """Generate a public Agent-Ready certificate for a merchant.

    Returns trust score breakdown, product stats, policy summary,
    and a verification hash — suitable for embedding or sharing.
    """
    merchant = db.query(Merchant).filter(Merchant.id == merchant_id).first()
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")

    products = db.query(Product).filter(Product.merchant_id == merchant_id).all()
    manifest = db.query(Manifest).filter(Manifest.merchant_id == merchant_id).first()

    # Compute fresh trust score
    from backend.routers.trust import _get_simulated_order_history
    order_history = _get_simulated_order_history(merchant_id)
    trust_data = compute_trust_score(
        products=products,
        order_history=order_history,
        manifest_completeness=manifest.completeness_score if manifest else 0,
    )

    policy = merchant.policy_rules or {}
    generated_at = datetime.datetime.now(datetime.timezone.utc)

    # Verification hash (deterministic, can be independently verified)
    hash_input = f"{merchant_id}:{merchant.name}:{trust_data['overall']}:{generated_at.date().isoformat()}"
    verification_hash = hashlib.sha256(hash_input.encode()).hexdigest()[:16].upper()

    # Determine certification tier
    score = trust_data["overall"]
    if score >= 85:
        tier = "Platinum"
        tier_color = "#6366f1"
        badge_text = "Agent-Ready Certified"
    elif score >= 70:
        tier = "Gold"
        tier_color = "#d97706"
        badge_text = "Agent-Ready Verified"
    elif score >= 50:
        tier = "Silver"
        tier_color = "#6b7280"
        badge_text = "Agent-Compatible"
    else:
        tier = "Bronze"
        tier_color = "#92400e"
        badge_text = "Needs Improvement"

    return {
        "merchant": {
            "id": merchant_id,
            "name": merchant.name,
            "category": merchant.category,
            "status": merchant.status,
            "created_at": merchant.created_at.isoformat() if merchant.created_at else None,
        },
        "trust_score": {
            "overall": trust_data["overall"],
            "breakdown": trust_data["breakdown"],
        },
        "certification": {
            "tier": tier,
            "tier_color": tier_color,
            "badge_text": badge_text,
            "generated_at": generated_at.isoformat(),
            "verification_hash": verification_hash,
            "valid_until": (generated_at + datetime.timedelta(days=30)).isoformat(),
        },
        "catalog_stats": {
            "total_products": len(products),
            "catalog_completeness": manifest.completeness_score if manifest else 0,
            "flagged_products": sum(1 for p in products if p.needs_verification),
        },
        "policy_summary": {
            "negotiation_enabled": policy.get("negotiation_enabled", True),
            "max_discount": policy.get("max_discount", 10),
            "max_auto_order": policy.get("max_auto_order", 50000),
            "min_price": policy.get("min_price", 100),
        },
        "capabilities": [
            "AI Negotiation",
            "Policy-Gated Checkout",
            "Immutable Audit Trail",
            "Razorpay Integration",
            "schema.org Export",
            "ACP Protocol Support",
        ],
    }
