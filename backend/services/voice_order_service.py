"""Voice Order Service — State machine, intent parsing, candidate matching, confirmation resolution.

Implements the VoiceOrderSession state machine:
  LISTENING -> TRANSCRIBING -> INTENT_PARSED -> CANDIDATES_SHOWN ->
  CONFIRMATION_PENDING -> POLICY_CHECK -> PAYMENT_PROCESSING -> COMPLETED (or FAILED)

Reuses existing match logic from match.py and LLM from llm_service.py.
"""
import uuid
import time
import json
import re
from enum import Enum
from dataclasses import dataclass, field
from typing import Optional

from sqlalchemy.orm import Session

from backend.models import Product, Merchant
from backend.services.llm_service import _ollama_available, _ollama_generate


# ─── State Machine ────────────────────────────────────────────
class VoiceOrderState(str, Enum):
    LISTENING = "LISTENING"
    TRANSCRIBING = "TRANSCRIBING"
    INTENT_PARSED = "INTENT_PARSED"
    CANDIDATES_SHOWN = "CANDIDATES_SHOWN"
    CONFIRMATION_PENDING = "CONFIRMATION_PENDING"
    POLICY_CHECK = "POLICY_CHECK"
    PAYMENT_PROCESSING = "PAYMENT_PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


# ─── Intent Result ────────────────────────────────────────────
@dataclass
class IntentResult:
    item_query: str = ""
    max_price: Optional[float] = None
    dietary_tags: list = field(default_factory=list)
    quantity: int = 1
    is_confirmation: bool = False
    referenced_item_hint: str = ""
    detected_language: str = "en-IN"
    raw_keywords: list = field(default_factory=list)
    category: Optional[str] = None


# ─── Candidate (lightweight product reference) ───────────────
@dataclass
class CandidateItem:
    product_id: int
    name: str
    price: float
    category: str
    merchant_id: int
    merchant_name: str
    merchant_trust_score: float
    match_score: float
    match_reasons: dict = field(default_factory=dict)
    stock: int = 0
    delivery_days: int = 1

    def to_dict(self) -> dict:
        return {
            "product_id": self.product_id,
            "name": self.name,
            "price": self.price,
            "category": self.category,
            "merchant_id": self.merchant_id,
            "merchant_name": self.merchant_name,
            "merchant_trust_score": self.merchant_trust_score,
            "match_score": self.match_score,
            "match_reasons": self.match_reasons,
            "stock": self.stock,
            "delivery_days": self.delivery_days,
        }


# ─── Voice Order Session ─────────────────────────────────────
@dataclass
class VoiceOrderSession:
    session_id: str
    state: VoiceOrderState = VoiceOrderState.LISTENING
    last_candidates: list = field(default_factory=list)  # List[CandidateItem]
    last_intent: Optional[IntentResult] = None
    chosen_item: Optional[CandidateItem] = None
    transcript_history: list = field(default_factory=list)  # List[str]
    created_at: float = field(default_factory=time.time)
    detected_language: str = "en-IN"
    order_result: Optional[dict] = None

    def to_dict(self) -> dict:
        return {
            "session_id": self.session_id,
            "state": self.state.value,
            "last_candidates": [c.to_dict() for c in self.last_candidates],
            "last_intent": {
                "item_query": self.last_intent.item_query,
                "max_price": self.last_intent.max_price,
                "dietary_tags": self.last_intent.dietary_tags,
                "quantity": self.last_intent.quantity,
                "is_confirmation": self.last_intent.is_confirmation,
                "referenced_item_hint": self.last_intent.referenced_item_hint,
                "category": self.last_intent.category,
                "raw_keywords": self.last_intent.raw_keywords,
            } if self.last_intent else None,
            "chosen_item": self.chosen_item.to_dict() if self.chosen_item else None,
            "transcript_history": self.transcript_history,
            "detected_language": self.detected_language,
            "order_result": self.order_result,
        }


# ─── In-Memory Session Store ─────────────────────────────────
_sessions: dict[str, VoiceOrderSession] = {}

