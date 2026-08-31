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
            # Merge intent constraints with request constraints (request constraints take priority)
            merged = dict(intent.parsed_constraints or {})
            merged.update(constraints)
            constraints = merged
            raw_query = intent.raw_text or ""

    if not raw_query and constraints.get("keywords"):
        raw_query = " ".join(constraints.get("keywords", []))

    target_merchant_id = constraints.get("merchant_id")
    target_category = constraints.get("category")

    # 1. On-demand multi-platform live discovery & real-time scraping
    if raw_query:
        _ensure_live_marketplace_products(
            db=db,
            query=raw_query,
            merchant_id=int(target_merchant_id) if target_merchant_id else None,
            category=target_category,
            budget=constraints.get("budget"),
        )

    # 2. Query active merchant products with optional merchant_id / category filter
    query = (
        db.query(Product, Merchant)
        .join(Merchant, Product.merchant_id == Merchant.id)
        .filter(Merchant.status == "active")
    )

    if target_merchant_id:
        query = query.filter(Product.merchant_id == int(target_merchant_id))

    if target_category and target_category.lower() != "all":
        query = query.filter(
            (Merchant.category.ilike(f"%{target_category}%")) | (Product.category.ilike(f"%{target_category}%"))
        )

    products = query.all()

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


def _ensure_live_marketplace_products(
    db: Session,
    query: str,
    merchant_id: int | None = None,
    category: str | None = None,
    budget: float | None = None,
):
    """Find authentic products across all 12 platforms in real-time and persist newly discovered ones."""
    live_items = search_marketplace_products(
        query=query,
        merchant_id=merchant_id,
        category=category,
        budget=budget,
    )
    if not live_items:
        return

    all_merchants = db.query(Merchant).all()
    if not all_merchants:
        return

    merchant_by_id = {m.id: m for m in all_merchants}
    merchant_by_platform: dict[str, Merchant] = {}
    for m in all_merchants:
        m_name_low = m.name.lower()
        if "bookmyshow" in m_name_low:
            merchant_by_platform["bookmyshow"] = m
        elif "zomato" in m_name_low:
            merchant_by_platform["zomato"] = m
        elif "swiggy" in m_name_low:
            merchant_by_platform["swiggy"] = m
        elif "zepto" in m_name_low:
            merchant_by_platform["zepto"] = m
        elif "nykaa" in m_name_low:
            merchant_by_platform["nykaa"] = m
        elif "spicejet" in m_name_low:
            merchant_by_platform["spicejet"] = m
        elif "meesho" in m_name_low:
            merchant_by_platform["meesho"] = m
        elif "amazon" in m_name_low:
            merchant_by_platform["amazon"] = m
        elif "flipkart" in m_name_low:
            merchant_by_platform["flipkart"] = m
        elif "urban" in m_name_low:
            merchant_by_platform["urban"] = m
        elif "coursera" in m_name_low:
            merchant_by_platform["coursera"] = m
        elif "meta" in m_name_low or "facebook" in m_name_low:
            merchant_by_platform["meta"] = m

    for item in live_items:
        plat_low = str(item.get("platform", "")).lower()
        target_m = None
        if merchant_id and merchant_id in merchant_by_id:
            target_m = merchant_by_id[merchant_id]
        else:
            for key, m in merchant_by_platform.items():
                if key in plat_low:
                    target_m = m
                    break

        if not target_m:
            target_m = all_merchants[0]

        # Check if product already exists by exact name & merchant
        existing = db.query(Product).filter(
            Product.merchant_id == target_m.id,
            Product.name == item["name"]
        ).first()

        if existing:
            existing.price = item["price"]
            if item.get("variants"):
                existing.variants = item["variants"]
        else:
            new_p = Product(
                merchant_id=target_m.id,
                name=item["name"],
                price=item["price"],
                stock=item.get("stock", 50),
                category=item.get("category", "General"),
                delivery_days=item.get("delivery_days", 1),
                return_policy=item.get("return_policy", "Standard satisfaction guarantee"),
                variants=item.get("variants", {}),
                confidence_flags={"source": "live_realtime_fetch", "platform": item.get("platform")},
                needs_verification=False,
                raw_text=item["name"],
            )
            db.add(new_p)
            db.flush()

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


STOP_WORDS = {
    "the", "for", "with", "under", "and", "buy", "show", "new", "brand", "day", "days",
    "best", "top", "all", "get", "pro", "online", "deal", "deals", "off", "order",
    "want", "need", "please", "item", "items", "good", "quality", "direct", "me", "to",
    "in", "at", "from", "of", "a", "an", "is", "or", "by", "price", "rate", "cost", "ticket", "tickets"
}


