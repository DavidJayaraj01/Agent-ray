"""Merchant approval and network management endpoints."""
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional

from backend.database import get_db
from backend.models import Merchant
from backend.services.auth_service import require_role, AuthUser
from backend.services.audit_service import log_event

logger = logging.getLogger("agentready.merchant_approvals")
router = APIRouter(prefix="/api/admin", tags=["admin"])

_require_merchant = require_role("merchant", "admin")


@router.get("/applications")
async def list_merchant_applications(user: AuthUser = Depends(_require_merchant)):
    """List all pending merchant applications from RTDB."""
    try:
        from backend.services.firebase_service import _get_db_ref
        ref = _get_db_ref("merchantApplications")
        if ref:
            all_apps = ref.get() or {}
            result = []
            for uid, app_data in all_apps.items():
                if isinstance(app_data, dict):
                    result.append({
                        "uid": uid,
                        "email": app_data.get("email", ""),
                        "displayName": app_data.get("displayName", ""),
                        "businessName": app_data.get("businessName", ""),
                        "category": app_data.get("category", ""),
                        "description": app_data.get("description", ""),
                        "catalogUrl": app_data.get("catalogUrl", ""),
                        "status": app_data.get("status", "pending"),
                        "createdAt": app_data.get("createdAt", ""),
                    })
            return result
    except Exception as e:
        logger.error(f"Failed to list applications: {e}")
        raise HTTPException(500, "Failed to retrieve applications.")


@router.post("/approve-merchant/{uid}")
async def approve_merchant(
    uid: str,
    db: Session = Depends(get_db),
    user: AuthUser = Depends(_require_merchant),
):
    """Approve a merchant application.

    1. Creates a Merchant record in SQLite
    2. Updates /users/{uid} in RTDB: role → merchant, merchantId → new ID
    3. Updates /merchantApplications/{uid}: status → approved
    """
    from backend.services.firebase_service import _get_db_ref

    # Read the application
    app_ref = _get_db_ref(f"merchantApplications/{uid}")
    app_data = app_ref.get() if app_ref else None

    if not app_data:
        raise HTTPException(404, "Merchant application not found.")

    business_name = app_data.get("businessName", "New Merchant")
    category = app_data.get("category", "General")
    email = app_data.get("email", "")

    # Create Merchant in SQLite
    merchant = Merchant(
        name=business_name,
        category=category,
        api_key=f"ar_live_{uid[:16]}",
        webhook_secret=f"whsec_{uid[:16]}",
        policy_rules={
            "max_discount": 15.0,
            "min_price": 500.0,
            "max_auto_order": 250000.0,
            "negotiation_enabled": True,
            "max_attempts": 3,
        },
        trust_score=75.0,
        owner_uid=uid,
    )
    db.add(merchant)
    db.commit()
    db.refresh(merchant)

    # Update application status in RTDB
    if app_ref:
        app_ref.update({
            "status": "approved",
            "approvedAt": app_data.get("createdAt", ""),
            "merchantId": merchant.id,
        })

    # Elevate user role in RTDB
    user_ref = _get_db_ref(f"users/{uid}")
    if user_ref:
        user_ref.update({
            "role": "merchant",
            "merchantId": merchant.id,
        })

    # Audit log
    log_event(
        db,
        actor="merchant_operator",
        action="merchant_approved",
        merchant_id=merchant.id,
        input_data={"applicant_uid": uid, "business_name": business_name, "category": category},
        output_data={"merchant_id": merchant.id, "status": "approved"},
        decision="approved",
        reason=f"Merchant application approved by {user.email}: {business_name} (ID: {merchant.id})",
        actor_uid=user.uid,
        actor_email=user.email,
        actor_role=user.role,
    )

    return {
        "status": "approved",
        "merchant_id": merchant.id,
        "business_name": business_name,
        "uid": uid,
    }


@router.post("/reject-merchant/{uid}")
async def reject_merchant(
    uid: str,
    reason: Optional[str] = None,
    db: Session = Depends(get_db),
    user: AuthUser = Depends(_require_merchant),
):
    """Reject a merchant application."""
    from backend.services.firebase_service import _get_db_ref

    app_ref = _get_db_ref(f"merchantApplications/{uid}")
    app_data = app_ref.get() if app_ref else None

    if not app_data:
        raise HTTPException(404, "Merchant application not found.")

    if app_ref:
        app_ref.update({
            "status": "rejected",
            "rejectionReason": reason or "Application does not meet platform criteria.",
        })

    log_event(
        db,
        actor="merchant_operator",
        action="merchant_rejected",
        merchant_id=None,
        input_data={"applicant_uid": uid, "reason": reason},
        output_data={"status": "rejected"},
        decision="rejected",
        reason=f"Application for {app_data.get('businessName')} rejected by {user.email}: {reason}",
        actor_uid=user.uid,
        actor_email=user.email,
        actor_role=user.role,
    )

    return {"status": "rejected", "uid": uid, "reason": reason}


@router.get("/users")
async def list_all_users(user: AuthUser = Depends(_require_merchant)):
    """List all registered users from Firebase RTDB."""
    try:
        from backend.services.firebase_service import _get_db_ref
        ref = _get_db_ref("users")
        if ref:
            users_dict = ref.get() or {}
            result = []
            for uid, udata in users_dict.items():
                if isinstance(udata, dict):
                    result.append({
                        "uid": uid,
                        "email": udata.get("email", ""),
                        "displayName": udata.get("displayName", ""),
                        "role": udata.get("role", "buyer"),
                        "merchantId": udata.get("merchantId"),
                        "createdAt": udata.get("createdAt", ""),
                    })
            return result
    except Exception as e:
        logger.error(f"Failed to list users: {e}")
        raise HTTPException(500, "Failed to retrieve user list.")
