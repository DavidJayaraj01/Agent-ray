"""Firebase Admin SDK Service for Agent-Ray.

Handles initialization, connection status checks, and data synchronization
using the service account credentials and Realtime Database.
"""
import json
import logging
import os
from pathlib import Path
from typing import Any, Dict, Optional

logger = logging.getLogger("agentready.firebase")

_firebase_app = None
_init_error: Optional[str] = None
_credentials_resolved_path: Optional[str] = None
_project_id: Optional[str] = None
_client_email: Optional[str] = None
_database_url: Optional[str] = None


def _resolve_credentials_path() -> Optional[Path]:
    """Find the Firebase credentials file from env or default locations."""
    env_path = os.getenv("FIREBASE_CREDENTIALS_PATH", "firebase-credentials.json")
    
    search_paths = [
        Path(env_path),
        Path(__file__).parent.parent / env_path,
        Path(__file__).parent.parent / "firebase-credentials.json",
        Path.cwd() / "backend" / "firebase-credentials.json",
        Path.cwd() / "firebase-credentials.json",
    ]
    
    for path in search_paths:
        if path.is_file():
            return path.resolve()
    return None


def init_firebase() -> Optional[Any]:
    """Initialize the Firebase Admin SDK.
    
    Safe to call multiple times (idempotent singleton).
    Never raises an unhandled exception to prevent breaking the application.
    """
    global _firebase_app, _init_error, _credentials_resolved_path, _project_id, _client_email, _database_url

    try:
        import firebase_admin
        from firebase_admin import credentials
    except ImportError as e:
        _init_error = f"firebase-admin library not installed: {e}"
        logger.warning(_init_error)
        return None

    # Load database URL from env
    _database_url = os.getenv(
        "FIREBASE_DATABASE_URL",
        "https://agent-ray-default-rtdb.asia-southeast1.firebasedatabase.app"
    )

    # Re-use existing default app if already initialized
    try:
        _firebase_app = firebase_admin.get_app()
        return _firebase_app
    except (ValueError, Exception):
        pass

    cred_path = _resolve_credentials_path()
    if not cred_path:
        _init_error = "Firebase credentials file not found. Place firebase-credentials.json in backend/."
        logger.warning(_init_error)
        return None

    _credentials_resolved_path = str(cred_path)

    try:
        with open(cred_path, "r", encoding="utf-8") as f:
            cred_data = json.load(f)
            _project_id = cred_data.get("project_id", "agent-ray")
            _client_email = cred_data.get("client_email")

        cred = credentials.Certificate(str(cred_path))
        options: Dict[str, Any] = {}
        
        if _database_url:
            options["databaseURL"] = _database_url

        storage_bucket = os.getenv("FIREBASE_STORAGE_BUCKET")
        if storage_bucket:
            options["storageBucket"] = storage_bucket

        _firebase_app = firebase_admin.initialize_app(cred, options if options else None)
        _init_error = None
        logger.info(f"Firebase Admin SDK initialized successfully for project '{_project_id}' with RTDB: {_database_url}")
        return _firebase_app

    except Exception as e:
        _init_error = f"Failed to initialize Firebase: {e}"
        logger.error(_init_error)
        return None


def get_firebase_app() -> Optional[Any]:
    """Get the initialized Firebase app instance."""
    global _firebase_app
    if _firebase_app is None:
        init_firebase()
    return _firebase_app


def is_firebase_connected() -> bool:
    """Check if Firebase is initialized and active."""
    app = get_firebase_app()
    return app is not None


def get_firebase_status() -> Dict[str, Any]:
    """Return comprehensive Firebase connection diagnostics."""
    app = get_firebase_app()
    connected = app is not None

    status: Dict[str, Any] = {
        "connected": connected,
        "project_id": _project_id or os.getenv("FIREBASE_PROJECT_ID", "agent-ray"),
        "client_email": _client_email,
        "credentials_path": _credentials_resolved_path,
        "database_url": _database_url,
        "app_name": app.name if app else None,
        "error": _init_error,
        "features": {
            "admin_sdk": connected,
            "realtime_database": bool(_database_url),
            "storage": bool(os.getenv("FIREBASE_STORAGE_BUCKET")),
        }
    }
    return status


# ─── REALTIME DATABASE DATA SYNCHRONIZATION HELPERS ─────────────

def _get_db_ref(path: str = "/"):
    """Get a Firebase Realtime Database reference safely."""
    app = get_firebase_app()
    if not app:
        return None
    try:
        from firebase_admin import db
        return db.reference(path, app=app)
    except Exception as e:
        logger.debug(f"Failed to get Firebase DB reference for '{path}': {e}")
        return None


def sync_audit_to_firebase(audit_entry: Dict[str, Any]) -> bool:
    """Sync an audit log event to Firebase Realtime Database (/audit_logs/{id})."""
    try:
        ref = _get_db_ref("audit_logs")
        if ref:
            entry_id = str(audit_entry.get("id") or ref.push().key)
            ref.child(entry_id).set(audit_entry)
            return True
    except Exception as e:
        logger.debug(f"Firebase audit sync error: {e}")
    return False


def sync_merchant_to_firebase(merchant_entry: Dict[str, Any]) -> bool:
    """Sync a merchant record to Firebase Realtime Database (/merchants/{id})."""
    try:
        ref = _get_db_ref("merchants")
        if ref:
            m_id = str(merchant_entry.get("id"))
            ref.child(m_id).set(merchant_entry)
            return True
    except Exception as e:
        logger.debug(f"Firebase merchant sync error: {e}")
    return False