# Auto-expire sessions after 30 minutes
SESSION_TTL = 1800


def create_session() -> VoiceOrderSession:
    """Create a new voice order session."""
    _cleanup_expired()
    session_id = str(uuid.uuid4())
    session = VoiceOrderSession(session_id=session_id)
    _sessions[session_id] = session
    return session


def get_session(session_id: str) -> Optional[VoiceOrderSession]:
    """Retrieve a session by ID."""
    _cleanup_expired()
    return _sessions.get(session_id)


def _cleanup_expired():
    """Remove expired sessions."""
    now = time.time()
    expired = [sid for sid, s in _sessions.items() if now - s.created_at > SESSION_TTL]
    for sid in expired:
        del _sessions[sid]


# ─── Intent Parsing ──────────────────────────────────────────

# Confirmation patterns (multilingual-aware)
CONFIRMATION_PATTERNS = [
    r'\b(order|buy|purchase|checkout|confirm|go ahead|proceed|place order|book|get)\b',
    r'\b(haan|haa|theek|thik|karo|mangwa|order kar|le lo|dedo|de do)\b',  # Hindi
    r'\b(yes|yeah|yep|sure|okay|ok|done)\b',
]

# Food/dietary keywords
FOOD_KEYWORDS = {
    "biryani", "pizza", "burger", "salad", "curry", "noodles", "momos", "dosa",
    "idli", "thali", "paneer", "chicken", "mutton", "fish", "prawns", "rice",
    "roti", "naan", "paratha", "dal", "sambar", "chutney", "raita", "kebab",
    "tikka", "tandoori", "soup", "sandwich", "wrap", "bowl", "pasta", "sushi",
    "dim sum", "dumpling", "quinoa", "avocado", "smoothie", "juice", "coffee",
    "tea", "chai", "lassi", "milkshake", "ice cream", "dessert", "cake",
    "brownie", "gulab jamun", "rasgulla", "jalebi", "halwa", "kheer",
    "biryani feast", "combo", "meal", "dinner", "lunch", "breakfast", "snack",
    "appetizer", "starter", "main course", "food", "dining",
}

DIETARY_TAGS = {
    "high protein": "high_protein",
    "protein": "high_protein",
    "vegan": "vegan",
    "vegetarian": "vegetarian",
    "veg": "vegetarian",
    "non-veg": "non_vegetarian",
    "non veg": "non_vegetarian",
    "nonveg": "non_vegetarian",
    "gluten free": "gluten_free",
    "gluten-free": "gluten_free",
    "keto": "keto",
    "low carb": "low_carb",
    "low-carb": "low_carb",
    "sugar free": "sugar_free",
    "organic": "organic",
    "jain": "jain",
    "halal": "halal",
    "healthy": "healthy",
    "diet": "diet",
    "low calorie": "low_calorie",
    "low fat": "low_fat",
}


def _check_confirmation_utterance(transcript: str, language: str) -> Optional[IntentResult]:
    """Deterministically check if utterance is a confirmation/order command."""
    text = transcript.lower().strip()
    for pattern in CONFIRMATION_PATTERNS:
        if re.search(pattern, text):
            search_indicators = ["show me", "find", "search", "looking for", "i want a", "i need a",
                                 "suggest", "recommend", "what", "dikhao", "batao"]
            is_search = any(si in text for si in search_indicators)
            if not is_search:
                intent = IntentResult(detected_language=language, is_confirmation=True)
                hint_match = re.search(
                    r'(?:order|buy|get|book|confirm|le lo|mangwa)\s+(?:the|that|ye|wo|woh)?\s*(.+?)(?:\s*$|\s+please|\s+now)',
                    text
                )
                if hint_match:
                    intent.referenced_item_hint = hint_match.group(1).strip()
                if not intent.referenced_item_hint:
                    simple_confirms = ["order it", "go ahead", "proceed", "checkout",
                                       "confirm", "yes", "yeah", "ok", "okay", "sure",
                                       "haan", "theek hai", "karo"]
                    if any(sc in text for sc in simple_confirms):
                        intent.referenced_item_hint = ""
                return intent
    return None


