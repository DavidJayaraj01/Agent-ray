"""LLM service supporting NVIDIA NIM Cloud API and local Ollama.

Priority order:
1. NVIDIA NIM (Cloud GPU LLM via OpenAI-compatible endpoint)
2. Ollama (Local LLM fallback)
3. Deterministic rule-based engines
"""
import json
import re
import os
import httpx


NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY", "")
NVIDIA_BASE_URL = os.getenv("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1").rstrip("/")
NVIDIA_MODEL = os.getenv("NVIDIA_MODEL", "meta/llama-3.2-11b-vision-instruct")

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2")


def _nvidia_generate(prompt: str, timeout: float = 30.0) -> str:
    """Call NVIDIA NIM chat completions endpoint."""
    resp = httpx.post(
        f"{NVIDIA_BASE_URL}/chat/completions",
        headers={
            "Authorization": f"Bearer {NVIDIA_API_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "model": NVIDIA_MODEL,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.2,
            "max_tokens": 2048,
        },
        timeout=timeout,
    )
    resp.raise_for_status()
    data = resp.json()
    return data["choices"][0]["message"]["content"]


def _ollama_generate_local(prompt: str, timeout: float = 30.0) -> str:
    """Call local Ollama's generate endpoint."""
    resp = httpx.post(
        f"{OLLAMA_BASE_URL}/api/generate",
        json={"model": OLLAMA_MODEL, "prompt": prompt, "stream": False},
        timeout=timeout,
    )
    resp.raise_for_status()
    return resp.json().get("response", "")


def llm_generate(prompt: str, timeout: float = 30.0) -> str:
    """Generate response using NVIDIA NIM, falling back to Ollama."""
    if NVIDIA_API_KEY:
        try:
            return _nvidia_generate(prompt, timeout=timeout)
        except Exception as e:
            print(f"[LLM Service] NVIDIA NIM call failed: {e}. Trying Ollama...")

    try:
        return _ollama_generate_local(prompt, timeout=timeout)
    except Exception:
        raise ConnectionError("No LLM provider available (NVIDIA NIM or Ollama)")


def _ollama_available_local() -> bool:
    """Check if Ollama is reachable locally."""
    try:
        resp = httpx.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=2.0)
        return resp.status_code == 200
    except Exception:
        return False


def llm_available() -> bool:
    """Check if an LLM is available (NVIDIA NIM or local Ollama)."""
    return bool(NVIDIA_API_KEY.strip()) or _ollama_available_local()


# Backwards compatibility aliases for existing imports
_ollama_generate = llm_generate
_ollama_available = llm_available



def parse_intent(raw_text: str) -> dict:
    """Parse a natural language buyer intent into structured constraints.

    Returns dict with: budget, category, size, color, delivery_deadline, brand, etc.
    """
    if _ollama_available():
        try:
            return _parse_intent_ollama(raw_text)
        except Exception:
            pass

    return _parse_intent_rule_based(raw_text)


def generate_negotiation_response(
    product_name: str,
    original_price: float,
    proposed_price: float,
    merchant_policy: dict,
    buyer_message: str = ""
) -> dict:
    """Generate an LLM-powered negotiation response.

    The LLM proposes a counter-offer but NEVER directly authorizes payment.
    All offers must still pass through the policy engine.
    """
    if _ollama_available():
        try:
            return _negotiate_ollama(
                product_name, original_price, proposed_price, merchant_policy, buyer_message
            )
        except Exception:
            pass

    return _negotiate_rule_based(product_name, original_price, proposed_price, merchant_policy)


def normalize_catalog_llm(raw_text: str) -> list[dict] | None:
    """Use local LLM to extract structured product data. Returns None if unavailable."""
    if not _ollama_available():
        return None

    try:
        prompt = f"""You are a product catalog normalizer. Extract ALL products from the following raw catalog text.

For EACH product, return a JSON object with these exact fields:
- name: string (clean product name)
- price: number (in INR, numeric only)
- stock: number (default 10 if unknown)
- category: string (best-fit category)
- delivery_days: number (default 7 if unknown)
- return_policy: string (e.g. "7-day returns", "No returns")
- variants: object (e.g. {{"colors": ["black", "white"], "sizes": ["S", "M", "L"]}})
- confidence: object with field-level confidence scores 0.0-1.0
- needs_verification: boolean (true if any field has confidence < 0.7)

Return ONLY a valid JSON array, no markdown, no explanation.

Raw catalog:
{raw_text}"""

        text = _ollama_generate(prompt, timeout=60.0)
        text = text.strip()
        if text.startswith("```"):
            text = re.sub(r"^```(?:json)?\n?", "", text)
            text = re.sub(r"\n?```$", "", text)

        return json.loads(text)
    except Exception:
        return None


