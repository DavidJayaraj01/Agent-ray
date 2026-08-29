"""Auth + user registration endpoints."""
import datetime
import logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from backend.services.auth_service import get_current_user, get_optional_user, AuthUser, _get_user_from_rtdb

logger = logging.getLogger("agentready.auth_routes")
router = APIRouter(prefix="/api/auth", tags=["auth"])



class RegisterResponse(BaseModel):
    uid: str
    email: str
    role: str
    merchant_id: Optional[int] = None
    display_name: str = ""
    is_new: bool = False


class MerchantApplicationRequest(BaseModel):
    business_name: str
    category: str = "General"
    description: str = ""
    catalog_url: str = ""


class MerchantApplicationResponse(BaseModel):
    uid: str
    status: str
    business_name: str
    created_at: str


@router.post("/register", response_model=RegisterResponse)
async def register_or_get_profile(user: AuthUser = Depends(get_current_user)):
    """Called after Google sign-in to ensure user profile exists in RTDB.

    The get_current_user dependency already auto-creates the profile on first
    sign-in, so this endpoint just returns the resolved user.
    """
    return RegisterResponse(
        uid=user.uid,
        email=user.email,
        role=user.role,
        merchant_id=user.merchant_id,
        display_name=user.display_name,
        is_new=False,
    )


@router.get("/me", response_model=RegisterResponse)
async def get_my_profile(user: AuthUser = Depends(get_current_user)):
    """Return the current user's profile."""
    return RegisterResponse(
        uid=user.uid,
        email=user.email,
        role=user.role,
        merchant_id=user.merchant_id,
        display_name=user.display_name,
    )


@router.post("/apply-merchant", response_model=MerchantApplicationResponse)
async def apply_as_merchant(
    data: MerchantApplicationRequest,
    user: AuthUser = Depends(get_current_user),
):
    """Buyer submits a merchant application. Creates /merchantApplications/{uid}
    in RTDB with status=pending. Admin must approve to elevate role."""
    if user.role == "merchant":
        raise HTTPException(400, "You are already a merchant.")
    if user.role == "admin":
        raise HTTPException(400, "Admins cannot apply as merchants.")

    # Check if already applied
    try:
        from backend.services.firebase_service import _get_db_ref
        ref = _get_db_ref(f"merchantApplications/{user.uid}")
        existing = ref.get() if ref else None
        if existing and existing.get("status") == "pending":
            return MerchantApplicationResponse(
                uid=user.uid,
                status="pending",
                business_name=existing.get("businessName", data.business_name),
                created_at=existing.get("createdAt", ""),
            )
    except Exception:
        pass

    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    application = {
        "uid": user.uid,
        "email": user.email,
        "displayName": user.display_name,
        "businessName": data.business_name,
        "category": data.category,
        "description": data.description,
        "catalogUrl": data.catalog_url,
        "status": "pending",
        "createdAt": now,
    }

    try:
        from backend.services.firebase_service import _get_db_ref
        ref = _get_db_ref(f"merchantApplications/{user.uid}")
        if ref:
            ref.set(application)
    except Exception as e:
        logger.error(f"Failed to save merchant application: {e}")
        raise HTTPException(500, "Failed to submit application.")

    return MerchantApplicationResponse(
        uid=user.uid,
        status="pending",
        business_name=data.business_name,
        created_at=now,
    )


@router.get("/application-status")
async def get_application_status(user: Optional[AuthUser] = Depends(get_optional_user)):
    """Check the current user's merchant application status."""
    if not user:
        return {"status": "none"}

    try:
        from backend.services.firebase_service import _get_db_ref
        ref = _get_db_ref(f"merchantApplications/{user.uid}")
        if ref:
            data = ref.get()
            if data:
                return {
                    "status": data.get("status", "unknown"),
                    "business_name": data.get("businessName", ""),
                    "created_at": data.get("createdAt", ""),
                    "rejection_reason": data.get("rejectionReason"),
                }
    except Exception:
        pass
    return {"status": "none"}

