"""Audit log retrieval endpoint."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional

from backend.database import get_db
from backend.schemas import AuditLogResponse
from backend.services.audit_service import get_all_logs, get_merchant_logs

router = APIRouter(prefix="/api", tags=["audit"])


@router.get("/audit", response_model=list[AuditLogResponse])
def list_all_audit_logs(
    merchant_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(200, le=500),
    db: Session = Depends(get_db),
):
    return get_all_logs(db, merchant_id=merchant_id, status=status, limit=limit)


@router.get("/audit/{merchant_id}", response_model=list[AuditLogResponse])
def list_merchant_audit_logs(
    merchant_id: int,
    limit: int = Query(100, le=500),
    db: Session = Depends(get_db),
):
    return get_merchant_logs(db, merchant_id, limit=limit)
