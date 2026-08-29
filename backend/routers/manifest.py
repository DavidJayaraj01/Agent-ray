"""Manifest generation and retrieval endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import datetime

from backend.database import get_db
from backend.models import Merchant, Product, Manifest
from backend.schemas import ManifestResponse, ProductResponse
from backend.services.catalog_normalizer import normalize_catalog
from backend.services.audit_service import log_event
from backend.services.auth_service import require_own_merchant, get_current_user, AuthUser

router = APIRouter(prefix="/api", tags=["manifest"])


@router.post("/manifest/generate/{merchant_id}")
def generate_manifest(merchant_id: int, db: Session = Depends(get_db), user: AuthUser = Depends(require_own_merchant)):
    merchant = db.query(Merchant).filter(Merchant.id == merchant_id).first()
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")

    # Update merchant status
    merchant.status = "processing"
    db.commit()

    # Get raw catalog text
    raw_text = merchant.raw_catalog_text
    if not raw_text:
        raise HTTPException(status_code=400, detail="No catalog data to process")

    # Normalize catalog
    try:
        normalized = normalize_catalog(raw_text)
    except Exception as e:
        log_event(
            db, actor="llm", action="catalog_normalization_failed",
            merchant_id=merchant_id,
            input_data={"raw_length": len(raw_text)},
            output_data={"error": str(e)},
            decision="info",
            reason=f"Catalog normalization failed: {str(e)}",
        )
        raise HTTPException(status_code=500, detail=f"Normalization failed: {str(e)}")

    # Clear existing products for this merchant
    db.query(Product).filter(Product.merchant_id == merchant_id).delete()

    # Create product records
    product_ids = []
    flagged_count = 0
    for p in normalized:
        product = Product(
            merchant_id=merchant_id,
            name=p.get("name", "Unknown"),
            price=p.get("price", 0),
            stock=p.get("stock", 0),
            category=p.get("category", "General"),
            delivery_days=p.get("delivery_days", 7),
            return_policy=p.get("return_policy", "No returns"),
            variants=p.get("variants", {}),
            confidence_flags=p.get("confidence_flags", {}),
            needs_verification=p.get("needs_verification", False),
            raw_text=p.get("raw_text", ""),
        )
        db.add(product)
        db.flush()
        product_ids.append(product.id)
        if product.needs_verification:
            flagged_count += 1

    # Count raw lines as proxy for raw product count
    raw_lines = [l for l in raw_text.strip().split("\n") if l.strip()]
    raw_count = max(len(raw_lines) - 1, len(normalized))  # subtract header

    # Compute completeness
    completeness = (len(normalized) / raw_count * 100) if raw_count > 0 else 0

    # Create or update manifest
    manifest = db.query(Manifest).filter(Manifest.merchant_id == merchant_id).first()
    if manifest:
        manifest.generated_at = datetime.datetime.now(datetime.timezone.utc)
        manifest.product_ids = product_ids
        manifest.completeness_score = round(completeness, 1)
        manifest.raw_product_count = raw_count
        manifest.normalized_product_count = len(normalized)
        manifest.flagged_count = flagged_count
    else:
        manifest = Manifest(
            merchant_id=merchant_id,
            product_ids=product_ids,
            completeness_score=round(completeness, 1),
            raw_product_count=raw_count,
            normalized_product_count=len(normalized),
            flagged_count=flagged_count,
        )
        db.add(manifest)

    merchant.status = "active"
    db.commit()
    db.refresh(manifest)

    log_event(
        db, actor="llm", action="catalog_normalized",
        merchant_id=merchant_id,
        input_data={"raw_lines": raw_count},
        output_data={
            "products_created": len(normalized),
            "flagged": flagged_count,
            "completeness": round(completeness, 1),
        },
        decision="info",
        reason=f"Normalized {len(normalized)} products from {raw_count} raw entries, {flagged_count} flagged",
    )

    return {
        "manifest": {
            "id": manifest.id,
            "merchant_id": manifest.merchant_id,
            "generated_at": manifest.generated_at.isoformat(),
            "product_ids": manifest.product_ids,
            "completeness_score": manifest.completeness_score,
            "raw_product_count": manifest.raw_product_count,
            "normalized_product_count": manifest.normalized_product_count,
            "flagged_count": manifest.flagged_count,
        },
        "products": [
            {
                "id": p.id,
                "merchant_id": p.merchant_id,
                "name": p.name,
                "price": p.price,
                "stock": p.stock,
                "category": p.category,
                "delivery_days": p.delivery_days,
                "return_policy": p.return_policy,
                "variants": p.variants,
                "confidence_flags": p.confidence_flags,
                "needs_verification": p.needs_verification,
                "raw_text": p.raw_text,
            }
            for p in db.query(Product).filter(Product.merchant_id == merchant_id).all()
        ],
    }


@router.get("/manifest/{merchant_id}")
def get_manifest(merchant_id: int, db: Session = Depends(get_db)):

    manifest = db.query(Manifest).filter(Manifest.merchant_id == merchant_id).first()
    if not manifest:
        raise HTTPException(status_code=404, detail="Manifest not found — generate it first")

    products = db.query(Product).filter(Product.merchant_id == merchant_id).all()

    return {
        "manifest": {
            "id": manifest.id,
            "merchant_id": manifest.merchant_id,
            "generated_at": manifest.generated_at.isoformat(),
            "product_ids": manifest.product_ids,
            "completeness_score": manifest.completeness_score,
            "raw_product_count": manifest.raw_product_count,
            "normalized_product_count": manifest.normalized_product_count,
            "flagged_count": manifest.flagged_count,
        },
        "products": [
            {
                "id": p.id,
                "merchant_id": p.merchant_id,
                "name": p.name,
                "price": p.price,
                "stock": p.stock,
                "category": p.category,
                "delivery_days": p.delivery_days,
                "return_policy": p.return_policy,
                "variants": p.variants,
                "confidence_flags": p.confidence_flags,
                "needs_verification": p.needs_verification,
                "raw_text": p.raw_text,
            }
            for p in products
        ],
    }


@router.put("/products/{product_id}")
def update_product(product_id: int, data: dict, db: Session = Depends(get_db), user: AuthUser = Depends(get_current_user)):
    """Inline edit a product field (used from manifest review page)."""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    allowed = ["name", "price", "stock", "category", "delivery_days", "return_policy",
               "variants", "needs_verification"]
    for key, value in data.items():
        if key in allowed:
            setattr(product, key, value)

    # If manually approved, clear verification flag
    if "needs_verification" in data and not data["needs_verification"]:
        product.needs_verification = False

    db.commit()
    db.refresh(product)

    log_event(
        db, actor="system", action="product_updated",
        merchant_id=product.merchant_id,
        input_data={"product_id": product_id, "fields": list(data.keys())},
        decision="info",
        reason=f"Product '{product.name}' updated",
    )

    return {"status": "updated", "product_id": product.id}
