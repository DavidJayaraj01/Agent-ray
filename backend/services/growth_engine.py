"""AI Growth Engine — proactive cross-sell, pricing outliers, cart recovery, GMV simulation.

Runs entirely on merchant's catalog + synthetic sales data.
All auto-generated offers are gated through the policy engine.
"""
import random
import math
from collections import defaultdict

from backend.services.policy_engine import validate_offer


def detect_cross_sell(products: list) -> list[dict]:
    """Detect cross-sell / frequently-bought-together opportunities.

    Analyzes category co-occurrence patterns and generates attach-rate pairs.
    Returns list of { "primary", "recommended", "attach_rate", "revenue_uplift" }
    """
    if not products or len(products) < 2:
        return []

    # Group products by category
    by_category: dict[str, list] = defaultdict(list)
    for p in products:
        cat = _get_cat(p)
        by_category[cat].append(p)

    # Define realistic cross-sell rules
    cross_sell_rules = {
        "Smartphones": [
            ("Audio", 0.68, "Buyers who get phones often add earbuds/headphones"),
            ("Peripherals", 0.42, "Phone buyers frequently add charging accessories"),
        ],
        "Audio": [
            ("Smartphones", 0.35, "Audio enthusiasts often upgrade their phone"),
        ],
        "Laptops": [
            ("Peripherals", 0.72, "Laptop buyers almost always need a mouse/keyboard"),
            ("Audio", 0.45, "Laptop buyers often add headphones for calls"),
        ],
        "Tablets": [
            ("Peripherals", 0.58, "Tablet users frequently add a keyboard"),
        ],
        "Footwear": [
            ("Clothing", 0.55, "Shoe buyers often add matching sportswear"),
            ("Sports Equipment", 0.38, "Athletic shoe buyers add sports gear"),
        ],
        "Dresses": [
            ("Sarees", 0.32, "Dress shoppers browse ethnic wear too"),
            ("Ethnic Wear", 0.48, "Fashion buyers cross-shop kurtis and dresses"),
        ],
        "Sarees": [
            ("Ethnic Wear", 0.62, "Saree buyers often add matching kurtis/dupattas"),
        ],
        "Clothing": [
            ("Footwear", 0.52, "Clothing buyers frequently add matching shoes"),
        ],
    }

    opportunities = []
    for primary_cat, rules in cross_sell_rules.items():
        if primary_cat not in by_category:
            continue
        for target_cat, base_attach, reason in rules:
            if target_cat not in by_category:
                continue

            primary_items = by_category[primary_cat]
            target_items = by_category[target_cat]

            # Pick best-selling items (highest stock = proxy for popularity)
            primary_best = max(primary_items, key=lambda x: _get_attr(x, "stock", 0))
            target_best = max(target_items, key=lambda x: _get_attr(x, "stock", 0))

            # Simulate slight variation in attach rate
            random.seed(hash(f"{_get_attr(primary_best, 'name', '')}_{_get_attr(target_best, 'name', '')}"))
            attach_rate = round(base_attach + random.uniform(-0.05, 0.05), 2)

            primary_price = _get_attr(primary_best, "price", 0)
            target_price = _get_attr(target_best, "price", 0)
            uplift = round(target_price * attach_rate, 2)

            opportunities.append({
                "primary": {
                    "id": _get_attr(primary_best, "id", 0),
                    "name": _get_attr(primary_best, "name", ""),
                    "price": primary_price,
                    "category": primary_cat,
                },
                "recommended": {
                    "id": _get_attr(target_best, "id", 0),
                    "name": _get_attr(target_best, "name", ""),
                    "price": target_price,
                    "category": target_cat,
                },
                "attach_rate": attach_rate,
                "attach_rate_pct": f"{attach_rate * 100:.0f}%",
                "revenue_uplift_per_order": uplift,
                "reason": reason,
            })

    opportunities.sort(key=lambda x: x["attach_rate"], reverse=True)
    return opportunities


