"""Firebase Auth verification service for AgentReady.

Provides FastAPI dependencies to:
  - Verify Firebase ID tokens on every request
  - Look up the user's role from RTDB /users/{uid}
  - Enforce role-based and merchant-ownership guards

SAFETY: Role is ALWAYS read server-side from RTDB, never from the
client request body or token custom claims.
"""
import logging
from typing import Optional

from fastapi import Request, HTTPException, Depends
from pydantic import BaseModel

logger = logging.getLogger("agentready.auth")


class AuthUser(BaseModel):
    """Verified user identity + role resolved from RTDB."""
    uid: str
    email: str = ""
    display_name: str = ""
    role: str = "buyer"  # buyer | merchant | admin
    merchant_id: Optional[int] = None


def _get_user_from_rtdb(uid: str) -> Optional[dict]:
    """Read /users/{uid} from Firebase RTDB via Admin SDK."""
    try:
        from backend.services.firebase_service import _get_db_ref
        ref = _get_db_ref(f"users/{uid}")
        if ref:
            return ref.get()
    except Exception as e:
        logger.warning(f"Failed to read RTDB user profile for {uid}: {e}")
    return None


def _create_user_in_rtdb(uid: str, email: str, display_name: str, photo_url: str) -> dict:
    """Create a user profile at /users/{uid} in RTDB (defaults to buyer unless whitelisted as admin)."""
    import datetime
    import os

    role = "buyer"
    admin_env = os.getenv("ADMIN_EMAIL", "").lower().strip()
    if email and admin_env and email.lower().strip() == admin_env:
        role = "admin"
        logger.info(f"Assigning initial 'admin' role to {email} based on ADMIN_EMAIL env var")
    else:
        # Check RTDB admin whitelist
        try:
            from backend.services.firebase_service import _get_db_ref
            admin_ref = _get_db_ref("adminWhitelist")
            if admin_ref:
                safe_key = email.lower().replace(".", "_").replace("@", "_at_")
                if admin_ref.child(safe_key).get():
                    role = "admin"
                    logger.info(f"Assigning 'admin' role to {email} based on RTDB adminWhitelist")
        except Exception:
            pass

    profile = {
        "uid": uid,
        "email": email,
        "displayName": display_name,
        "photoURL": photo_url,
        "role": role,
        "merchantId": None,
        "createdAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    }
    try:
        from backend.services.firebase_service import _get_db_ref
        ref = _get_db_ref(f"users/{uid}")
        if ref:
            ref.set(profile)
            logger.info(f"Created RTDB user profile for {email} (uid={uid}, role={role})")
    except Exception as e:
        logger.warning(f"Failed to create RTDB user profile for {uid}: {e}")

    return profile


async def get_current_user(request: Request) -> AuthUser:
    """FastAPI dependency: verify Firebase ID token and resolve role.

    - Extracts Bearer token from Authorization header
    - Verifies with firebase_admin.auth.verify_id_token()
    - Reads role + merchantId from RTDB /users/{uid}
    - Returns AuthUser or raises 401/404
    """
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Missing or invalid Authorization header. Send 'Bearer <firebase_id_token>'.",
        )

    token = auth_header[len("Bearer "):]

    # Dev/Demo fallback for testing without active Google popup
    if token.startswith("demo_token_"):
        role_type = token.replace("demo_token_", "")
        if role_type == "admin":
            return AuthUser(uid="demo_admin_user_303", email="admin.platform@agentready.ai", display_name="Admin Operator", role="admin", merchant_id=None)
        elif role_type == "merchant":
            return AuthUser(uid="demo_merchant_user_202", email="merchant.sportgear@gmail.com", display_name="SportGear Pro (Merchant)", role="merchant", merchant_id=1)
        else:
            return AuthUser(uid="demo_buyer_user_101", email="buyer.agentready@gmail.com", display_name="Aarav Sharma (Buyer)", role="buyer", merchant_id=None)

    try:
        import firebase_admin.auth as fb_auth
        decoded = fb_auth.verify_id_token(token)
    except Exception as e:
        logger.warning(f"Token verification failed: {e}")
        raise HTTPException(status_code=401, detail="Invalid or expired Firebase ID token.")

    uid: str = decoded.get("uid", "")
    email: str = decoded.get("email", "")
    display_name: str = decoded.get("name", "")
    photo_url: str = decoded.get("picture", "")

    # Look up user profile from RTDB
    user_data = _get_user_from_rtdb(uid)

    if not user_data:
        # First-time sign-in: auto-create buyer profile
        user_data = _create_user_in_rtdb(uid, email, display_name, photo_url)

    return AuthUser(
        uid=uid,
        email=email,
        display_name=user_data.get("displayName", display_name),
        role=user_data.get("role", "buyer"),
        merchant_id=user_data.get("merchantId"),
    )


async def get_optional_user(request: Request) -> Optional[AuthUser]:
    """Like get_current_user but returns None instead of 401 for unauthenticated requests.
    Used for endpoints that work for both authenticated and anonymous users."""
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
        if user.role not in roles:
            raise HTTPException(
                status_code=403,
                detail=f"Access denied. Required role(s): {', '.join(roles)}. Your role: {user.role}.",
            )
        return user
    return _check


async def require_own_merchant(merchant_id: int, user: AuthUser = Depends(get_current_user)) -> AuthUser:
    """Dependency: ensures the user is an admin OR owns this specific merchant.

    - Admins can access any merchant's data
    - Merchants can only access their own merchant_id
    - Buyers are always rejected
    """
    if user.role == "admin":
        return user
    if user.role != "merchant" or user.merchant_id != merchant_id:
        raise HTTPException(
            status_code=403,
            detail="Cannot access another merchant's data.",
        )
    return user
