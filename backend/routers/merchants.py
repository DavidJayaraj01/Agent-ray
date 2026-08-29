"""Merchant CRUD endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Merchant
from backend.schemas import MerchantCreate, MerchantResponse, MerchantUpdate
from backend.services.audit_service import log_event

router = APIRouter(prefix="/api", tags=["merchants"])


@router.post("/merchants", response_model=MerchantResponse)
def create_merchant(data: MerchantCreate, db: Session = Depends(get_db)):
    policy = data.policy_rules.model_dump() if data.policy_rules else {
        "max_discount": 10,
        "min_price": 100,
        "max_auto_order": 50000,
        "negotiation_enabled": True,
    }

    merchant = Merchant(
        name=data.name,
        category=data.category,
        raw_catalog_text=data.raw_catalog_text,
        raw_catalog_url=data.raw_catalog_url,
        status="pending",
        policy_rules=policy,
    )
    db.add(merchant)
    db.commit()
    db.refresh(merchant)

    # Sync to Firebase
    try:
        from backend.services.firebase_service import sync_merchant_to_firebase
        sync_merchant_to_firebase({
            "id": merchant.id,
            "name": merchant.name,
            "category": merchant.category,
            "trust_score": merchant.trust_score,
            "status": merchant.status,
            "policy_rules": merchant.policy_rules,
            "created_at": merchant.created_at.isoformat() if merchant.created_at else None,
        })
    except Exception:
        pass

    log_event(
        db,
        actor="system",
        action="merchant_created",
        merchant_id=merchant.id,
        input_data={"name": data.name, "category": data.category},
        output_data={"merchant_id": merchant.id},
        decision="info",
        reason=f"Merchant '{data.name}' created",
    )

    return merchant


@router.get("/merchants", response_model=list[MerchantResponse])
def list_merchants(db: Session = Depends(get_db)):
    return db.query(Merchant).all()


@router.get("/merchants/{merchant_id}", response_model=MerchantResponse)
def get_merchant(merchant_id: int, db: Session = Depends(get_db)):
    merchant = db.query(Merchant).filter(Merchant.id == merchant_id).first()
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")
    return merchant


@router.put("/merchants/{merchant_id}", response_model=MerchantResponse)
def update_merchant(merchant_id: int, data: MerchantUpdate, db: Session = Depends(get_db)):
    merchant = db.query(Merchant).filter(Merchant.id == merchant_id).first()
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")

    if data.name is not None:
        merchant.name = data.name
    if data.category is not None:
        merchant.category = data.category
    if data.policy_rules is not None:
        merchant.policy_rules = data.policy_rules.model_dump()

    db.commit()
    db.refresh(merchant)

    log_event(
        db,
        actor="system",
        action="merchant_updated",
        merchant_id=merchant.id,
        input_data=data.model_dump(exclude_none=True),
        decision="info",
        reason=f"Merchant '{merchant.name}' updated",
    )

    return merchant
