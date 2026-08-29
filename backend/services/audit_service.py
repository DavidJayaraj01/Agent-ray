"""Append-only audit log service — writes BEFORE any user-facing response."""
import datetime
from sqlalchemy.orm import Session
from backend.models import AuditLog


def log_event(
    db: Session,
    *,
    actor: str,
    action: str,
    merchant_id: int | None = None,
    input_data: dict | None = None,
    output_data: dict | None = None,
    decision: str = "info",
    reason: str = ""
) -> AuditLog:
    """Write an audit event. This MUST be called before returning any response
    that involves an LLM decision, policy check, or payment action."""
    entry = AuditLog(
        timestamp=datetime.datetime.now(datetime.timezone.utc),
        merchant_id=merchant_id,
        actor=actor,
        action=action,
        input_data=input_data or {},
        output_data=output_data or {},
        decision=decision,
        reason=reason,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)

    # Replicate audit event to Firebase (non-blocking)
    try:
        from backend.services.firebase_service import sync_audit_to_firebase
        sync_audit_to_firebase({
            "id": entry.id,
            "timestamp": entry.timestamp.isoformat() if entry.timestamp else None,
            "merchant_id": entry.merchant_id,
            "actor": entry.actor,
            "action": entry.action,
            "input_data": entry.input_data,
            "output_data": entry.output_data,
            "decision": entry.decision,
            "reason": entry.reason,
        })
    except Exception:
        pass

    return entry


def get_merchant_logs(db: Session, merchant_id: int, limit: int = 100) -> list[AuditLog]:
    """Retrieve audit logs for a merchant, newest first."""
    return (
        db.query(AuditLog)
        .filter(AuditLog.merchant_id == merchant_id)
        .order_by(AuditLog.timestamp.desc())
        .limit(limit)
        .all()
    )


def get_all_logs(
    db: Session,
    merchant_id: int | None = None,
    status: str | None = None,
    limit: int = 200
) -> list[AuditLog]:
    """Retrieve all audit logs with optional filters."""
    q = db.query(AuditLog)
    if merchant_id:
        q = q.filter(AuditLog.merchant_id == merchant_id)
    if status:
        q = q.filter(AuditLog.decision == status)
    return q.order_by(AuditLog.timestamp.desc()).limit(limit).all()
