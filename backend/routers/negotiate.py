"""Negotiation endpoint — LLM proposes, policy engine gates."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Product, Merchant, Negotiation
from backend.schemas import NegotiateRequest, NegotiateResponse
from backend.services.llm_service import generate_negotiation_response
from backend.services.policy_engine import validate_offer
from backend.services.audit_service import log_event

router = APIRouter(prefix="/api", tags=["negotiate"])


@router.post("/negotiate", response_model=NegotiateResponse)
def negotiate(data: NegotiateRequest, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == data.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    merchant = db.query(Merchant).filter(Merchant.id == product.merchant_id).first()
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")

    policy_rules = merchant.policy_rules or {}

    # Step 1: LLM generates negotiation response (proposal only, no money action)
    llm_response = generate_negotiation_response(
        product_name=product.name,
        original_price=product.price,
        proposed_price=data.proposed_price,
        merchant_policy=policy_rules,
        buyer_message=data.buyer_message,
    )

    counter_price = llm_response.get("counter_price", data.proposed_price)
    recommended_action = llm_response.get("recommended_action", "counter")
    llm_message = llm_response.get("message", "")

    # Step 2: Policy engine validates the LLM's proposed deal
    final_price = counter_price if recommended_action in ("accept", "counter") else data.proposed_price
    policy_result = validate_offer(product.price, final_price, policy_rules)

    # Determine negotiation status
    if not policy_result["approved"]:
        status = "blocked"
        final_price = None
        policy_reason = policy_result["reason"]
    elif recommended_action == "accept":
        status = "accepted"
        policy_reason = policy_result["reason"]
    elif recommended_action == "reject":
        status = "rejected"
        final_price = None
        policy_reason = "Merchant declined the offer"
    else:
        status = "accepted"
        policy_reason = policy_result["reason"]

    discount_pct = policy_result.get("discount_percent", 0.0)

    # Build transcript
    transcript = [
        {"role": "buyer", "message": data.buyer_message or f"Can I get this for ₹{data.proposed_price:.0f}?"},
        {"role": "merchant_ai", "message": llm_message},
        {"role": "policy", "message": policy_reason, "status": status},
    ]

    # Step 3: Log BEFORE returning response (critical safety rule)
    log_event(
        db, actor="llm", action="negotiation_proposal",
        merchant_id=merchant.id,
        input_data={
            "product_id": product.id,
            "original_price": product.price,
            "proposed_price": data.proposed_price,
            "buyer_message": data.buyer_message,
        },
        output_data={
            "counter_price": counter_price,
            "recommended_action": recommended_action,
            "final_price": final_price,
            "status": status,
            "policy_result": policy_result,
        },
        decision="approved" if status == "accepted" else "rejected" if status == "rejected" else "blocked",
        reason=policy_reason,
    )

    # Create negotiation record
    negotiation = Negotiation(
        product_id=product.id,
        merchant_id=merchant.id,
        original_price=product.price,
        proposed_price=data.proposed_price,
        final_price=final_price,
        discount_percent=discount_pct,
        status=status,
        policy_reason=policy_reason,
        negotiation_transcript=transcript,
    )
    db.add(negotiation)
    db.commit()
    db.refresh(negotiation)

    # Sync to Firebase
    try:
        from backend.services.firebase_service import sync_negotiation_to_firebase
        sync_negotiation_to_firebase({
            "id": negotiation.id,
            "product_id": negotiation.product_id,
            "merchant_id": negotiation.merchant_id,
            "original_price": negotiation.original_price,
            "proposed_price": negotiation.proposed_price,
            "final_price": negotiation.final_price,
            "discount_percent": negotiation.discount_percent,
            "status": negotiation.status,
            "policy_reason": negotiation.policy_reason,
            "created_at": negotiation.created_at.isoformat() if negotiation.created_at else None,
        })
    except Exception:
        pass

    return negotiation
