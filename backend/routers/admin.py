"""Admin-only endpoints — merchant approval, user management."""
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional

from backend.database import get_db
from backend.models import Merchant
from backend.services.auth_service import get_current_user, require_role, AuthUser
from backend.services.audit_service import log_event

logger = logging.getLogger("agentready.admin")
router = APIRouter(prefix="/api/admin", tags=["admin"])

_require_admin = require_role("admin")


@router.get("/applications")
async def list_merchant_applications(user: AuthUser = Depends(_require_admin)):
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
    user: AuthUser = Depends(_require_admin),
):
    """Admin approves a merchant application.

    1. Creates a Merchant record in SQLite
    2. Updates /users/{uid} in RTDB: role → merchant, merchantId → new ID
    3. Updates /merchantApplications/{uid}: status → approved
    """
    from backend.services.firebase_service import _get_db_ref

    # Read the application
    try:
        ref = _get_db_ref(f"merchantApplications/{uid}")
        app_data = ref.get() if ref else None
    except Exception:
        app_data = None

    if not app_data:
        raise HTTPException(404, "Merchant application not found.")
    if app_data.get("status") == "approved":
        raise HTTPException(400, "Application already approved.")

    # Create merchant in SQLite
    merchant = Merchant(
        name=app_data.get("businessName", "Unnamed Merchant"),
        category=app_data.get("category", "General"),
        raw_catalog_url=app_data.get("catalogUrl", ""),
        status="active",
        policy_rules={
            "max_discount": 10,
            "min_price": 100,
            "max_auto_order": 50000,
            "negotiation_enabled": True,
        },
    )
    db.add(merchant)
    db.commit()
    db.refresh(merchant)

    # Sync merchant to Firebase
    try:
        from backend.services.firebase_service import sync_merchant_to_firebase
        sync_merchant_to_firebase({
            "id": merchant.id,
            "name": merchant.name,
            "category": merchant.category,
            "trust_score": merchant.trust_score,
            "status": merchant.status,
            "policy_rules": merchant.policy_rules,
            "created_at": merchant.created_at.isoformat() if merchant.created_at else None,
        })
    except Exception:
        pass

    # Update RTDB user profile: role → merchant, merchantId → new ID
    try:
        user_ref = _get_db_ref(f"users/{uid}")
        if user_ref:
            user_ref.update({
                "role": "merchant",
                "merchantId": merchant.id,
            })
    except Exception as e:
        logger.error(f"Failed to update user role in RTDB: {e}")

    # Update application status
    try:
        app_ref = _get_db_ref(f"merchantApplications/{uid}")
        if app_ref:
            app_ref.update({
                "status": "approved",
                "merchantId": merchant.id,
                "approvedBy": user.uid,
                "approvedAt": __import__("datetime").datetime.now(
                    __import__("datetime").timezone.utc
                ).isoformat(),
            })
    except Exception:
        pass

    # Audit log
    log_event(
        db,
        actor="admin",
        action="merchant_application_approved",
        merchant_id=merchant.id,
        input_data={
            "applicant_uid": uid,
            "business_name": app_data.get("businessName"),
        },
        output_data={"merchant_id": merchant.id},
        decision="approved",
        reason=f"Admin {user.email} approved merchant application for {app_data.get('businessName')}",
        actor_uid=user.uid,
        actor_email=user.email,
        actor_role=user.role,
    )

    return {
        "status": "approved",
        "merchant_id": merchant.id,
        "message": f"Merchant '{merchant.name}' created and role assigned.",
    }


@router.post("/reject-merchant/{uid}")
async def reject_merchant(
    uid: str,
    reason: str = "Application did not meet requirements.",
    db: Session = Depends(get_db),
    user: AuthUser = Depends(_require_admin),
):
    """Admin rejects a merchant application."""
    from backend.services.firebase_service import _get_db_ref

    try:
        ref = _get_db_ref(f"merchantApplications/{uid}")
        app_data = ref.get() if ref else None
    except Exception:
        app_data = None

    if not app_data:
        raise HTTPException(404, "Merchant application not found.")

    try:
        ref = _get_db_ref(f"merchantApplications/{uid}")
        if ref:
            ref.update({
                "status": "rejected",
                "rejectionReason": reason,
                "rejectedBy": user.uid,
                "rejectedAt": __import__("datetime").datetime.now(
                    __import__("datetime").timezone.utc
                ).isoformat(),
            })
    except Exception as e:
        logger.error(f"Failed to update application status: {e}")
        raise HTTPException(500, "Failed to reject application.")

    log_event(
        db,
        actor="admin",
        action="merchant_application_rejected",
        input_data={
            "applicant_uid": uid,
            "business_name": app_data.get("businessName"),
            "reason": reason,
        },
        decision="rejected",
        reason=f"Admin {user.email} rejected merchant application: {reason}",
        actor_uid=user.uid,
        actor_email=user.email,
        actor_role=user.role,
    )

    return {"status": "rejected", "reason": reason}


@router.get("/users")
async def list_all_users(user: AuthUser = Depends(_require_admin)):
    """List all registered users from RTDB."""
    try:
        from backend.services.firebase_service import _get_db_ref
        ref = _get_db_ref("users")
        if ref:
            all_users = ref.get() or {}
            result = []
            for uid, u_data in all_users.items():
                if isinstance(u_data, dict):
                    result.append({
                        "uid": uid,
                        "email": u_data.get("email", ""),
                        "displayName": u_data.get("displayName", ""),
                        "role": u_data.get("role", "buyer"),
                        "merchantId": u_data.get("merchantId"),
                        "createdAt": u_data.get("createdAt", ""),
                    })
            return result
    except Exception as e:
        logger.error(f"Failed to list users: {e}")
        raise HTTPException(500, "Failed to retrieve users.")