def sync_product_to_firebase(product_entry: Dict[str, Any]) -> bool:
    """Sync a product record to Firebase Realtime Database (/products/{id})."""
    try:
        ref = _get_db_ref("products")
        if ref:
            p_id = str(product_entry.get("id"))
            ref.child(p_id).set(product_entry)
            return True
    except Exception as e:
        logger.debug(f"Firebase product sync error: {e}")
    return False


def sync_order_to_firebase(order_entry: Dict[str, Any]) -> bool:
    """Sync an order record to Firebase Realtime Database (/orders/{id})."""
    try:
        ref = _get_db_ref("orders")
        if ref:
            o_id = str(order_entry.get("id"))
            ref.child(o_id).set(order_entry)
            return True
    except Exception as e:
        logger.debug(f"Firebase order sync error: {e}")
    return False


def sync_negotiation_to_firebase(negotiation_entry: Dict[str, Any]) -> bool:
    """Sync a negotiation record to Firebase Realtime Database (/negotiations/{id})."""
    try:
        ref = _get_db_ref("negotiations")
        if ref:
            n_id = str(negotiation_entry.get("id"))
            ref.child(n_id).set(negotiation_entry)
            return True
    except Exception as e:
        logger.debug(f"Firebase negotiation sync error: {e}")
    return False


def sync_all_data_to_firebase(db_session) -> Dict[str, int]:
    """Sync all existing SQLite records to Firebase Realtime Database."""
    from backend.models import Merchant, Product, Manifest, Order, Negotiation, AuditLog

    counts = {
        "merchants": 0,
        "products": 0,
        "manifests": 0,
        "orders": 0,
        "negotiations": 0,
        "audit_logs": 0,
    }

    if not is_firebase_connected():
        logger.warning("Firebase not connected, skipping full sync.")
        return counts

    try:
        root_ref = _get_db_ref("/")
        if not root_ref:
            return counts

        # 1. Sync Merchants
        merchants = db_session.query(Merchant).all()
        merchants_data = {}
        for m in merchants:
            merchants_data[str(m.id)] = {
                "id": m.id,
                "name": m.name,
                "category": m.category,
                "trust_score": m.trust_score,
                "status": m.status,
                "policy_rules": m.policy_rules,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
        if merchants_data:
            root_ref.child("merchants").update(merchants_data)
            counts["merchants"] = len(merchants_data)

        # 2. Sync Products
        products = db_session.query(Product).all()
        products_data = {}
        for p in products:
            products_data[str(p.id)] = {
                "id": p.id,
                "merchant_id": p.merchant_id,
                "name": p.name,
                "price": p.price,
                "stock": p.stock,
                "category": p.category,
                "delivery_days": p.delivery_days,
                "return_policy": p.return_policy,
                "confidence_flags": p.confidence_flags,
                "needs_verification": p.needs_verification,
            }
        if products_data:
            root_ref.child("products").update(products_data)
            counts["products"] = len(products_data)

        # 3. Sync Manifests
        manifests = db_session.query(Manifest).all()
        manifests_data = {}
        for mf in manifests:
            manifests_data[str(mf.merchant_id)] = {
                "id": mf.id,
                "merchant_id": mf.merchant_id,
                "generated_at": mf.generated_at.isoformat() if mf.generated_at else None,
                "completeness_score": mf.completeness_score,
                "raw_product_count": mf.raw_product_count,
                "normalized_product_count": mf.normalized_product_count,
                "flagged_count": mf.flagged_count,
                "product_ids": mf.product_ids,
            }
        if manifests_data:
            root_ref.child("manifests").update(manifests_data)
            counts["manifests"] = len(manifests_data)

        # 4. Sync Orders
        orders = db_session.query(Order).all()
        orders_data = {}
        for o in orders:
            orders_data[str(o.id)] = {
                "id": o.id,
                "merchant_id": o.merchant_id,
                "product_id": o.product_id,
                "negotiation_id": o.negotiation_id,
                "amount": o.amount,
                "currency": o.currency,
                "status": o.status,
                "buyer_intent": o.buyer_intent,
                "razorpay_order_id": o.razorpay_order_id,
                "razorpay_payment_id": o.razorpay_payment_id,
                "created_at": o.created_at.isoformat() if o.created_at else None,
            }
        if orders_data:
            root_ref.child("orders").update(orders_data)
            counts["orders"] = len(orders_data)

        # 5. Sync Negotiations
        negotiations = db_session.query(Negotiation).all()
        neg_data = {}
        for n in negotiations:
            neg_data[str(n.id)] = {
                "id": n.id,
                "product_id": n.product_id,
                "merchant_id": n.merchant_id,
                "original_price": n.original_price,
                "proposed_price": n.proposed_price,
                "final_price": n.final_price,
                "discount_percent": n.discount_percent,
                "status": n.status,
                "policy_reason": n.policy_reason,
                "created_at": n.created_at.isoformat() if n.created_at else None,
            }
        if neg_data:
            root_ref.child("negotiations").update(neg_data)
            counts["negotiations"] = len(neg_data)

        # 6. Sync Audit Logs
        logs = db_session.query(AuditLog).all()
        logs_data = {}
        for l in logs:
            logs_data[str(l.id)] = {
                "id": l.id,
                "timestamp": l.timestamp.isoformat() if l.timestamp else None,
                "merchant_id": l.merchant_id,
                "actor": l.actor,
                "action": l.action,
                "input_data": l.input_data,
                "output_data": l.output_data,
                "decision": l.decision,
                "reason": l.reason,
            }
        if logs_data:
            root_ref.child("audit_logs").update(logs_data)
            counts["audit_logs"] = len(logs_data)

        logger.info(f"Firebase full sync completed: {counts}")
    except Exception as e:
        logger.error(f"Error during Firebase full sync: {e}")

    return counts
