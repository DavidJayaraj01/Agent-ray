"""Seed an Admin Account in Firebase Realtime Database.

Usage:
  python -m backend.scripts.seed_admin <google_email_or_uid>

Or set ADMIN_EMAIL in .env and run:
  python -m backend.scripts.seed_admin
"""
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Load env
_backend_dir = Path(__file__).parent.parent
load_dotenv(_backend_dir / ".env")
load_dotenv()

from backend.services.firebase_service import init_firebase, _get_db_ref


def seed_admin(target_identifier: str):
    print(f"Initializing Firebase Admin SDK...")
    app = init_firebase()
    if not app:
        print("ERROR: Failed to initialize Firebase Admin SDK. Check firebase-credentials.json.")
        sys.exit(1)

    import firebase_admin.auth as fb_auth

    uid = None
    email = None

    # Check if target is email or uid
    if "@" in target_identifier:
        email = target_identifier.lower().strip()
        try:
            user_record = fb_auth.get_user_by_email(email)
            uid = user_record.uid
            print(f"Found existing Firebase Auth user: UID={uid}, Email={email}")
        except Exception:
            print(f"Note: User '{email}' has not signed into Firebase Auth yet.")
            print(f"Creating pre-seeded RTDB admin profile keyed by email lookup...")
            # We can seed in RTDB using a sanitized key or when they log in
    else:
        uid = target_identifier
        try:
            user_record = fb_auth.get_user(uid)
            email = user_record.email
        except Exception:
            pass

    ref = _get_db_ref("users")
    if not ref:
        print("ERROR: Could not get reference to RTDB /users")
        sys.exit(1)

    if uid:
        user_ref = ref.child(uid)
        current = user_ref.get() or {}
        user_ref.update({
            "role": "admin",
            "email": email or current.get("email", ""),
            "updatedAt": __import__("datetime").datetime.now(
                __import__("datetime").timezone.utc
            ).isoformat(),
        })
        print(f"SUCCESS: User '{uid}' ({email}) elevated to 'admin' in RTDB at /users/{uid}!")
    else:
        # If UID not known yet, check all RTDB users by email or store in admin_whitelist
        all_users = ref.get() or {}
        found = False
        for u_id, u_data in all_users.items():
            if isinstance(u_data, dict) and u_data.get("email", "").lower() == email:
                ref.child(u_id).update({"role": "admin"})
                print(f"SUCCESS: Found RTDB record for '{email}' (UID={u_id}). Elevated to 'admin'!")
                found = True
                break

        if not found:
            # Seed under admin_emails in RTDB
            admin_emails_ref = _get_db_ref("adminWhitelist")
            if admin_emails_ref:
                safe_key = email.replace(".", "_").replace("@", "_at_")
                admin_emails_ref.child(safe_key).set({"email": email, "role": "admin"})
                print(f"SUCCESS: Added '{email}' to RTDB /adminWhitelist. Will auto-elevate on first login.")


if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else os.getenv("ADMIN_EMAIL")
    if not target:
        print("Please provide a Google email address or UID:")
        print("  python -m backend.scripts.seed_admin your.email@gmail.com")
        sys.exit(1)

    seed_admin(target)
