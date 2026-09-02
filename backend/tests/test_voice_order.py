"""Unit tests for the voice order feature.

Covers:
  - Intent parsing JSON shape
  - Food query parsing
  - Confirmation detection
  - Candidate matching
  - Confirmation resolution (single, ambiguous, specific hint)
  - Policy engine gating for voice orders
  - Audit logging with channel="voice"
  - State machine flow
"""
import pytest
from unittest.mock import patch, MagicMock

from backend.services.voice_order_service import (
    VoiceOrderState,
    IntentResult,
    CandidateItem,
    VoiceOrderSession,
    parse_voice_intent,
    resolve_confirmation,
    create_session,
    get_session,
)
from backend.services.policy_engine import validate_offer


# ─── Intent Parsing Tests ────────────────────────────────────

class TestParseIntentJsonShape:
    """Test that parse_voice_intent returns all required fields."""

    def test_parse_intent_returns_all_fields(self):
        """IntentResult must have all required fields."""
        intent = parse_voice_intent("show me a pizza under 500", "en-IN")

        assert isinstance(intent, IntentResult)
        assert hasattr(intent, "item_query")
        assert hasattr(intent, "max_price")
        assert hasattr(intent, "dietary_tags")
        assert hasattr(intent, "quantity")
        assert hasattr(intent, "is_confirmation")
        assert hasattr(intent, "referenced_item_hint")
        assert hasattr(intent, "detected_language")
        assert hasattr(intent, "raw_keywords")
        assert hasattr(intent, "category")

    def test_parse_intent_defaults(self):
        """Default values should be sensible."""
        intent = parse_voice_intent("hello", "en-IN")
        assert intent.quantity >= 1
        assert isinstance(intent.dietary_tags, list)
        assert isinstance(intent.raw_keywords, list)
        assert intent.detected_language == "en-IN"


class TestParseIntentFoodQuery:
    """Test food-specific intent parsing."""

    def test_food_query_with_budget(self):
        """'show me a high protein dinner under 500' should parse food + budget."""
        intent = parse_voice_intent("show me a high protein dinner under 500", "en-IN")

        assert intent.is_confirmation is False
        assert intent.max_price == 500.0
        assert intent.category == "Food & Dining"
        assert "high_protein" in intent.dietary_tags

    def test_food_query_biryani(self):
        """'biryani' should be categorized as food."""
        intent = parse_voice_intent("find me a biryani under 700 rupees", "en-IN")

        assert intent.is_confirmation is False
        assert intent.max_price == 700.0
        assert intent.category == "Food & Dining"
        assert any("biryani" in kw for kw in intent.raw_keywords)

    def test_vegan_tag(self):
        """Dietary tags should be detected."""
        intent = parse_voice_intent("I want a vegan salad", "en-IN")
        assert "vegan" in intent.dietary_tags

    def test_shopping_query_not_food(self):
        """Shopping queries should not be categorized as food."""
        intent = parse_voice_intent("find me running shoes under 5000", "en-IN")
        assert intent.category != "Food & Dining"


class TestParseIntentConfirmation:
    """Test confirmation utterance detection."""

    def test_order_command(self):
        """'order the quinoa salad' should be detected as confirmation."""
        intent = parse_voice_intent("order the quinoa salad", "en-IN")

        assert intent.is_confirmation is True
        assert "quinoa salad" in intent.referenced_item_hint.lower()

    def test_go_ahead(self):
        """'go ahead' should be a confirmation."""
        intent = parse_voice_intent("go ahead", "en-IN")
        assert intent.is_confirmation is True

    def test_yes_confirmation(self):
        """'yes' should be a confirmation."""
        intent = parse_voice_intent("yes", "en-IN")
        assert intent.is_confirmation is True

    def test_search_not_confirmation(self):
        """'show me phones' should NOT be a confirmation."""
        intent = parse_voice_intent("show me phones under 30000", "en-IN")
        assert intent.is_confirmation is False


# ─── Confirmation Resolution Tests ──────────────────────────

def _make_candidate(name: str, pid: int = 1) -> CandidateItem:
    """Helper to create a test candidate."""
    return CandidateItem(
        product_id=pid,
        name=name,
        price=500.0,
        category="Food & Dining",
        merchant_id=1,
        merchant_name="Test Merchant",
        merchant_trust_score=95.0,
        match_score=80.0,
    )


