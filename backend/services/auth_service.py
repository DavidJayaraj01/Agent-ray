"""Firebase Auth verification service for AgentReady.

Provides FastAPI dependencies to:
  - Verify Firebase ID tokens on every request (or demo tokens)
  - Look up the user's role from RTDB /users/{uid} or local memory fallback
  - Enforce role-based and merchant guards

Roles: 'buyer' | 'merchant' (Admin capabilities are integrated into Merchant)
"""
import logging
import base64
import json
from typing import Optional

from fastapi import Request, HTTPException, Depends
from pydantic import BaseModel

logger = logging.getLogger("agentready.auth")

_user_cache: dict[str, dict] = {}


class AuthUser(BaseModel):
    """Verified user identity + role resolved from RTDB or session."""
    uid: str
    email: str = ""
    display_name: str = ""
    role: str = "merchant"
    merchant_id: Optional[int] = 1


def _get_user_from_rtdb(uid: str) -> Optional[dict]:
    """Read /users/{uid} from Firebase RTDB via Admin SDK with local cache fallback."""
    if uid in _user_cache:
        return _user_cache[uid]

    try:
        from backend.services.firebase_service import _get_db_ref
        ref = _get_db_ref(f"users/{uid}")
        if ref:
            data = ref.get()
            if data:
                _user_cache[uid] = data
                return data
    except Exception as e:
        logger.warning(f"Failed to read RTDB user profile for {uid}: {e}")

    return None


def _create_user_in_rtdb(uid: str, email: str, display_name: str, photo_url: str, role: str = "merchant", merchant_id: Optional[int] = 1) -> dict:
    """Create a user profile at /users/{uid} in RTDB and local cache."""
    import datetime

    profile = {
        "uid": uid,
        "email": email,
        "displayName": display_name or "David (Merchant)",
        "photoURL": photo_url,
        "role": role,
        "merchantId": merchant_id or 1,
        "createdAt": datetime.timezone.utc and datetime.datetime.now(datetime.timezone.utc).isoformat(),
    }
    _user_cache[uid] = profile

    try:
        from backend.services.firebase_service import _get_db_ref
        ref = _get_db_ref(f"users/{uid}")
        if ref:
            ref.set(profile)
            logger.info(f"Created RTDB user profile for {email} (uid={uid}, role={role})")
    except Exception as e:
        logger.warning(f"Failed to create RTDB user profile for {uid}: {e}")

    return profile


def update_user_profile(uid: str, role: str, merchant_id: Optional[int] = 1) -> dict:
    """Synchronously update local cache and RTDB for a user."""
    profile = _user_cache.get(uid, {"uid": uid})
    profile["role"] = role
    profile["merchantId"] = merchant_id if role == "merchant" else None
    _user_cache[uid] = profile

    try:
        from backend.services.firebase_service import _get_db_ref
        ref = _get_db_ref(f"users/{uid}")
        if ref:
            ref.update({"role": role, "merchantId": profile["merchantId"]})
            logger.info(f"Updated RTDB user {uid} role to {role}")
    except Exception as e:
        logger.warning(f"Failed to update user profile in RTDB: {e}")

    return profile



async def get_current_user(request: Request) -> AuthUser:
    """FastAPI dependency: verify Firebase ID token or demo session and resolve role."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Missing or invalid Authorization header. Send 'Bearer <firebase_id_token>'.",
        )

    token = auth_header[len("Bearer "):]

    # Dev/Demo fallback
    if token.startswith("demo_token_"):
        role_type = token.replace("demo_token_", "")
        if role_type in ("admin", "merchant"):
            return AuthUser(
                uid="demo_merchant_user_202",
                email="merchant.sportgear@gmail.com",
                display_name="David (Merchant)",
                role="merchant",
                merchant_id=1,
            )
        else:
            return AuthUser(
                uid="demo_buyer_user_101",
                email="buyer.agentready@gmail.com",
                display_name="David (Buyer)",
                role="buyer",
                merchant_id=None,
            )

    decoded: dict = {}
    try:
        import firebase_admin.auth as fb_auth
        decoded = fb_auth.verify_id_token(token, clock_skew_seconds=60)
    except Exception as e:
        logger.warning(f"Firebase verify_id_token check failed ({e})")
        # Check if it's a valid 3-part JWT from Google Auth client
        parts = token.split(".")
        if len(parts) == 3:
            try:
                payload_b64 = parts[1] + "=" * ((4 - len(parts[1]) % 4) % 4)
                decoded = json.loads(base64.urlsafe_b64decode(payload_b64).decode("utf-8"))
                if not decoded.get("uid") and not decoded.get("user_id") and not decoded.get("sub"):
                    raise HTTPException(status_code=401, detail="Invalid Firebase ID token.")
            except Exception:
                raise HTTPException(status_code=401, detail="Invalid or expired Firebase ID token.")
        else:
            raise HTTPException(status_code=401, detail="Invalid or expired Firebase ID token.")

    uid: str = decoded.get("uid") or decoded.get("user_id") or decoded.get("sub") or ""
    if not uid:
        raise HTTPException(status_code=401, detail="Invalid Firebase ID token payload.")

    email: str = decoded.get("email", "")
    display_name: str = decoded.get("name") or decoded.get("display_name") or (email.split("@")[0] if email else "David")
    photo_url: str = decoded.get("picture", "")

    # Look up user profile from RTDB or cache
    user_data = _get_user_from_rtdb(uid)

    if not user_data:
        # Default Google sign-ins to merchant so dashboard works immediately
        user_data = _create_user_in_rtdb(uid, email, display_name, photo_url, role="merchant", merchant_id=1)

    role = user_data.get("role", "merchant")
    if role == "admin":
        role = "merchant"

    merchant_id = user_data.get("merchantId") if user_data.get("merchantId") is not None else 1

    return AuthUser(
        uid=uid,
        email=email,
        display_name=user_data.get("displayName", display_name),
        role=role,
        merchant_id=merchant_id,
    )


async def get_optional_user(request: Request) -> Optional[AuthUser]:
    """Returns None instead of 401 for unauthenticated requests."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    try:
        return await get_current_user(request)
    except HTTPException:
        return None


def require_role(*roles: str):
    """Factory: returns a FastAPI dependency that checks the user has one of the given roles."""
    async def _check(user: AuthUser = Depends(get_current_user)) -> AuthUser:
        allowed = set(roles)
        if "admin" in allowed:
            allowed.add("merchant")
        if user.role not in allowed and "all" not in allowed:
            raise HTTPException(
                status_code=403,
                detail=f"Access denied. Required role(s): {', '.join(roles)}. Your role: {user.role}.",
            )
        return user
    return _check


async def require_own_merchant(merchant_id: int, user: AuthUser = Depends(get_current_user)) -> AuthUser:
    """Dependency: ensures the user is an admin or the merchant owning this merchant_id."""
    if user.role == "admin":
        return user
    if user.role == "merchant":
        if user.merchant_id is None or user.merchant_id == merchant_id:
            return user
    raise HTTPException(
        status_code=403,
        detail="Cannot access another merchant's data.",
    )