def parse_voice_intent(transcript: str, language: str = "en-IN") -> IntentResult:
    """Parse a voice transcript into structured intent for voice ordering.

    Uses deterministic fast check for confirmations, and LLM (NVIDIA NIM or Ollama)
    for natural search queries.
    """
    # 1. Deterministic confirmation check (instant, zero-hallucination)
    confirm_intent = _check_confirmation_utterance(transcript, language)
    if confirm_intent:
        return confirm_intent

    # 2. Search query parsing via LLM
    if _ollama_available():
        try:
            return _parse_voice_intent_ollama(transcript, language)
        except Exception:
            pass

    return _parse_voice_intent_rule_based(transcript, language)


def _parse_voice_intent_ollama(transcript: str, language: str) -> IntentResult:
    """Use Ollama to parse voice intent with strict JSON output."""
    prompt = f"""You are a voice-order intent parser for an Indian food & shopping platform.
Parse the user's voice transcript into structured JSON.

Transcript: "{transcript}"
Detected language: {language}

Return ONLY valid JSON with these exact fields:
- item_query: string (what the user wants, cleaned up)
- max_price: number or null (price ceiling in INR if mentioned)
- dietary_tags: array of strings (e.g. ["high_protein", "vegan", "vegetarian"])
- quantity: number (default 1)
- is_confirmation: boolean (true if user is confirming/ordering a previously shown item)
- referenced_item_hint: string (if confirming, what item they reference, e.g. "the quinoa one")
- category: string or null (e.g. "Food & Dining", "Smartphones", "Footwear")
- raw_keywords: array of strings (key search terms extracted)

Important rules:
- If the user says things like "order it", "go ahead", "yes", "confirm", "buy the X one" — set is_confirmation=true
- If the user is searching/browsing ("show me", "find", "I want") — set is_confirmation=false
- Extract dietary preferences if mentioned (high protein, vegan, keto, etc.)

Return ONLY the JSON, no explanation."""

    text = _ollama_generate(prompt, timeout=30.0)
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\n?", "", text)
        text = re.sub(r"\n?```$", "", text)

    json_match = re.search(r'\{[^{}]*\}', text, re.DOTALL)
    if json_match:
        data = json.loads(json_match.group())
    else:
        data = json.loads(text)

    category = data.get("category")
    raw_keywords = data.get("raw_keywords", [])
    if not raw_keywords and data.get("item_query"):
        raw_keywords = [w for w in re.findall(r'\b\w+\b', data["item_query"].lower()) if len(w) > 2]

    # If LLM didn't detect category, infer from food keywords or dietary tags
    if not category:
        t_lower = transcript.lower()
        if any(fk in t_lower for fk in FOOD_KEYWORDS) or data.get("dietary_tags"):
            category = "Food & Dining"

    return IntentResult(
        item_query=data.get("item_query", transcript),
        max_price=data.get("max_price"),
        dietary_tags=data.get("dietary_tags", []),
        quantity=data.get("quantity", 1),
        is_confirmation=data.get("is_confirmation", False),
        referenced_item_hint=data.get("referenced_item_hint", ""),
        detected_language=language,
        raw_keywords=raw_keywords,
        category=category,
    )