# ─── Ollama implementations ────────────────────────────────
def _parse_intent_ollama(raw_text: str) -> dict:
    prompt = f"""Parse this buyer's shopping intent into structured constraints.

Buyer says: "{raw_text}"

Return ONLY a valid JSON object with these fields (use null if not mentioned):
- budget: number (max price in INR)
- category: string (broad vertical: "Smartphones", "Audio", "Laptops", "Food & Dining", "Entertainment & Cinema", "Sports & Footwear", "Fashion & Apparel", "Beauty & Wellness", "Travel & Flights", "Home Services", "Groceries & Fresh", "E-commerce & Retail", or null if not an explicit broad vertical)
- size: string (S/M/L/XL or shoe size etc.)
- color: string
- brand: string
- delivery_deadline: number (max delivery days)
- keywords: array of strings (specific product nouns or query terms, e.g. ["clock"], ["iphone"], ["shoes"])
- quantity: number (default 1)

Return ONLY the JSON, no explanation."""

    text = _ollama_generate(prompt)
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\n?", "", text)
        text = re.sub(r"\n?```$", "", text)

    # Try to find JSON in response
    json_match = re.search(r'\{[^{}]*\}', text, re.DOTALL)
    if json_match:
        return json.loads(json_match.group())
    return json.loads(text)


def _negotiate_ollama(
    product_name: str, original_price: float, proposed_price: float,
    merchant_policy: dict, buyer_message: str
) -> dict:
    max_discount = merchant_policy.get("max_discount", 10)

    prompt = f"""You are a merchant's AI negotiation agent. A buyer wants to negotiate.

Product: {product_name}
Original price: Rs {original_price}
Buyer's proposed price: Rs {proposed_price}
Buyer's message: "{buyer_message}"
Merchant's max allowed discount: {max_discount}%

Rules:
- You MUST NOT offer more than {max_discount}% discount
- Be professional and friendly
- If the buyer's ask is reasonable (within policy), accept or counter-offer
- If too aggressive, politely explain the limit

Return ONLY a valid JSON object:
- counter_price: number (your counter-offer in INR, must be within policy)
- message: string (your response to the buyer)
- recommended_action: string ("accept" | "counter" | "reject")

Return ONLY the JSON, no explanation."""

    text = _ollama_generate(prompt)
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\n?", "", text)
        text = re.sub(r"\n?```$", "", text)

    json_match = re.search(r'\{[^{}]*\}', text, re.DOTALL)
    if json_match:
        return json.loads(json_match.group())
    return json.loads(text)


