"""Firebase status, diagnostics, and sync router."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.services.firebase_service import (
    get_firebase_status,
    is_firebase_connected,
    init_firebase,
    sync_all_data_to_firebase,
)

router = APIRouter(prefix="/api/firebase", tags=["firebase"])


@router.get("/status")
def firebase_status():
    """Return Firebase connection status and credentials metadata."""
    return get_firebase_status()


@router.post("/ping")
def firebase_ping():
    """Re-check or initialize Firebase connection and return diagnostic result."""
    app = init_firebase()
    connected = is_firebase_connected()
    status = get_firebase_status()
    
    return {
        "status": "ok" if connected else "disconnected",
        "connected": connected,
        "details": status,
    }


@router.post("/sync")
def firebase_full_sync(db: Session = Depends(get_db)):
    """Trigger a full synchronization of all database records to Firebase Realtime Database."""
    counts = sync_all_data_to_firebase(db)
    return {
        "status": "success",
        "synced_counts": counts,
    }