def _compute_match(product, merchant, constraints: dict, raw_query: str = "") -> tuple[float, dict]:
    """Compute high-accuracy match score (0-100) and detailed explanation dict."""
    score = 0
    reasons = {}

    budget = constraints.get("budget")
    category = constraints.get("category")
    delivery = constraints.get("delivery_deadline")
    raw_keywords = [kw.lower() for kw in constraints.get("keywords", [])]

    # Extract words from raw_query
    if raw_query:
        query_words = [w.lower() for w in re.split(r'\s+', raw_query) if len(w) > 2]
        for qw in query_words:
            if qw not in raw_keywords:
                raw_keywords.append(qw)

    name_lower = product.name.lower()
    cat_lower = product.category.lower()
    m_name_lower = merchant.name.lower()
    q_lower = raw_query.lower()

    # Distinguish core distinct keywords from common modifier/stop words
    core_keywords = [kw for kw in raw_keywords if kw not in STOP_WORDS and len(kw) > 2]

    # ─── CROSS-CATEGORY MISMATCH GUARDS ───
    is_movie_query = any(w in q_lower for w in ["spiderman", "spider-man", "spider man", "movie", "cinema", "theatre", "theater", "imax", "4dx", "coldplay", "arijit", "comic con", "sunburn", "concert", "festival"])
    if is_movie_query and any(c in cat_lower for c in ["footwear", "shoes", "sneakers", "dresses", "sarees", "clothing", "apparel"]):
        return 0, {"intent": {"match": False, "detail": "Cross-category mismatch (not entertainment/cinema)"}}

    is_food_query = any(w in q_lower for w in ["biryani", "pizza", "burger", "food", "dining", "mango", "ghee", "coffee", "curry", "snack", "juice", "beverage", "meal", "thali"])
    if is_food_query and any(c in cat_lower for c in ["smartphones", "electronics", "audio", "tablets", "footwear", "shoes", "dresses", "sarees"]):
        return 0, {"intent": {"match": False, "detail": "Cross-category mismatch (not food/dining)"}}

    is_phone_query = any(re.search(r'\b' + re.escape(w) + r'\b', q_lower) for w in ["s26", "s25", "s24", "s23", "phone", "smartphone", "galaxy", "iphone", "pixel", "oneplus"])
    if is_phone_query and any(c in cat_lower for c in ["footwear", "shoes", "dresses", "sarees", "clothing", "food"]):
        return 0, {"intent": {"match": False, "detail": "Cross-category mismatch (not a phone/accessory)"}}

    is_footwear_query = any(re.search(r'\b' + re.escape(w) + r'\b', q_lower) for w in ["shoe", "shoes", "sneaker", "sneakers", "footwear", "running shoes"])
    if is_footwear_query and any(c in cat_lower for c in ["smartphones", "electronics", "audio", "tablets", "dresses", "sarees", "food", "entertainment", "cinema"]):
        return 0, {"intent": {"match": False, "detail": "Cross-category mismatch (not footwear)"}}

    # Helper for token matching with alphanumeric normalization
    def _kw_matches(kw: str, target: str) -> bool:
        if not kw or not target:
            return False
        if kw in target:
            return True
        clean_kw = re.sub(r'[^a-z0-9]', '', kw)
        clean_target = re.sub(r'[^a-z0-9]', '', target)
        if clean_kw and len(clean_kw) >= 3 and clean_kw in clean_target:
            return True
        if len(kw) <= 5:
            return bool(re.search(r'\b' + re.escape(kw) + r'\b', target))
        return False

    # ─── 1. KEYWORD & INTENT RELEVANCE (Highest Priority: 45 pts) ───
    if core_keywords:
        matched_core = [kw for kw in core_keywords if _kw_matches(kw, name_lower) or _kw_matches(kw, cat_lower) or _kw_matches(kw, m_name_lower)]
        if not matched_core:
            # If no core distinct search term matches this product, eliminate false positive
            return 0, {"keywords": {"match": False, "detail": f"Missing core search terms: {', '.join(core_keywords[:3])}"}}

        match_ratio = len(matched_core) / max(len(core_keywords), 1)
        score += int(30 + 15 * match_ratio)
        reasons["keywords"] = {"match": True, "detail": f"Matched intent: {', '.join(matched_core)}"}
    elif raw_keywords:
        matched_any = [kw for kw in raw_keywords if _kw_matches(kw, name_lower) or _kw_matches(kw, cat_lower)]
        if matched_any:
            score += 25
            reasons["keywords"] = {"match": True, "detail": f"Matched terms: {', '.join(matched_any)}"}
        else:
            return 0, {"keywords": {"match": False, "detail": "No query terms matched"}}
    else:
        score += 25
        reasons["keywords"] = {"match": True, "detail": "Broad catalog browse"}

    # ─── 2. CATEGORY MATCH (25 pts) ───
    if category and category.lower() != "all":
        cat_req = category.lower()
        if cat_req in cat_lower or cat_lower in cat_req or cat_req in merchant.category.lower():
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