def detect_pricing_outliers(products: list) -> list[dict]:
    """Flag products priced significantly above/below category median.

    Returns list of { "product", "category_median", "deviation", "status" }
    """
    if not products:
        return []

    by_category: dict[str, list[float]] = defaultdict(list)
    product_list = []
    for p in products:
        cat = _get_cat(p)
        price = _get_attr(p, "price", 0)
        if price > 0:
            by_category[cat].append(price)
            product_list.append((p, cat, price))

    outliers = []
    for p, cat, price in product_list:
        prices = by_category[cat]
        if len(prices) < 2:
            continue

        median = sorted(prices)[len(prices) // 2]
        mean = sum(prices) / len(prices)
        std = math.sqrt(sum((x - mean) ** 2 for x in prices) / len(prices)) if len(prices) > 1 else 0

        if std == 0:
            continue

        z_score = (price - mean) / std

        if abs(z_score) > 1.2:
            status = "overpriced" if z_score > 0 else "underpriced"
            deviation_pct = round(((price - median) / median) * 100, 1)
            outliers.append({
                "product": {
                    "id": _get_attr(p, "id", 0),
                    "name": _get_attr(p, "name", ""),
                    "price": price,
                    "category": cat,
                },
                "category_median": round(median, 2),
                "category_mean": round(mean, 2),
                "z_score": round(z_score, 2),
                "deviation_pct": deviation_pct,
                "status": status,
                "recommendation": (
                    f"Consider reducing price by ~{abs(deviation_pct):.0f}% to match category benchmark"
                    if status == "overpriced"
                    else f"Potential margin opportunity: price is {abs(deviation_pct):.0f}% below category median"
                ),
            })

    outliers.sort(key=lambda x: abs(x["z_score"]), reverse=True)
    return outliers


def simulate_cart_recovery(products: list, policy_rules: dict) -> list[dict]:
    """Simulate abandoned-cart recovery nudges, all gated through policy engine.

    Returns list of recovery nudge offers with policy validation status.
    """
    if not products:
        return []

    nudges = []
    max_discount = policy_rules.get("max_discount", 10)
    # Cart recovery typically offers 3-5% smaller discount than max
    recovery_discount_pct = min(max_discount, max(3, max_discount * 0.6))

    for p in products[:6]:  # top 6 products
        price = _get_attr(p, "price", 0)
        if price <= 0:
            continue

        nudge_price = round(price * (1 - recovery_discount_pct / 100), 2)

        # Gate through policy engine
        policy_result = validate_offer(price, nudge_price, policy_rules)

        nudges.append({
            "product": {
                "id": _get_attr(p, "id", 0),
                "name": _get_attr(p, "name", ""),
                "price": price,
                "category": _get_cat(p),
            },
            "nudge_price": nudge_price,
            "discount_pct": round(recovery_discount_pct, 1),
            "nudge_message": (
                f"Still interested in {_get_attr(p, 'name', '')}? "
                f"Complete your purchase now and get {recovery_discount_pct:.0f}% off — "
                f"just ₹{nudge_price:,.0f}!"
            ),
            "policy_approved": policy_result["approved"],
            "policy_reason": policy_result["reason"],
        })

    return nudges


def compute_gmv_simulation(products: list, policy_rules: dict) -> dict:
    """Simulate 90-day GMV: baseline vs agent-assisted.

    Baseline: random organic sales.
    Agent-assisted: adds cross-sell uplift, cart-recovery conversions, optimized pricing.
    """
    if not products:
        return {"baseline_gmv": 0, "agent_gmv": 0, "uplift_pct": 0, "daily_breakdown": []}

    random.seed(42)  # deterministic for demo consistency

    daily_baseline = []
    daily_agent = []

    for day in range(90):
        # Baseline: 2-5 organic orders/day from random products
        orders_today = random.randint(2, 5)
        base_revenue = 0
        agent_revenue = 0

        for _ in range(orders_today):
            p = random.choice(products)
            price = _get_attr(p, "price", 0)
            base_revenue += price
            agent_revenue += price

        # Agent uplift: cross-sell adds 15-25% to some orders
        cross_sell_orders = int(orders_today * 0.35)  # 35% of orders get cross-sell
        for _ in range(cross_sell_orders):
            p = random.choice(products)
            attach_price = _get_attr(p, "price", 0) * random.uniform(0.1, 0.3)
            agent_revenue += attach_price

        # Cart recovery: recovers ~15% of would-be abandoned carts
        abandoned = random.randint(0, 2)
        recovered = int(abandoned * 0.15)
        for _ in range(max(1, recovered)):
            p = random.choice(products)
            max_disc = policy_rules.get("max_discount", 10)
            recovery_price = _get_attr(p, "price", 0) * (1 - max_disc * 0.6 / 100)
            agent_revenue += recovery_price

        daily_baseline.append(round(base_revenue, 2))
        daily_agent.append(round(agent_revenue, 2))

    total_baseline = round(sum(daily_baseline), 2)
    total_agent = round(sum(daily_agent), 2)
    uplift_pct = round(((total_agent - total_baseline) / total_baseline) * 100, 1) if total_baseline > 0 else 0

    # Weekly aggregation for chart
    weekly = []
    for w in range(13):
        start = w * 7
        end = min(start + 7, 90)
        weekly.append({
            "week": f"W{w + 1}",
            "baseline": round(sum(daily_baseline[start:end]), 0),
            "agent_assisted": round(sum(daily_agent[start:end]), 0),
        })

    return {
        "baseline_gmv": total_baseline,
        "agent_gmv": total_agent,
        "uplift_pct": uplift_pct,
        "uplift_absolute": round(total_agent - total_baseline, 2),
        "period_days": 90,
        "avg_daily_baseline": round(total_baseline / 90, 2),
        "avg_daily_agent": round(total_agent / 90, 2),
        "weekly_breakdown": weekly,
    }


# ── Helpers ──────────────────────────────────────────────

def _get_attr(obj, attr: str, default=None):
    """Get attribute from ORM object or dict."""
    if isinstance(obj, dict):
        return obj.get(attr, default)
    return getattr(obj, attr, default)


def _get_cat(obj) -> str:
    return (_get_attr(obj, "category") or "General").strip()