# ─── Rule-based fallbacks ──────────────────────────────────
def _parse_intent_rule_based(raw_text: str) -> dict:
    """Simple regex-based intent extraction."""
    text = raw_text.lower()
    constraints: dict = {
        "budget": None,
        "category": None,
        "size": None,
        "color": None,
        "brand": None,
        "delivery_deadline": None,
        "keywords": [],
        "quantity": 1,
    }

    # Budget extraction
    price_match = re.search(r'(?:under|below|within|max|budget|less than|<)\s*[₹rs.]?\s*(\d[\d,]*)', text)
    if price_match:
        constraints["budget"] = float(price_match.group(1).replace(",", ""))

    # Accurate category & keyword extraction using word boundaries
    if re.search(r'\b(?:iphone|apple phone)\b', text):
        constraints["category"] = "Smartphones"
        constraints["keywords"].append("iphone")
        constraints["brand"] = "Apple"
    elif re.search(r'\b(?:galaxy|s\d+|pixel|oneplus|redmi|realme|xiaomi|vivo|oppo|smartphone|smartphones|mobile|mobiles|phone|phones)\b', text):
        constraints["category"] = "Smartphones"
        if "galaxy" in text or re.search(r'\bs\d+\b', text):
            constraints["brand"] = "Samsung"
        elif "pixel" in text:
            constraints["brand"] = "Google"
        elif "oneplus" in text:
            constraints["brand"] = "OnePlus"
        constraints["keywords"].append("phone")
    elif re.search(r'\b(?:headphone|headphones|earphone|earphones|earbuds|airpods)\b', text):
        constraints["category"] = "Audio"
        constraints["keywords"].append("headphones")
    elif re.search(r'\b(?:laptop|notebook|macbook)\b', text):
        constraints["category"] = "Laptops"
        constraints["keywords"].append("laptop")
    elif re.search(r'\b(?:tablet|ipad)\b', text):
        constraints["category"] = "Tablets"
        constraints["keywords"].append("ipad" if "ipad" in text else "tablet")
    elif re.search(r'\b(?:dress|gown)\b', text):
        constraints["category"] = "Dresses"
        constraints["keywords"].append("dress")
    elif re.search(r'\b(?:saree|sari)\b', text):
        constraints["category"] = "Sarees"
        constraints["keywords"].append("saree")
    elif re.search(r'\b(?:kurti|kurta)\b', text):
        constraints["category"] = "Ethnic Wear"
        constraints["keywords"].append("kurti")
    elif re.search(r'\b(?:shoe|shoes|sneaker|sneakers|footwear|boots)\b', text):
        constraints["category"] = "Footwear"
        constraints["keywords"].append("shoes")
    elif re.search(r'\b(?:shirt|t-shirt|tshirt|tee|polo)\b', text):
        constraints["category"] = "Clothing"
        constraints["keywords"].append("shirt")
    elif re.search(r'\b(?:keyboard|mouse|peripheral)\b', text):
        constraints["category"] = "Peripherals"
        constraints["keywords"].append("keyboard" if "keyboard" in text else "peripheral")
    elif re.search(r'\b(?:watch|smartwatch)\b', text):
        constraints["category"] = "Accessories"
        constraints["keywords"].append("watch")
    elif re.search(r'\b(?:biryani|pizza|burger|salad|curry|noodles|momos|dosa|idli|thali|paneer|kebab|tikka|tandoori|pasta|sushi|quinoa|sandwich|wrap|bowl|soup|meal|dinner|lunch|breakfast|snack|food|dining)\b', text):
        constraints["category"] = "Food & Dining"
        food_match = re.search(r'\b(biryani|pizza|burger|salad|curry|noodles|momos|dosa|idli|thali|paneer|kebab|tikka|tandoori|pasta|sushi|quinoa|sandwich|wrap|bowl|soup|meal)\b', text)
        if food_match:
            constraints["keywords"].append(food_match.group(1))
    elif re.search(r'\b(?:grocery|groceries|milk|ghee|avocado|mango|juice|coffee|tea|dairy|fresh)\b', text):
        constraints["category"] = "Groceries & Fresh"
        grocery_match = re.search(r'\b(grocery|milk|ghee|avocado|mango|juice|coffee|tea)\b', text)
        if grocery_match:
            constraints["keywords"].append(grocery_match.group(1))

    # Color extraction
    colors = ["black", "white", "red", "blue", "green", "yellow", "pink", "grey", "gray",
              "brown", "navy", "orange", "maroon", "gold", "silver", "purple"]
    for color in colors:
        if color in text:
            constraints["color"] = color
            break

    # Size extraction
    size_match = re.search(r'\b(xs|s|m|l|xl|xxl|2xl|3xl|\d{1,2}(?:uk)?)\b', text)
    if size_match:
        constraints["size"] = size_match.group(1).upper()

    # Delivery extraction
    delivery_match = re.search(r'(?:within|by|arrive|deliver|delivery)\s*(?:in\s*)?(\d+)\s*(?:day|hr|hour)', text)
    if delivery_match:
        constraints["delivery_deadline"] = int(delivery_match.group(1))
    elif "tomorrow" in text:
        constraints["delivery_deadline"] = 1
    elif "today" in text:
        constraints["delivery_deadline"] = 0

    # Extract remaining keywords (including alphanumeric tokens like s26, s24, 5g, m2)
    stop_words = {"i", "need", "want", "looking", "for", "a", "an", "the", "me", "my", "some",
                  "please", "can", "get", "find", "show", "under", "below", "within", "arrive",
                  "tomorrow", "today", "asap", "and", "or", "with", "in", "to", "of", "buy"}
    words = re.findall(r'\b[a-z0-9]+(?:-[a-z0-9]+)*\b', text)
    keywords = [w for w in words if w not in stop_words and (len(w) > 2 or (len(w) >= 2 and any(c.isdigit() for c in w)))]
    constraints["keywords"] = list(dict.fromkeys(constraints["keywords"] + keywords[:6]))

    return constraints


def _negotiate_rule_based(
    product_name: str, original_price: float,
    proposed_price: float, merchant_policy: dict
) -> dict:
    """Simple rule-based negotiation response."""
    max_discount = merchant_policy.get("max_discount", 10)
    max_discount_price = original_price * (1 - max_discount / 100)
    requested_discount = ((original_price - proposed_price) / original_price) * 100

    if requested_discount <= max_discount * 0.5:
        return {
            "counter_price": proposed_price,
            "message": f"Great offer! We're happy to sell {product_name} at Rs {proposed_price:.0f}.",
            "recommended_action": "accept",
        }
    elif requested_discount <= max_discount:
        counter = max(proposed_price, max_discount_price)
        return {
            "counter_price": round(counter, 2),
            "message": (
                f"We can offer {product_name} at Rs {counter:.0f}. "
                f"That's a {max_discount:.0f}% discount — our best price!"
            ),
            "recommended_action": "accept" if counter == proposed_price else "counter",
        }
    else:
        return {
            "counter_price": round(max_discount_price, 2),
            "message": (
                f"We appreciate your interest! The best we can offer on {product_name} "
                f"is Rs {max_discount_price:.0f} ({max_discount}% off). "
                f"We can't go lower than that, but it's a great deal!"
            ),
            "recommended_action": "counter",
        }
