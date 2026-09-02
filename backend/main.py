"""AgentReady — FastAPI application entry point.

SAFETY: Rejects startup if live Razorpay keys are detected.

SCOPE BOUNDARY: The multi-domain scrapers (BookMyShow, Zomato, Swiggy, Amazon,
Flipkart, etc.) exist solely as stress-test inputs for the Catalog Normalizer,
Trust Scorer, and Policy Engine. They prove the pipeline generalizes across
verticals. AgentReady is NOT a replacement for any of these platforms. In
production, merchants push their own catalogs via /api/merchants/{id}/manifest.
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from backend/ dir or project root
_backend_dir = Path(__file__).parent
load_dotenv(_backend_dir / ".env")
load_dotenv()  # Also check project root

# ── SAFETY CHECK: Reject live Razorpay keys ──
_key_id = os.getenv("RAZORPAY_KEY_ID", "")
if _key_id.startswith("rzp_live_"):
    raise RuntimeError(
        "FATAL: Live Razorpay keys detected in environment! "
        "AgentReady only supports test-mode keys (rzp_test_*). "
        "Update RAZORPAY_KEY_ID in .env to a test key."
    )

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.database import init_db
from backend.services.firebase_service import init_firebase
from backend.routers import (
    merchants, manifest, trust, intent,
    match, negotiate, policy, orders,
    audit, dashboard, firebase,
    voice, growth, export, certificate, ws_negotiate,
    auth_routes, admin, voice_order,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    init_firebase()
    # Auto-seed if DB is empty
    from sqlalchemy.orm import Session
    from backend.database import SessionLocal
    from backend.models import Merchant
    db = SessionLocal()
    try:
        if db.query(Merchant).count() == 0:
            from backend.seed_data import seed_all
            seed_all(db)
        
        # Sync records to Firebase Realtime Database
        from backend.services.firebase_service import sync_all_data_to_firebase
        sync_all_data_to_firebase(db)
    finally:
        db.close()
    yield


app = FastAPI(
    title="AgentReady — Agent Commerce Readiness Platform",
    version="1.0.0",
    description="Make any merchant AI-agent-ready",
    lifespan=lifespan,
)

# CORS for frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount all routers
app.include_router(merchants.router)
app.include_router(manifest.router)
app.include_router(trust.router)
app.include_router(intent.router)
app.include_router(match.router)
app.include_router(negotiate.router)
app.include_router(policy.router)
app.include_router(orders.router)
app.include_router(audit.router)
app.include_router(dashboard.router)
app.include_router(firebase.router)
app.include_router(voice.router)
app.include_router(growth.router)
app.include_router(export.router)
app.include_router(certificate.router)
app.include_router(ws_negotiate.router)
app.include_router(auth_routes.router)
app.include_router(admin.router)
app.include_router(voice_order.router)


@app.get("/")
def root():
    return {"status": "ok", "app": "AgentReady", "version": "1.0.0"}


@app.get("/health")
def health():
    return {"status": "healthy"}
