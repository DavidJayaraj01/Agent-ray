"""Buyer intent parsing endpoint."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Intent
from backend.schemas import IntentRequest, IntentResponse
from backend.services.llm_service import parse_intent
from backend.services.audit_service import log_event

router = APIRouter(prefix="/api", tags=["intent"])


@router.post("/intent", response_model=IntentResponse)
def create_intent(data: IntentRequest, db: Session = Depends(get_db)):
    constraints = parse_intent(data.raw_text)

    intent = Intent(
        raw_text=data.raw_text,
        parsed_constraints=constraints,
    )
    db.add(intent)
    db.commit()
    db.refresh(intent)

    log_event(
        db, actor="llm", action="intent_parsed",
        input_data={"raw_text": data.raw_text},
        output_data=constraints,
        decision="info",
        reason=f"Parsed buyer intent: {data.raw_text[:80]}",
    )

    return intent
