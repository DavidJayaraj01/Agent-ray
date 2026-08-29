"""Deterministic policy check endpoint — pure Python, no LLM."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Product, Merchant
from backend.schemas import PolicyCheckRequest, PolicyCheckResponse
from backend.services.policy_engine import validate_offer
from backend.services.audit_service import log_event

router = APIRouter(prefix="/api", tags=["policy"])


@router.post("/policy/check", response_model=PolicyCheckResponse)
def check_policy(data: PolicyCheckRequest, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == data.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    merchant = db.query(Merchant).filter(Merchant.id == data.merchant_id).first()
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")

    policy_rules = merchant.policy_rules or {}
    result = validate_offer(product.price, data.proposed_price, policy_rules)

    # Log BEFORE returning (safety rule)
    log_event(
        db, actor="policy", action="policy_check",
        merchant_id=merchant.id,
        input_data={
            "product_id": data.product_id,
            "original_price": product.price,
            "proposed_price": data.proposed_price,
            "policy_rules": policy_rules,
        },
        output_data=result,
        decision="approved" if result["approved"] else "blocked",
        reason=result["reason"],
    )

    return PolicyCheckResponse(**result)


@router.get("/policy/{merchant_id}")
def get_policy(merchant_id: int, db: Session = Depends(get_db)):
    merchant = db.query(Merchant).filter(Merchant.id == merchant_id).first()
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")
    return merchant.policy_rules


@router.put("/policy/{merchant_id}")
def update_policy(merchant_id: int, policy: dict, db: Session = Depends(get_db)):
    merchant = db.query(Merchant).filter(Merchant.id == merchant_id).first()
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")

    # Validate policy fields
    allowed_keys = {"max_discount", "min_price", "max_auto_order", "negotiation_enabled"}
    for key in policy:
        if key not in allowed_keys:
            raise HTTPException(status_code=400, detail=f"Unknown policy field: {key}")

    current = merchant.policy_rules or {}
    current.update(policy)
    merchant.policy_rules = current
    db.commit()
    db.refresh(merchant)

    log_event(
        db, actor="system", action="policy_updated",
        merchant_id=merchant_id,
        input_data=policy,
        output_data=current,
        decision="info",
        reason="Merchant policy rules updated",
    )

    return current
