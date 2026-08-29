"""Growth analytics endpoint — proactive AI Growth Agent for merchants."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Merchant, Product
from backend.services.growth_engine import (
    detect_cross_sell,
    detect_pricing_outliers,
    simulate_cart_recovery,
    compute_gmv_simulation,
)
from backend.services.audit_service import log_event
from backend.services.auth_service import require_own_merchant, AuthUser

router = APIRouter(prefix="/api", tags=["growth"])


@router.get("/growth/{merchant_id}")
def get_growth_analysis(
    merchant_id: int,
    db: Session = Depends(get_db),
    user: AuthUser = Depends(require_own_merchant),
):
    """Run full AI Growth Agent analysis for a merchant.

    Returns cross-sell opportunities, pricing outliers, cart-recovery nudges,
    and before/after GMV simulation — all policy-gated.
    """
    merchant = db.query(Merchant).filter(Merchant.id == merchant_id).first()
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")

    products = db.query(Product).filter(Product.merchant_id == merchant_id).all()
    if not products:
        raise HTTPException(status_code=404, detail="No products found for this merchant")

    policy_rules = merchant.policy_rules or {}

    cross_sell = detect_cross_sell(products)
    outliers = detect_pricing_outliers(products)
    cart_nudges = simulate_cart_recovery(products, policy_rules)
    gmv = compute_gmv_simulation(products, policy_rules)

    # Log growth analysis to audit trail
    log_event(
        db, actor="system", action="growth_analysis",
        merchant_id=merchant_id,
        input_data={"product_count": len(products)},
        output_data={
            "cross_sell_count": len(cross_sell),
            "outlier_count": len(outliers),
            "cart_nudges": len(cart_nudges),
            "gmv_uplift_pct": gmv["uplift_pct"],
        },
        decision="info",
        reason=f"AI Growth Agent: {gmv['uplift_pct']}% GMV uplift projected",
        actor_uid=user.uid,
        actor_email=user.email,
        actor_role=user.role,
    )

    return {
        "merchant_id": merchant_id,
        "merchant_name": merchant.name,
        "product_count": len(products),
        "cross_sell_opportunities": cross_sell,
        "pricing_outliers": outliers,
        "cart_recovery_nudges": cart_nudges,
        "gmv_simulation": gmv,
    }
