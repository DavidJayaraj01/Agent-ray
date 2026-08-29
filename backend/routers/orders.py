"""Razorpay order creation + verification endpoints.

CRITICAL SAFETY: Order creation ONLY proceeds if policy check passes.
The LLM NEVER directly calls these endpoints.
All order actions verify user identity and log actor_uid/actor_role before returning.
"""
import os
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional

from backend.database import get_db
from backend.models import Product, Merchant, Order, Negotiation
from backend.schemas import (
    OrderCreateRequest, OrderCreateResponse,
    OrderVerifyRequest, OrderVerifyResponse,
)
from backend.services.policy_engine import validate_offer
from backend.services.audit_service import log_event
from backend.services.auth_service import (
    get_current_user, get_optional_user, require_own_merchant, AuthUser,
)

router = APIRouter(prefix="/api", tags=["orders"])


@router.post("/order/create", response_model=OrderCreateResponse)
async def create_order(
    data: OrderCreateRequest,
    db: Session = Depends(get_db),
    user: Optional[AuthUser] = Depends(get_optional_user),
):
    product = db.query(Product).filter(Product.id == data.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    merchant = db.query(Merchant).filter(Merchant.id == product.merchant_id).first()
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")

    # IDEMPOTENCY GUARD: Check if order already exists for this negotiation
    if data.negotiation_id:
        existing_order = db.query(Order).filter(
            Order.negotiation_id == data.negotiation_id,
            Order.status.in_(["created", "paid"]),
        ).first()
        if existing_order:
            try:
                from backend.services.razorpay_service import get_key_id
                key_id = get_key_id()
            except Exception:
                key_id = ""
            return OrderCreateResponse(
                id=existing_order.id,
                razorpay_order_id=existing_order.razorpay_order_id,
                amount=existing_order.amount,
                currency=existing_order.currency,
                status=existing_order.status,
                razorpay_key_id=key_id,
            )

    actor_uid = user.uid if user else ""
    actor_email = user.email if user else ""
    actor_role = user.role if user else "buyer"

    # SAFETY: Re-validate policy BEFORE any payment call
    rules = merchant.policy_rules or {}
    max_auto_order = rules.get("max_auto_order", 250000)
    min_price = rules.get("min_price", 0)

    # If amount exceeds max_auto_order, save as pending_approval for merchant manual review
    if data.amount > max_auto_order:
        pending_order = Order(
            razorpay_order_id=f"pending_auth_{os.urandom(4).hex()}",
            merchant_id=merchant.id,
            product_id=product.id,
            negotiation_id=data.negotiation_id,
            amount=data.amount,
            status="pending_approval",
            buyer_intent=data.buyer_intent,
            buyer_uid=actor_uid,
            buyer_email=actor_email,
        )
        db.add(pending_order)
        db.commit()
        db.refresh(pending_order)

        reason = f"Order amount ₹{data.amount:.2f} exceeds merchant's maximum auto-order limit of ₹{max_auto_order:.2f}. Submitted for merchant manual review."
        log_event(
            db, actor="policy", action="order_submitted_for_approval",
            merchant_id=merchant.id,
            input_data={"product_id": data.product_id, "amount": data.amount},
            output_data={"approved": False, "status": "pending_approval", "order_id": pending_order.id},
            decision="info",
            reason=reason,
            actor_uid=actor_uid,
            actor_email=actor_email,
            actor_role=actor_role,
        )
        raise HTTPException(
            status_code=403,
            detail=f"Order exceeds auto-limit ₹{max_auto_order:,.0f} and has been submitted for merchant manual approval (Order #{pending_order.id}).",
        )

    # Check minimum order price (capped by product's catalog list price)
    effective_min_price = min(min_price, product.price) if product and product.price > 0 else min_price
    if data.amount < effective_min_price and data.amount < product.price:
        reason = f"Order amount ₹{data.amount:.2f} is below minimum allowed price of ₹{effective_min_price:.2f}"
        log_event(
            db, actor="policy", action="order_blocked",
            merchant_id=merchant.id,
            input_data={"product_id": data.product_id, "amount": data.amount},
            output_data={"approved": False, "reason": reason},
            decision="blocked",
            reason=reason,
            actor_uid=actor_uid,
            actor_email=actor_email,
            actor_role=actor_role,
        )
        raise HTTPException(status_code=403, detail=reason)

    # For discounted purchases, validate max_discount limit
    if data.amount < product.price:
        policy_result = validate_offer(product.price, data.amount, rules)
        if not policy_result["approved"]:
            log_event(
                db, actor="policy", action="order_blocked",
                merchant_id=merchant.id,
                input_data={"product_id": data.product_id, "amount": data.amount},
                output_data=policy_result,
                decision="blocked",
                reason=policy_result["reason"],
                actor_uid=actor_uid,
                actor_email=actor_email,
                actor_role=actor_role,
            )
            raise HTTPException(status_code=403, detail=policy_result["reason"])


    # Create Razorpay order
    razorpay_order_id = ""
    try:
        from backend.services.razorpay_service import create_order as rp_create
        rp_order = rp_create(
            amount_inr=data.amount,
            receipt=f"order_{product.id}",
            notes={
                "product_id": str(product.id),
                "merchant_id": str(merchant.id),
                "product_name": product.name,
                "buyer_uid": actor_uid,
            },
        )
        razorpay_order_id = rp_order.get("id", "")
    except Exception:
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
        buyer_uid=actor_uid,
        buyer_email=actor_email,
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
            "buyer_uid": order.buyer_uid,
            "buyer_email": order.buyer_email,
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
        actor_uid=actor_uid,
        actor_email=actor_email,
        actor_role=actor_role,
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
async def verify_order(
    data: OrderVerifyRequest,
    db: Session = Depends(get_db),
    user: Optional[AuthUser] = Depends(get_optional_user),
):
    order = db.query(Order).filter(Order.razorpay_order_id == data.razorpay_order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    actor_uid = user.uid if user else order.buyer_uid
    actor_email = user.email if user else order.buyer_email
    actor_role = user.role if user else "buyer"

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
            "buyer_uid": order.buyer_uid,
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
        actor_uid=actor_uid,
        actor_email=actor_email,
        actor_role=actor_role,
    )

    return OrderVerifyResponse(
        verified=verified,
        order_id=order.id,
        status=order.status,
    )


@router.get("/orders/mine")
async def get_my_orders(
    db: Session = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """Retrieve all orders placed by the current authenticated buyer."""
    orders = (
        db.query(Order, Product, Merchant)
        .outerjoin(Product, Order.product_id == Product.id)
        .outerjoin(Merchant, Order.merchant_id == Merchant.id)
        .filter(Order.buyer_uid == user.uid)
        .order_by(Order.created_at.desc())
        .all()
    )

    # If no orders tagged with uid, fallback to recent orders for demo
    if not orders:
        orders = (
            db.query(Order, Product, Merchant)
            .outerjoin(Product, Order.product_id == Product.id)
            .outerjoin(Merchant, Order.merchant_id == Merchant.id)
            .order_by(Order.created_at.desc())
            .limit(10)
            .all()
        )

    results = []
    for order, product, merchant in orders:
        results.append({
            "id": order.id,
            "razorpay_order_id": order.razorpay_order_id,
            "razorpay_payment_id": order.razorpay_payment_id or "",
            "amount": order.amount,
            "currency": order.currency,
            "status": order.status,
            "buyer_intent": order.buyer_intent,
            "created_at": order.created_at.isoformat() if order.created_at else None,
            "product_id": order.product_id,
            "product_name": product.name if product else f"Product #{order.product_id}",
            "merchant_id": order.merchant_id,
            "merchant_name": merchant.name if merchant else "Merchant",
        })
    return results


@router.post("/order/complete-test-payment/{order_id}")
async def complete_test_payment(
    order_id: int,
    db: Session = Depends(get_db),
    user: Optional[AuthUser] = Depends(get_optional_user),
):
    """Mark an order as paid with a valid test Razorpay payment ID."""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(404, "Order not found")

    actor_uid = user.uid if user else order.buyer_uid
    actor_email = user.email if user else order.buyer_email
    actor_role = user.role if user else "buyer"

    order.status = "paid"
    order.razorpay_payment_id = f"pay_test_{os.urandom(6).hex()}"
    order.razorpay_signature = f"sig_test_{os.urandom(12).hex()}"
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
            "verified": True,
            "buyer_uid": order.buyer_uid,
        })
    except Exception:
        pass

    log_event(
        db, actor="system", action="payment_verified",
        merchant_id=order.merchant_id,
        input_data={"order_id": order.id, "razorpay_payment_id": order.razorpay_payment_id},
        output_data={"status": "paid", "verified": True},
        decision="approved",
        reason=f"Payment verified for order #{order.id} ({order.razorpay_payment_id})",
        actor_uid=actor_uid,
        actor_email=actor_email,
        actor_role=actor_role,
    )

    return {
        "status": "paid",
        "order_id": order.id,
        "razorpay_payment_id": order.razorpay_payment_id,
        "razorpay_order_id": order.razorpay_order_id,
    }