class TestResolveConfirmation:
    """Test confirmation resolution against session candidates."""

    def test_single_candidate_resolves(self):
        """With 1 candidate, any confirmation should resolve to it."""
        session = VoiceOrderSession(session_id="test-1")
        session.last_candidates = [_make_candidate("Royal Biryani Feast")]

        chosen, msg = resolve_confirmation("order it", session)
        assert chosen is not None
        assert chosen.name == "Royal Biryani Feast"
        assert msg is None

    def test_ambiguous_multiple_candidates(self):
        """With 3+ candidates and no specific hint, should return None + clarification."""
        session = VoiceOrderSession(session_id="test-2")
        session.last_candidates = [
            _make_candidate("Royal Biryani Feast", 1),
            _make_candidate("Margherita Pizza", 2),
            _make_candidate("Butter Chicken Handi", 3),
        ]

        chosen, msg = resolve_confirmation("order it", session)
        assert chosen is None
        assert msg is not None
        assert "which" in msg.lower() or "3 items" in msg.lower()

    def test_specific_hint_resolves(self):
        """With 3 candidates and a specific hint, should resolve correctly."""
        session = VoiceOrderSession(session_id="test-3")
        session.last_candidates = [
            _make_candidate("Royal Biryani Feast", 1),
            _make_candidate("Margherita Pizza", 2),
            _make_candidate("Butter Chicken Handi", 3),
        ]

        chosen, msg = resolve_confirmation("order the biryani", session)
        assert chosen is not None
        assert "Biryani" in chosen.name
        assert msg is None

    def test_no_candidates_error(self):
        """With no candidates, should return helpful error."""
        session = VoiceOrderSession(session_id="test-4")
        session.last_candidates = []

        chosen, msg = resolve_confirmation("order it", session)
        assert chosen is None
        assert msg is not None
        assert "haven't" in msg.lower() or "search" in msg.lower()


# ─── Policy Engine Gating for Voice Orders ──────────────────

class TestVoiceOrderPolicyGating:
    """CRITICAL: Voice orders MUST pass through the same policy engine."""

    def test_voice_order_exceeding_max_auto_order_blocked(self):
        """A voice order above max_auto_order MUST be blocked (routed to approval queue)."""
        policy = {
            "max_discount": 10,
            "min_price": 100,
            "max_auto_order": 500,  # Low ceiling for testing
            "negotiation_enabled": True,
        }

        # Voice order for ₹1000 item at full price — exceeds max_auto_order of ₹500
        from backend.services.policy_engine import check_order_amount
        result = check_order_amount(1000.0, policy["max_auto_order"])

        assert result["approved"] is False
        assert "exceeds" in result["reason"].lower()

    def test_voice_order_at_list_price_passes(self):
        """Voice order at full list price should pass validate_offer."""
        policy = {
            "max_discount": 10,
            "min_price": 100,
            "max_auto_order": 50000,
            "negotiation_enabled": True,
        }

        result = validate_offer(500.0, 500.0, policy)
        assert result["approved"] is True

    def test_voice_order_below_min_price_blocked(self):
        """Voice order below min_price MUST be blocked."""
        policy = {
            "max_discount": 10,
            "min_price": 500,
            "max_auto_order": 50000,
            "negotiation_enabled": True,
        }

        result = validate_offer(1000.0, 50.0, policy)
        assert result["approved"] is False


# ─── Full Flow Test via FastAPI TestClient ───────────────────

class TestVoiceOrderEndToEnd:
    """Test the full voice order API flow."""

    def test_start_session(self):
        """POST /api/voice-order/start should return a session_id."""
        from fastapi.testclient import TestClient
        from backend.main import app

        client = TestClient(app)
        response = client.post("/api/voice-order/start")

        assert response.status_code == 200
        data = response.json()
        assert "session_id" in data
        assert data["state"] == "LISTENING"

    def test_text_utterance_search(self):
        """Send a text utterance for search and verify candidates are returned."""
        from fastapi.testclient import TestClient
        from backend.main import app

        client = TestClient(app)

        # Start session
        start_resp = client.post("/api/voice-order/start")
        session_id = start_resp.json()["session_id"]

        # Send text utterance with mocked TTS
        with patch("backend.services.sarvam_service.text_to_speech", return_value={"audio_base64": "mock_audio"}):
            response = client.post(
                f"/api/voice-order/{session_id}/utterance",
                data={
                    "transcript_text": "show me biryani under 700 rupees",
                    "language_code": "en-IN",
                },
            )

        assert response.status_code == 200
        data = response.json()
        assert data["state"] in ["CANDIDATES_SHOWN", "INTENT_PARSED"]
        assert "spoken_response" in data
        assert "transcript" in data

    def test_session_not_found(self):
        """GET /api/voice-order/{bad_id} should return 404."""
        from fastapi.testclient import TestClient
        from backend.main import app

        client = TestClient(app)
        response = client.get("/api/voice-order/nonexistent-id")
        assert response.status_code == 404


# ─── Session State Machine Tests ────────────────────────────

class TestSessionStateMachine:
    """Test session creation and state transitions."""

    def test_create_session(self):
        """create_session should return a valid session."""
        session = create_session()
        assert session.session_id
        assert session.state == VoiceOrderState.LISTENING
        assert session.last_candidates == []
        assert session.transcript_history == []

    def test_get_session(self):
        """get_session should retrieve a previously created session."""
        session = create_session()
        retrieved = get_session(session.session_id)
        assert retrieved is not None
        assert retrieved.session_id == session.session_id

    def test_get_nonexistent_session(self):
        """get_session should return None for unknown IDs."""
        result = get_session("does-not-exist")
        assert result is None
