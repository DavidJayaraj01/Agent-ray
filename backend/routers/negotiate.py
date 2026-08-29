"""Negotiation endpoint — LLM proposes, policy engine gates.

Tags negotiations with the authenticated buyer's identity and records
actor_uid / actor_role in the append-only audit trail before returning.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional

from backend.database import get_db
from backend.models import Product, Merchant, Negotiation
from backend.schemas import NegotiateRequest, NegotiateResponse, CounterOfferRequest
from backend.services.llm_service import generate_negotiation_response
from backend.services.policy_engine import validate_offer, check_negotiation_rate, check_anomaly_pattern
from backend.services.audit_service import log_event
from backend.services.auth_service import get_optional_user, AuthUser

router = APIRouter(prefix="/api", tags=["negotiate"])


@router.post("/negotiate", response_model=NegotiateResponse)
async def negotiate(
    data: NegotiateRequest,
    db: Session = Depends(get_db),
    user: Optional[AuthUser] = Depends(get_optional_user),
):
    product = db.query(Product).filter(Product.id == data.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    merchant = db.query(Merchant).filter(Merchant.id == product.merchant_id).first()
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")

    policy_rules = merchant.policy_rules or {}
    actor_uid = user.uid if user else ""
    actor_email = user.email if user else ""
    actor_role = user.role if user else "buyer"

    # ABUSE GUARD: Rate limit check (bypassed for full price or sub-500 purchases)
    rate_check = check_negotiation_rate(
        data.product_id,
        proposed_price=data.proposed_price,
        original_price=product.price,
    )

    if not rate_check["approved"]:
        log_event(
            db, actor="policy", action="negotiation_rate_limited",
            merchant_id=merchant.id,
            input_data={"product_id": data.product_id, "proposed_price": data.proposed_price},
            output_data=rate_check,
            decision="blocked",
            reason=rate_check["reason"],
            actor_uid=actor_uid,
            actor_email=actor_email,
            actor_role=actor_role,
        )
        raise HTTPException(status_code=429, detail=rate_check["reason"])

    # ABUSE GUARD: Anomaly pattern check
    anomaly_check = check_anomaly_pattern(data.proposed_price, product.price)
    if not anomaly_check["approved"]:
        log_event(
            db, actor="policy", action="negotiation_anomaly_detected",
            merchant_id=merchant.id,
            input_data={"product_id": data.product_id, "proposed_price": data.proposed_price},
            output_data=anomaly_check,
            decision="blocked",
            reason=anomaly_check["reason"],
            actor_uid=actor_uid,
            actor_email=actor_email,
            actor_role=actor_role,
        )
        raise HTTPException(status_code=403, detail=anomaly_check["reason"])

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
    elif recommended_action == "counter":
        if round(counter_price, 2) == round(data.proposed_price, 2):
            status = "accepted"
            policy_reason = policy_result["reason"]
        else:
            status = "counter"
            policy_reason = f"Merchant countered with ₹{counter_price:,.0f}. {policy_result['reason']}"
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
        actor_uid=actor_uid,
        actor_email=actor_email,
        actor_role=actor_role,
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
        buyer_uid=actor_uid,
        buyer_email=actor_email,
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
            "buyer_uid": negotiation.buyer_uid,
            "created_at": negotiation.created_at.isoformat() if negotiation.created_at else None,
        })
    except Exception:
        pass

    return negotiation


@router.post("/negotiate/counter/{negotiation_id}", response_model=NegotiateResponse)
async def counter_negotiation(
    negotiation_id: int,
    data: CounterOfferRequest,
    db: Session = Depends(get_db),
    user: Optional[AuthUser] = Depends(get_optional_user),
):
    """Second-round negotiation endpoint: buyer can accept, decline, or make a counter-offer."""
    neg = db.query(Negotiation).filter(Negotiation.id == negotiation_id).first()
    if not neg:
        raise HTTPException(status_code=404, detail="Negotiation not found")

    product = db.query(Product).filter(Product.id == neg.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    merchant = db.query(Merchant).filter(Merchant.id == neg.merchant_id).first()
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")

    policy_rules = merchant.policy_rules or {}
    actor_uid = user.uid if user else neg.buyer_uid
    actor_email = user.email if user else neg.buyer_email
    actor_role = user.role if user else "buyer"

    # Handle buyer accepting merchant counter-offer
    if data.action == "accept":
        accepted_price = neg.final_price or neg.proposed_price
        neg.status = "accepted"
        transcript = list(neg.negotiation_transcript or [])
        transcript.append({"role": "buyer", "message": f"I accept your counter-offer of ₹{accepted_price:,.0f}!"})
        transcript.append({"role": "merchant_ai", "message": f"Deal confirmed at ₹{accepted_price:,.0f}! You can proceed to checkout."})
        transcript.append({"role": "policy", "message": f"Approved: agreed at ₹{accepted_price:,.0f}", "status": "accepted"})
        neg.negotiation_transcript = transcript

        log_event(
            db, actor="buyer", action="negotiation_counter_accepted",
            merchant_id=merchant.id,
            input_data={"negotiation_id": negotiation_id, "accepted_price": accepted_price},
            output_data={"status": "accepted"},
            decision="approved",
            reason=f"Buyer accepted counter at ₹{accepted_price:,.0f}",
            actor_uid=actor_uid,
            actor_email=actor_email,
            actor_role=actor_role,
        )

        db.commit()
        db.refresh(neg)
        return neg

    # Handle buyer declining
    if data.action == "decline":
        neg.status = "rejected"
        transcript = list(neg.negotiation_transcript or [])
        transcript.append({"role": "buyer", "message": "I decline this counter-offer."})
        transcript.append({"role": "policy", "message": "Negotiation concluded without agreement.", "status": "rejected"})
        neg.negotiation_transcript = transcript

        log_event(
            db, actor="buyer", action="negotiation_counter_declined",
            merchant_id=merchant.id,
            input_data={"negotiation_id": negotiation_id},
            output_data={"status": "rejected"},
            decision="rejected",
            reason="Buyer declined merchant counter-offer",
            actor_uid=actor_uid,
            actor_email=actor_email,
            actor_role=actor_role,
        )

        db.commit()
        db.refresh(neg)
        return neg

    # Round 2: Buyer submits counter-offer
    proposed = data.proposed_price or (neg.final_price or product.price)

    # Abuse guard checks
    rate_check = check_negotiation_rate(product.id)
    if not rate_check["approved"]:
        raise HTTPException(status_code=429, detail=rate_check["reason"])

    anomaly_check = check_anomaly_pattern(proposed, product.price)
    if not anomaly_check["approved"]:
        raise HTTPException(status_code=403, detail=anomaly_check["reason"])

    # LLM evaluation
    llm_resp = generate_negotiation_response(
        product_name=product.name,
        original_price=product.price,
        proposed_price=proposed,
        merchant_policy=policy_rules,
        buyer_message=data.buyer_message,
    )
    counter_price = llm_resp.get("counter_price", proposed)
    rec_action = llm_resp.get("recommended_action", "counter")
    policy_result = validate_offer(product.price, counter_price, policy_rules)

    if not policy_result["approved"]:
        status = "blocked"
        reason = policy_result["reason"]
        final_price = None
    elif rec_action == "accept" or round(counter_price, 2) == round(proposed, 2):
        status = "accepted"
        final_price = counter_price
        reason = policy_result["reason"]
    else:
        status = "accepted"
        final_price = counter_price
        reason = f"Final counter accepted at ₹{counter_price:,.0f}. {policy_result['reason']}"

    transcript = list(neg.negotiation_transcript or [])
    transcript.append({"role": "buyer", "message": data.buyer_message or f"Round 2 Counter: Can you do ₹{proposed:,.0f}?"})
    transcript.append({"role": "merchant_ai", "message": llm_resp.get("message", "")})
    transcript.append({"role": "policy", "message": reason, "status": status})

    neg.proposed_price = proposed
    neg.final_price = final_price
    neg.status = status
    neg.policy_reason = reason
    neg.negotiation_transcript = transcript
    neg.discount_percent = policy_result.get("discount_percent", 0.0)

    log_event(
        db, actor="llm", action="negotiation_round_2",
        merchant_id=merchant.id,
        input_data={"product_id": product.id, "proposed_price": proposed},
        output_data={"counter_price": counter_price, "status": status},
        decision="approved" if status == "accepted" else "blocked",
        reason=reason,
        actor_uid=actor_uid,
        actor_email=actor_email,
        actor_role=actor_role,
    )

    db.commit()
    db.refresh(neg)
    return neg
