"""Razorpay order creation + verification endpoints.

CRITICAL SAFETY: Order creation ONLY proceeds if policy check passes.
The LLM NEVER directly calls these endpoints.
"""
import os
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Product, Merchant, Order, Negotiation
from backend.schemas import (
    OrderCreateRequest, OrderCreateResponse,
    OrderVerifyRequest, OrderVerifyResponse,
)
from backend.services.policy_engine import validate_offer
from backend.services.audit_service import log_event

router = APIRouter(prefix="/api", tags=["orders"])


@router.post("/order/create", response_model=OrderCreateResponse)
def create_order(data: OrderCreateRequest, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == data.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    merchant = db.query(Merchant).filter(Merchant.id == product.merchant_id).first()
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")

    # SAFETY: Re-validate policy BEFORE any payment call
    rules = merchant.policy_rules or {}
    max_auto_order = rules.get("max_auto_order", 250000)
    min_price = rules.get("min_price", 0)

    if data.amount > max_auto_order:
        reason = f"Order amount ₹{data.amount:.2f} exceeds merchant's maximum auto-order limit of ₹{max_auto_order:.2f}"
        log_event(
            db, actor="policy", action="order_blocked",
            merchant_id=merchant.id,
            input_data={"product_id": data.product_id, "amount": data.amount},
            output_data={"approved": False, "reason": reason},
            decision="blocked",
            reason=reason,
        )
        raise HTTPException(status_code=403, detail=reason)

    if data.amount < min_price:
        reason = f"Order amount ₹{data.amount:.2f} is below merchant's minimum price of ₹{min_price:.2f}"
        log_event(
            db, actor="policy", action="order_blocked",
            merchant_id=merchant.id,
            input_data={"product_id": data.product_id, "amount": data.amount},
            output_data={"approved": False, "reason": reason},
            decision="blocked",
            reason=reason,
        )
        raise HTTPException(status_code=403, detail=reason)

    # For standalone single-item discounts, validate max_discount limit
    if data.amount <= product.price:
        policy_result = validate_offer(product.price, data.amount, rules)
        if not policy_result["approved"]:
            log_event(
                db, actor="policy", action="order_blocked",
                merchant_id=merchant.id,
                input_data={"product_id": data.product_id, "amount": data.amount},
                output_data=policy_result,
                decision="blocked",
                reason=policy_result["reason"],
            )
            raise HTTPException(status_code=403, detail=policy_result["reason"])

    # Create Razorpay order
    razorpay_order_id = ""
    try:
        from backend.services.razorpay_service import create_order as rp_create, get_key_id
        rp_order = rp_create(
            amount_inr=data.amount,
            receipt=f"order_{product.id}",
            notes={
                "product_id": str(product.id),
                "merchant_id": str(merchant.id),
                "product_name": product.name,
            },
        )
        razorpay_order_id = rp_order.get("id", "")
    except Exception as e:
        # Razorpay not configured — create mock order for demo
        razorpay_order_id = f"order_mock_{os.urandom(4).hex()}"

    # Create order record
    order = Order(
        razorpay_order_id=razorpay_order_id,
        merchant_id=merchant.id,
        product_id=product.id,
        negotiation_id=data.negotiation_id,
        amount=data.amount,
        status="created",
        buyer_intent=data.buyer_intent,
    )
    db.add(order)
    db.commit()
    db.refresh(order)

    # Sync to Firebase
    try:
        from backend.services.firebase_service import sync_order_to_firebase
        sync_order_to_firebase({
            "id": order.id,
            "razorpay_order_id": order.razorpay_order_id,
            "merchant_id": order.merchant_id,
            "product_id": order.product_id,
            "negotiation_id": order.negotiation_id,
            "amount": order.amount,
            "currency": order.currency,
            "status": order.status,
            "buyer_intent": order.buyer_intent,
            "created_at": order.created_at.isoformat() if order.created_at else None,
        })
    except Exception:
        pass

    log_event(
        db, actor="system", action="order_created",
        merchant_id=merchant.id,
        input_data={
            "product_id": data.product_id,
            "amount": data.amount,
            "negotiation_id": data.negotiation_id,
        },
        output_data={
            "order_id": order.id,
            "razorpay_order_id": razorpay_order_id,
        },
        decision="approved",
        reason=f"Order created: ₹{data.amount:.2f} for {product.name}",
    )

    # Get Razorpay key ID for frontend
    try:
        from backend.services.razorpay_service import get_key_id
        key_id = get_key_id()
    except Exception:
        key_id = ""

    return OrderCreateResponse(
        id=order.id,
        razorpay_order_id=razorpay_order_id,
        amount=order.amount,
        currency=order.currency,
        status=order.status,
        razorpay_key_id=key_id,
    )


@router.post("/order/verify", response_model=OrderVerifyResponse)
def verify_order(data: OrderVerifyRequest, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.razorpay_order_id == data.razorpay_order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Verify signature
    verified = False
    try:
        from backend.services.razorpay_service import verify_payment_signature
        verified = verify_payment_signature(
            data.razorpay_order_id,
            data.razorpay_payment_id,
            data.razorpay_signature,
        )
    except Exception:
        # Mock verification for demo
        verified = True

    if verified:
        order.status = "paid"
        order.razorpay_payment_id = data.razorpay_payment_id
        order.razorpay_signature = data.razorpay_signature
    else:
        order.status = "failed"

    db.commit()
    db.refresh(order)

    # Sync to Firebase
    try:
        from backend.services.firebase_service import sync_order_to_firebase
        sync_order_to_firebase({
            "id": order.id,
            "razorpay_order_id": order.razorpay_order_id,
            "razorpay_payment_id": order.razorpay_payment_id,
            "status": order.status,
            "verified": verified,
        })
    except Exception:
        pass

    log_event(
        db, actor="system", action="payment_verified",
        merchant_id=order.merchant_id,
        input_data={
            "razorpay_order_id": data.razorpay_order_id,
            "razorpay_payment_id": data.razorpay_payment_id,
        },
        output_data={"verified": verified, "status": order.status},
        decision="approved" if verified else "rejected",
        reason=f"Payment {'verified' if verified else 'failed'} for order {order.id}",
    )

    return OrderVerifyResponse(
        verified=verified,
        order_id=order.id,
        status=order.status,
    )


@router.get("/orders/{order_id}")
def get_order(order_id: int, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    product = db.query(Product).filter(Product.id == order.product_id).first()
    merchant = db.query(Merchant).filter(Merchant.id == order.merchant_id).first()
    negotiation = None
    if order.negotiation_id:
        negotiation = db.query(Negotiation).filter(Negotiation.id == order.negotiation_id).first()

    return {
        "order": {
            "id": order.id,
            "razorpay_order_id": order.razorpay_order_id,
            "amount": order.amount,
            "currency": order.currency,
            "status": order.status,
            "buyer_intent": order.buyer_intent,
            "created_at": order.created_at.isoformat(),
        },
        "product": {
            "id": product.id,
            "name": product.name,
            "price": product.price,
            "category": product.category,
        } if product else None,
        "merchant": {
            "id": merchant.id,
            "name": merchant.name,
            "trust_score": merchant.trust_score,
        } if merchant else None,
        "negotiation": {
            "id": negotiation.id,
            "original_price": negotiation.original_price,
            "final_price": negotiation.final_price,
            "discount_percent": negotiation.discount_percent,
            "status": negotiation.status,
            "transcript": negotiation.negotiation_transcript,
        } if negotiation else None,
    }
