"""Protocol-compatible catalog export — schema.org/Product JSON-LD and ACP envelope."""
import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Merchant, Product, Manifest

router = APIRouter(prefix="/api/export", tags=["export"])


@router.get("/schema-org/{merchant_id}")
def export_schema_org(merchant_id: int, db: Session = Depends(get_db)):
    """Export merchant catalog as schema.org/Product JSON-LD.

    Produces machine-readable product data compatible with Google Shopping,
    search engines, and any agent consuming schema.org structured data.
    """
    merchant = db.query(Merchant).filter(Merchant.id == merchant_id).first()
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")

    products = db.query(Product).filter(Product.merchant_id == merchant_id).all()
    if not products:
        raise HTTPException(status_code=404, detail="No products found")

    json_ld_products = []
    for p in products:
        availability = "https://schema.org/InStock" if p.stock > 0 else "https://schema.org/OutOfStock"

        product_ld = {
            "@context": "https://schema.org",
            "@type": "Product",
            "name": p.name,
            "category": p.category,
            "sku": f"AR-{merchant_id}-{p.id}",
            "offers": {
                "@type": "Offer",
                "price": p.price,
                "priceCurrency": "INR",
                "availability": availability,
                "seller": {
                    "@type": "Organization",
                    "name": merchant.name,
                },
                "shippingDetails": {
                    "@type": "OfferShippingDetails",
                    "deliveryTime": {
                        "@type": "ShippingDeliveryTime",
                        "businessDays": {
                            "@type": "QuantitativeValue",
                            "maxValue": p.delivery_days,
                        },
                    },
                },
                "hasMerchantReturnPolicy": {
                    "@type": "MerchantReturnPolicy",
                    "returnPolicyCategory": "https://schema.org/MerchantReturnFiniteReturnWindow",
                    "merchantReturnDays": 7 if "7" in (p.return_policy or "") else 15,
                },
            },
        }

        # Add variants if present
        if p.variants:
            if isinstance(p.variants, dict):
                if "colors" in p.variants:
                    product_ld["color"] = p.variants["colors"]
                if "sizes" in p.variants:
                    product_ld["size"] = p.variants["sizes"]

        json_ld_products.append(product_ld)

    return {
        "@context": "https://schema.org",
        "@type": "ItemList",
        "name": f"{merchant.name} — Agent-Ready Catalog",
        "numberOfItems": len(json_ld_products),
        "itemListElement": [
            {"@type": "ListItem", "position": i + 1, "item": prod}
            for i, prod in enumerate(json_ld_products)
        ],
    }


@router.get("/acp/{merchant_id}")
def export_acp(merchant_id: int, db: Session = Depends(get_db)):
    """Export merchant catalog in ACP-compatible envelope.

    Wraps schema.org product data with agent-commerce protocol metadata:
    - Merchant trust score and verification status
    - Policy rules (negotiation capability, discount limits)
    - Protocol version and capability flags
    """
    merchant = db.query(Merchant).filter(Merchant.id == merchant_id).first()
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")

    products = db.query(Product).filter(Product.merchant_id == merchant_id).all()
    manifest = db.query(Manifest).filter(Manifest.merchant_id == merchant_id).first()
    policy = merchant.policy_rules or {}

    catalog_items = []
    for p in products:
        catalog_items.append({
            "product_id": f"AR-{merchant_id}-{p.id}",
            "name": p.name,
            "price": {"amount": p.price, "currency": "INR"},
            "category": p.category,
            "availability": {"in_stock": p.stock > 0, "quantity": p.stock},
            "fulfillment": {
                "delivery_days": p.delivery_days,
                "return_policy": p.return_policy,
            },
            "variants": p.variants or {},
            "confidence": p.confidence_flags or {},
            "requires_verification": p.needs_verification,
        })

    return {
        "protocol": "ACP",
        "version": "0.1.0-draft",
        "spec_reference": "https://docs.agentcommerce.org/acp/v0.1",
        "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "merchant": {
            "id": f"agentready:merchant:{merchant_id}",
            "name": merchant.name,
            "category": merchant.category,
            "trust_score": merchant.trust_score,
            "verification_status": "verified" if merchant.trust_score >= 70 else "pending",
            "agent_ready": merchant.status == "active",
        },
        "capabilities": {
            "negotiation_enabled": policy.get("negotiation_enabled", True),
            "max_discount_pct": policy.get("max_discount", 10),
            "max_auto_order_inr": policy.get("max_auto_order", 50000),
            "min_price_inr": policy.get("min_price", 100),
            "supported_protocols": ["ACP/0.1", "schema.org/Product", "x402-draft"],
            "payment_gateway": "razorpay",
            "payment_mode": "test",
        },
        "catalog": {
            "total_items": len(catalog_items),
            "completeness_score": manifest.completeness_score if manifest else 0,
            "items": catalog_items,
        },
    }
