"""Product matching endpoint — constraints to ranked authentic matches."""
import re
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Product, Merchant, Intent
from backend.schemas import MatchRequest, MatchResponse, MatchResult, ProductResponse
from backend.services.audit_service import log_event
from backend.services.marketplace_service import search_marketplace_products
from backend.services.firebase_service import sync_product_to_firebase

router = APIRouter(prefix="/api", tags=["match"])


@router.post("/match", response_model=MatchResponse)
def match_products(data: MatchRequest, db: Session = Depends(get_db)):
    constraints = data.constraints
    raw_query = ""

    # If intent_id provided, use its parsed constraints and raw_text
    if data.intent_id:
        intent = db.query(Intent).filter(Intent.id == data.intent_id).first()
        if intent:
            constraints = intent.parsed_constraints
            raw_query = intent.raw_text or ""

    if not raw_query and constraints.get("keywords"):
        raw_query = " ".join(constraints.get("keywords", []))

    # 1. On-demand marketplace discovery: Ensure live products matching query exist in DB
    if raw_query:
        _ensure_live_marketplace_products(db, raw_query, constraints.get("budget"))

    # 2. Query all active merchant products
    products = (
        db.query(Product, Merchant)
        .join(Merchant, Product.merchant_id == Merchant.id)
        .filter(Merchant.status == "active")
        .all()
    )

    results = []
    for product, merchant in products:
        score, reasons = _compute_match(product, merchant, constraints, raw_query)
        if score > 0:
            results.append(MatchResult(
                product=ProductResponse.model_validate(product),
                match_score=score,
                match_reasons=reasons,
                merchant_name=merchant.name,
                merchant_trust_score=merchant.trust_score,
            ))

    # Sort by match score descending
    results.sort(key=lambda r: r.match_score, reverse=True)

    log_event(
        db, actor="system", action="product_match",
        input_data=constraints,
        output_data={"results_count": len(results)},
        decision="info",
        reason=f"Matched {len(results)} authentic products for query '{raw_query[:50]}'",
    )

    return MatchResponse(results=results[:24], total=len(results))


def _ensure_live_marketplace_products(db: Session, query: str, budget: float | None):
    """Find authentic products from Meesho, Amazon, and Flipkart and persist any newly discovered ones."""
    live_items = search_marketplace_products(query, budget)
    if not live_items:
        return

    # Cache merchants by platform
    platform_merchants = {}
    for m in db.query(Merchant).all():
        for plat in ["Meesho", "Amazon", "Flipkart"]:
            if plat.lower() in m.name.lower():
                platform_merchants[plat] = m

    for item in live_items:
        plat = item["platform"]
        merchant = platform_merchants.get(plat)
        if not merchant:
            # Create merchant if not exists
            merchant = Merchant(
                name=f"{plat} Verified Direct",
                category=item["category"],
                raw_catalog_text="",
                status="active",
                trust_score=item.get("trust_score", 95.0),
                policy_rules={"max_discount": 12, "min_price": 200, "max_auto_order": 50000, "negotiation_enabled": True},
            )
            db.add(merchant)
            db.flush()
            platform_merchants[plat] = merchant

        # Check if product already exists by exact name & merchant
        existing = db.query(Product).filter(
            Product.merchant_id == merchant.id,
            Product.name == item["name"]
        ).first()

        if not existing:
            new_p = Product(
                merchant_id=merchant.id,
                name=item["name"],
                price=item["price"],
                stock=item.get("stock", 25),
                category=item["category"],
                delivery_days=item.get("delivery_days", 3),
                return_policy=item.get("return_policy", "7-day return"),
                variants=item.get("variants", {}),
                confidence_flags={"name": 1.0, "price": 1.0, "platform_verified": 1.0},
                needs_verification=False,
                raw_text=f"Live authentic feed from {plat}: {item['name']}",
            )
            db.add(new_p)
            db.flush()
            # Sync to Firebase
            try:
                sync_product_to_firebase({
                    "id": new_p.id,
                    "merchant_id": new_p.merchant_id,
                    "name": new_p.name,
                    "price": new_p.price,
                    "stock": new_p.stock,
                    "category": new_p.category,
                    "delivery_days": new_p.delivery_days,
                    "return_policy": new_p.return_policy,
                })
            except Exception:
                pass

    db.commit()