def _parse_voice_intent_rule_based(transcript: str, language: str) -> IntentResult:
    """Rule-based voice intent parser with food/dietary support."""
    text = transcript.lower().strip()
    intent = IntentResult(detected_language=language)

    # 1. Check if this is a confirmation utterance
    for pattern in CONFIRMATION_PATTERNS:
        if re.search(pattern, text):
            # But only if it doesn't look like a fresh search
            search_indicators = ["show me", "find", "search", "looking for", "i want a", "i need a",
                                 "suggest", "recommend", "what", "dikhao", "batao"]
            is_search = any(si in text for si in search_indicators)
            if not is_search:
                intent.is_confirmation = True
                # Extract referenced item hint
                # e.g., "order the quinoa salad" -> "quinoa salad"
                hint_match = re.search(
                    r'(?:order|buy|get|book|confirm|le lo|mangwa)\s+(?:the|that|ye|wo|woh)?\s*(.+?)(?:\s*$|\s+please|\s+now)',
                    text
                )
                if hint_match:
                    intent.referenced_item_hint = hint_match.group(1).strip()
                # If just "order it" / "go ahead" with no specific item
                if not intent.referenced_item_hint:
                    simple_confirms = ["order it", "go ahead", "proceed", "checkout",
                                       "confirm", "yes", "yeah", "ok", "okay", "sure",
                                       "haan", "theek hai", "karo"]
                    if any(sc in text for sc in simple_confirms):
                        intent.referenced_item_hint = ""  # ambiguous if multiple candidates
                return intent

    # 2. Extract price constraint
    price_match = re.search(
        r'(?:under|below|within|max|budget|less than|under|upto|up to|<|se kam|ke andar)\s*[₹rs.]*\s*(\d[\d,]*)',
        text
    )
    if price_match:
        intent.max_price = float(price_match.group(1).replace(",", ""))

    # 3. Extract dietary tags
    for tag_phrase, tag_key in DIETARY_TAGS.items():
        if tag_phrase in text:
            intent.dietary_tags.append(tag_key)

    # 4. Extract quantity
    qty_match = re.search(r'(\d+)\s*(?:plates?|portions?|servings?|pieces?|items?|nos?)\b', text)
    if qty_match:
        intent.quantity = int(qty_match.group(1))

    # 5. Detect category (food vs shopping)
    food_detected = False
    for fk in FOOD_KEYWORDS:
        if fk in text:
            food_detected = True
            intent.raw_keywords.append(fk)

    if food_detected or intent.dietary_tags:
        intent.category = "Food & Dining"
    else:
        # Reuse shopping category detection patterns
        if re.search(r'\b(?:phone|smartphone|mobile|iphone|galaxy|pixel)\b', text):
            intent.category = "Smartphones"
        elif re.search(r'\b(?:laptop|macbook|notebook)\b', text):
            intent.category = "Laptops"
        elif re.search(r'\b(?:shoe|shoes|sneaker|sneakers|footwear)\b', text):
            intent.category = "Footwear"
        elif re.search(r'\b(?:headphone|earphone|earbuds|airpods|audio)\b', text):
            intent.category = "Audio"
        elif re.search(r'\b(?:dress|gown|saree|kurta|kurti)\b', text):
            intent.category = "Fashion & Apparel"
        elif re.search(r'\b(?:movie|cinema|ticket|concert|show)\b', text):
            intent.category = "Entertainment & Cinema"
        elif re.search(r'\b(?:flight|travel|airline)\b', text):
            intent.category = "Travel & Flights"
        elif re.search(r'\b(?:beauty|skincare|makeup|cosmetic)\b', text):
            intent.category = "Beauty & Skincare"
        elif re.search(r'\b(?:grocery|groceries|fresh|dairy|milk)\b', text):
            intent.category = "Groceries & Fresh"

    # 6. Extract remaining keywords
    stop_words = {
        "i", "need", "want", "looking", "for", "a", "an", "the", "me", "my", "some",
        "please", "can", "get", "find", "show", "under", "below", "within",
        "and", "or", "with", "in", "to", "of", "buy", "order", "good", "best",
        "top", "that", "this", "give", "se", "ke", "ka", "ki", "ko", "hai",
        "mujhe", "chahiye", "do", "karo", "dikhao", "batao", "rupees", "rs",
    }
    words = re.findall(r'\b[a-z0-9]+(?:-[a-z0-9]+)*\b', text)
    keywords = [w for w in words if w not in stop_words and len(w) > 2]
    intent.raw_keywords = list(dict.fromkeys(intent.raw_keywords + keywords[:8]))

    # Build item_query from keywords
    intent.item_query = " ".join(intent.raw_keywords[:5]) if intent.raw_keywords else transcript

    return intent