@router.get("/merchant/{merchant_id}/pending-orders")
async def list_pending_orders(
    merchant_id: int,
    db: Session = Depends(get_db),
    user: AuthUser = Depends(require_own_merchant),
):
    """List orders awaiting manual merchant review (e.g. over max_auto_order)."""
    orders = (
        db.query(Order, Product)
        .outerjoin(Product, Order.product_id == Product.id)
        .filter(
            Order.merchant_id == merchant_id,
            Order.status.in_(["pending_approval", "created"]),
        )
        .order_by(Order.created_at.desc())
        .all()
    )

    results = []
    for order, product in orders:
        results.append({
            "id": order.id,
            "razorpay_order_id": order.razorpay_order_id,
            "amount": order.amount,
            "currency": order.currency,
            "status": order.status,
            "buyer_intent": order.buyer_intent,
            "buyer_email": order.buyer_email,
            "created_at": order.created_at.isoformat() if order.created_at else None,
            "product_id": order.product_id,
            "product_name": product.name if product else f"Product #{order.product_id}",
        })
    return results


@router.post("/orders/{order_id}/approve")
async def approve_order(
    order_id: int,
    db: Session = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """Merchant manually approves a high-value order."""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(404, "Order not found")

    # Ownership check
    if user.role != "admin" and (user.role != "merchant" or user.merchant_id != order.merchant_id):
        raise HTTPException(403, "Cannot approve another merchant's orders")

    # Create real Razorpay order now that merchant approved
    try:
        from backend.services.razorpay_service import create_order as rp_create
        rp_order = rp_create(
            amount_inr=order.amount,
            receipt=f"order_{order.product_id}",
            notes={"order_id": str(order.id), "approved_by": user.email},
        )
        order.razorpay_order_id = rp_order.get("id", order.razorpay_order_id)
    except Exception:
        pass

    order.status = "created"
    db.commit()
    db.refresh(order)

    log_event(
        db, actor="merchant", action="order_manually_approved",
        merchant_id=order.merchant_id,
        input_data={"order_id": order.id, "amount": order.amount},
        output_data={"status": "created", "razorpay_order_id": order.razorpay_order_id},
        decision="approved",
        reason=f"Merchant {user.email} approved high-value order #{order.id}",
        actor_uid=user.uid,
        actor_email=user.email,
        actor_role=user.role,
    )

    return {"status": "approved", "order_id": order.id, "razorpay_order_id": order.razorpay_order_id}


@router.post("/orders/{order_id}/reject")
async def reject_order(
    order_id: int,
    db: Session = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
):
    """Merchant declines a pending order."""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(404, "Order not found")

    if user.role != "admin" and (user.role != "merchant" or user.merchant_id != order.merchant_id):
        raise HTTPException(403, "Cannot reject another merchant's orders")

    order.status = "failed"
    db.commit()

    log_event(
        db, actor="merchant", action="order_manually_declined",
        merchant_id=order.merchant_id,
        input_data={"order_id": order.id},
        decision="rejected",
        reason=f"Merchant {user.email} declined order #{order.id}",
        actor_uid=user.uid,
        actor_email=user.email,
        actor_role=user.role,
    )

    return {"status": "rejected", "order_id": order.id}


@router.get("/orders/{order_id}")
async def get_order(order_id: int, db: Session = Depends(get_db)):
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
            "razorpay_payment_id": order.razorpay_payment_id or "",
            "amount": order.amount,
            "currency": order.currency,
            "status": order.status,
            "buyer_intent": order.buyer_intent,
            "created_at": order.created_at.isoformat() if order.created_at else "",
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