def _compute_match(product, merchant, constraints: dict, raw_query: str = "") -> tuple[float, dict]:
    """Compute high-accuracy match score (0-100) and detailed explanation dict."""
    score = 0
    reasons = {}

    budget = constraints.get("budget")
    category = constraints.get("category")
    color = constraints.get("color")
    size = constraints.get("size")
    delivery = constraints.get("delivery_deadline")
    keywords = [kw.lower() for kw in constraints.get("keywords", [])]

    # Also extract words from raw_query
    if raw_query:
        query_words = [w.lower() for w in re.split(r'\s+', raw_query) if len(w) > 2 and w not in ["the", "for", "with", "under", "and", "buy", "show"]]
        for qw in query_words:
            if qw not in keywords:
                keywords.append(qw)

    name_lower = product.name.lower()
    cat_lower = product.category.lower()

    # ─── 1. KEYWORD & INTENT RELEVANCE (Highest Priority: 45 pts) ───
    if keywords:
        matched_kw = [kw for kw in keywords if kw in name_lower or kw in cat_lower]
        
        # Strict category & keyword exclusion rules:
        # If user searched "dress", reject shoes, sarees, electronics, tablets
        if "dress" in keywords:
            if not ("dress" in name_lower or "gown" in name_lower or "dress" in cat_lower):
                return 0, {"intent": {"match": False, "detail": "Not a dress"}}

        if "saree" in keywords:
            if not ("saree" in name_lower or "saree" in cat_lower):
                return 0, {"intent": {"match": False, "detail": "Not a saree"}}

        if any(kw in ["shoe", "shoes", "sneaker", "sneakers", "footwear"] for kw in keywords):
            if not any(sw in name_lower or sw in cat_lower for sw in ["shoe", "shoes", "sneaker", "sneakers", "footwear"]):
                return 0, {"intent": {"match": False, "detail": "Not footwear"}}

        if any(kw in ["laptop", "tablet", "phone", "headphone", "audio", "earbuds"] for kw in keywords):
            if not any(ew in name_lower or ew in cat_lower for ew in ["laptop", "tablet", "phone", "headphone", "audio", "earbuds", "buds"]):
                return 0, {"intent": {"match": False, "detail": "Not matching electronic item"}}

        if matched_kw:
            score += 45
            reasons["keywords"] = {"match": True, "detail": f"Matched intent: {', '.join(matched_kw)}"}
        else:
            # If no keyword matched, product does not match search
            return 0, {"keywords": {"match": False, "detail": "No query keywords matched"}}
    else:
        score += 25
        reasons["keywords"] = {"match": True, "detail": "Broad catalog browse"}

    # ─── 2. CATEGORY MATCH (25 pts) ───
    clothing_subcats = ["clothing", "dresses", "ethnic wear", "sarees", "western wear", "apparel", "traditional wear"]
    footwear_subcats = ["footwear", "shoes", "sneakers", "running shoes", "sports footwear"]
    electronics_subcats = ["electronics", "audio", "tablets", "peripherals", "laptops", "gadgets"]

    is_cat_match = False
    if category:
        cat_req = category.lower()
        if cat_req in cat_lower or cat_lower in cat_req:
            is_cat_match = True
        elif cat_req in clothing_subcats and cat_lower in clothing_subcats:
            is_cat_match = True
        elif cat_req in footwear_subcats and cat_lower in footwear_subcats:
            is_cat_match = True
        elif cat_req in electronics_subcats and cat_lower in electronics_subcats:
            is_cat_match = True

        if is_cat_match:
            score += 25
            reasons["category"] = {"match": True, "detail": f"Category: {product.category}"}
        else:
            reasons["category"] = {"match": False, "detail": f"Category: {product.category} (wanted {category})"}
    else:
        score += 20
        reasons["category"] = {"match": True, "detail": f"Category: {product.category}"}

    # ─── 3. BUDGET MATCH (20 pts) ───
    if budget is not None:
        if product.price <= budget:
            score += 20
            reasons["budget"] = {"match": True, "detail": f"₹{product.price:,.0f} within ₹{budget:,.0f} budget"}
        elif product.price <= budget * 1.15:
            score += 10
            reasons["budget"] = {"match": False, "detail": f"₹{product.price:,.0f} slightly over ₹{budget:,.0f}"}
        else:
            score += 0
            reasons["budget"] = {"match": False, "detail": f"₹{product.price:,.0f} exceeds ₹{budget:,.0f}"}
    else:
        score += 15
        reasons["budget"] = {"match": True, "detail": "No budget constraint"}

    # ─── 4. DELIVERY MATCH (10 pts) ───
    if delivery is not None:
        if product.delivery_days <= delivery:
            score += 10
            reasons["delivery"] = {"match": True, "detail": f"{product.delivery_days}-day delivery"}
        else:
            score += 4
            reasons["delivery"] = {"match": False, "detail": f"{product.delivery_days}-day delivery (wanted {delivery}d)"}
    else:
        score += 8
        reasons["delivery"] = {"match": True, "detail": f"{product.delivery_days}-day fast shipping"}

    # ─── 5. MERCHANT TRUST BOOST (Up to 5 pts) ───
    if merchant.trust_score >= 90:
        score += 5
    elif merchant.trust_score >= 80:
        score += 3

    final_score = min(100.0, max(0.0, float(score)))
    return final_score, reasons
