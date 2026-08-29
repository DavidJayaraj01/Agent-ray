"""Dashboard endpoint — merchant analytics and before/after comparison."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Merchant, Product, Manifest, AuditLog
from backend.schemas import (
    DashboardResponse, MerchantResponse, TrustBreakdown, AuditLogResponse,
)
from backend.services.trust_scorer import compute_trust_score
from backend.services.auth_service import require_own_merchant, AuthUser

router = APIRouter(prefix="/api", tags=["dashboard"])


@router.get("/dashboard/{merchant_id}", response_model=DashboardResponse)
def get_dashboard(
    merchant_id: int,
    db: Session = Depends(get_db),
    user: AuthUser = Depends(require_own_merchant),
):
    merchant = db.query(Merchant).filter(Merchant.id == merchant_id).first()
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")

    products = db.query(Product).filter(Product.merchant_id == merchant_id).all()
    manifest = db.query(Manifest).filter(Manifest.merchant_id == merchant_id).first()

    # Trust breakdown
    from backend.routers.trust import _get_simulated_order_history
    order_history = _get_simulated_order_history(merchant_id)
    trust_data = compute_trust_score(
        products=products,
        order_history=order_history,
        manifest_completeness=manifest.completeness_score if manifest else 0,
    )

    breakdown = TrustBreakdown(**trust_data["breakdown"])

    # Match rate comparison (raw vs manifest)
    raw_match_rate = 0.0
    manifest_match_rate = 0.0
    if manifest:
        raw_match_rate = min(100, manifest.raw_product_count * 8.5)  # simulated
        manifest_match_rate = manifest.completeness_score

    # Recent activity
    recent = (
        db.query(AuditLog)
        .filter(AuditLog.merchant_id == merchant_id)
        .order_by(AuditLog.timestamp.desc())
        .limit(10)
        .all()
    )

    flagged = sum(1 for p in products if p.needs_verification)

    return DashboardResponse(
        merchant=MerchantResponse.model_validate(merchant),
        trust_breakdown=breakdown,
        raw_match_rate=round(raw_match_rate, 1),
        manifest_match_rate=round(manifest_match_rate, 1),
        recent_activity=[AuditLogResponse.model_validate(a) for a in recent],
        product_count=len(products),
        flagged_count=flagged,
    )
