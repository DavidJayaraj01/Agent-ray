"""Trust score computation endpoint."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Merchant, Product, Manifest
from backend.services.trust_scorer import compute_trust_score
from backend.services.audit_service import log_event

router = APIRouter(prefix="/api", tags=["trust"])


@router.post("/trust/score/{merchant_id}")
def score_merchant(merchant_id: int, db: Session = Depends(get_db)):
    merchant = db.query(Merchant).filter(Merchant.id == merchant_id).first()
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")

    products = db.query(Product).filter(Product.merchant_id == merchant_id).all()
    manifest = db.query(Manifest).filter(Manifest.merchant_id == merchant_id).first()

    # Simulated order history for trust scoring
    order_history = _get_simulated_order_history(merchant_id)

    result = compute_trust_score(
        products=products,
        order_history=order_history,
        manifest_completeness=manifest.completeness_score if manifest else 0,
    )

    merchant.trust_score = result["overall"]
    db.commit()

    log_event(
        db, actor="system", action="trust_score_computed",
        merchant_id=merchant_id,
        input_data={"product_count": len(products)},
        output_data=result,
        decision="info",
        reason=f"Trust score: {result['overall']}",
    )

    return result


def _get_simulated_order_history(merchant_id: int) -> list[dict]:
    """Generate simulated order history for demo purposes."""
    import random
    random.seed(merchant_id)  # deterministic per merchant

    histories = {
        1: [  # SportGear Pro — good history
            {"status": "paid"} for _ in range(18)
        ] + [{"status": "disputed"} for _ in range(2)],
        2: [  # Ananya's Fashion Hub — mixed
            {"status": "paid"} for _ in range(10)
        ] + [{"status": "disputed"} for _ in range(4)]
        + [{"status": "refunded"} for _ in range(3)],
        3: [  # TechBazaar — great history
            {"status": "paid"} for _ in range(25)
        ] + [{"status": "disputed"}],
    }

    return histories.get(merchant_id, [
        {"status": random.choice(["paid", "paid", "paid", "disputed"])}
        for _ in range(15)
    ])