# ─── Candidate Matching ──────────────────────────────────────

def match_candidates(intent: IntentResult, db: Session) -> list[CandidateItem]:
    """Match catalog products against voice intent.

    Reuses the existing match logic from routers/match.py.
    """
    from backend.routers.match import _compute_match, _ensure_live_marketplace_products

    # Build constraints dict compatible with existing match logic
    constraints: dict = {
        "keywords": intent.raw_keywords,
        "category": intent.category,
        "budget": intent.max_price,
    }

    raw_query = intent.item_query

    # Run live marketplace discovery
    if raw_query:
        try:
            _ensure_live_marketplace_products(
                db=db,
                query=raw_query,
                category=intent.category,
                budget=intent.max_price,
            )
        except Exception:
            pass  # Non-fatal: continue with existing DB products

    # Query products
    query = (
        db.query(Product, Merchant)
        .join(Merchant, Product.merchant_id == Merchant.id)
        .filter(Merchant.status == "active")
    )

    if intent.category and intent.category.lower() != "all":
        query = query.filter(
            (Merchant.category.ilike(f"%{intent.category}%"))
            | (Product.category.ilike(f"%{intent.category}%"))
        )

    products = query.all()

    candidates = []
    for product, merchant in products:
        score, reasons = _compute_match(product, merchant, constraints, raw_query)
        if score > 0:
            candidates.append(CandidateItem(
                product_id=product.id,
                name=product.name,
                price=product.price,
                category=product.category,
                merchant_id=merchant.id,
                merchant_name=merchant.name,
                merchant_trust_score=merchant.trust_score,
                match_score=score,
                match_reasons=reasons,
                stock=product.stock,
                delivery_days=product.delivery_days,
            ))

    # Sort by match score descending, return top 5
    candidates.sort(key=lambda c: c.match_score, reverse=True)
    return candidates[:5]


# ─── Confirmation Resolution ────────────────────────────────

def resolve_confirmation(
    transcript: str, session: VoiceOrderSession
) -> tuple[Optional[CandidateItem], Optional[str]]:
    """Resolve a confirmation utterance against the session's last candidates.

    Returns:
        (chosen_item, clarification_message)
        - If resolved: (CandidateItem, None)
        - If ambiguous: (None, "Which item did you mean? ...")
        - If no candidates: (None, "No items to order. Please search first.")
    """
    candidates = session.last_candidates
    if not candidates:
        return None, "You haven't searched for any items yet. Please tell me what you'd like to order."

    # If only 1 candidate, any confirmation resolves to it
    if len(candidates) == 1:
        return candidates[0], None

    # Try to resolve by hint
    hint = transcript.lower().strip()

    # Remove confirmation words to extract item reference
    for pattern in CONFIRMATION_PATTERNS:
        hint = re.sub(pattern, "", hint)
    hint = re.sub(r'\b(the|that|this|ye|wo|woh|please|now)\b', '', hint).strip()

    if not hint or len(hint) < 3:
        # Generic confirmation like "order it" / "go ahead" with multiple candidates
        names = ", ".join(c.name for c in candidates[:3])
        return None, f"I have {len(candidates)} items. Which one would you like to order? {names}"

    # Score each candidate against the hint
    best_match = None
    best_score = 0
    for candidate in candidates:
        name_lower = candidate.name.lower()
        score = 0

        # Exact substring match
        if hint in name_lower:
            score += 100
        else:
            # Word-level matching
            hint_words = set(hint.split())
            name_words = set(name_lower.split())
            common = hint_words & name_words
            if common:
                score += len(common) * 30

            # Fuzzy partial matching
            for hw in hint_words:
                if len(hw) >= 3 and hw in name_lower:
                    score += 20

        if score > best_score:
            best_score = score
            best_match = candidate

    if best_match and best_score >= 20:
        return best_match, None

    # Could not resolve
    names = ", ".join(c.name for c in candidates[:3])
    return None, f"I'm not sure which item you mean. Could you be more specific? Your options are: {names}"
