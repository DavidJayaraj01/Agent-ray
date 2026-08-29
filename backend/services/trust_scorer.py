"""Trust score computation from seeded order history and catalog quality."""


def compute_trust_score(
    products: list,
    order_history: list | None = None,
    manifest_completeness: float = 0.0
) -> dict:
    """Compute a trust score breakdown for a merchant.

    Components:
    - completeness: how many product fields are filled (0-100)
    - settlement_consistency: based on order history (simulated) (0-100)
    - dispute_rate: inverse of dispute frequency (0-100, higher = fewer disputes)
    - freshness: how recently the catalog was updated (0-100)

    Returns dict with breakdown and overall score.
    """
    # ── Completeness score (based on product field coverage) ──
    if products:
        required_fields = ["name", "price", "stock", "category", "delivery_days", "return_policy"]
        total_fields = len(products) * len(required_fields)
        filled = 0
        for p in products:
            p_dict = p if isinstance(p, dict) else _product_to_dict(p)
            for field in required_fields:
                val = p_dict.get(field)
                if val is not None and val != "" and val != 0:
                    filled += 1
        completeness = (filled / total_fields * 100) if total_fields > 0 else 0
    else:
        completeness = 0

    # ── Settlement consistency (simulated from order history) ──
    if order_history:
        total_orders = len(order_history)
        successful = sum(1 for o in order_history if o.get("status") == "paid")
        settlement_consistency = (successful / total_orders * 100) if total_orders > 0 else 50
    else:
        settlement_consistency = 60  # default for new merchants

    # ── Dispute rate (simulated — fewer disputes = higher score) ──
    if order_history:
        disputes = sum(1 for o in order_history if o.get("status") == "disputed")
        dispute_rate = max(0, 100 - (disputes / len(order_history) * 200))
    else:
        dispute_rate = 80  # default for new merchants

    # ── Freshness (use manifest completeness as proxy) ──
    freshness = min(100, manifest_completeness * 1.2) if manifest_completeness > 0 else 50

    # ── Overall score (weighted average) ──
    overall = (
        completeness * 0.35
        + settlement_consistency * 0.30
        + dispute_rate * 0.20
        + freshness * 0.15
    )

    return {
        "overall": round(overall, 1),
        "breakdown": {
            "completeness": round(completeness, 1),
            "settlement_consistency": round(settlement_consistency, 1),
            "dispute_rate": round(dispute_rate, 1),
            "freshness": round(freshness, 1),
        },
    }


def _product_to_dict(product) -> dict:
    """Convert an ORM Product to a dict for scoring."""
    return {
        "name": getattr(product, "name", ""),
        "price": getattr(product, "price", 0),
        "stock": getattr(product, "stock", 0),
        "category": getattr(product, "category", ""),
        "delivery_days": getattr(product, "delivery_days", 0),
        "return_policy": getattr(product, "return_policy", ""),
    }
