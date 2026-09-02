"""Pydantic schemas for request/response validation."""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime


# ─── Merchant ───────────────────────────────────────────────
class PolicyRules(BaseModel):
    max_discount: float = 10
    min_price: float = 100
    max_auto_order: float = 50000
    negotiation_enabled: bool = True


class MerchantCreate(BaseModel):
    name: str
    category: str = "General"
    raw_catalog_text: str = ""
    raw_catalog_url: str = ""
    policy_rules: Optional[PolicyRules] = None


class MerchantResponse(BaseModel):
    id: int
    name: str
    category: str
    trust_score: float
    status: str
    policy_rules: dict
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MerchantUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    policy_rules: Optional[PolicyRules] = None


# ─── Product ───────────────────────────────────────────────
class ProductResponse(BaseModel):
    id: int
    merchant_id: int
    name: str
    price: float
    stock: int
    category: str
    delivery_days: int
    return_policy: str
    variants: dict
    confidence_flags: dict
    needs_verification: bool
    raw_text: str = ""

    model_config = ConfigDict(from_attributes=True)


# ─── Manifest ──────────────────────────────────────────────
class ManifestResponse(BaseModel):
    id: int
    merchant_id: int
    generated_at: datetime
    product_ids: list
    completeness_score: float
    raw_product_count: int
    normalized_product_count: int
    flagged_count: int

    model_config = ConfigDict(from_attributes=True)


# ─── Intent ────────────────────────────────────────────────
class IntentRequest(BaseModel):
    raw_text: str


class IntentResponse(BaseModel):
    id: int
    raw_text: str
    parsed_constraints: dict

    model_config = ConfigDict(from_attributes=True)


# ─── Match ─────────────────────────────────────────────────
class MatchRequest(BaseModel):
    constraints: dict = Field(default_factory=dict)
    intent_id: Optional[int] = None


class MatchResult(BaseModel):
    product: ProductResponse
    match_score: float
    match_reasons: dict
    merchant_name: str = ""
    merchant_trust_score: float = 0.0


class MatchResponse(BaseModel):
    results: list[MatchResult]
    total: int


# ─── Negotiation ──────────────────────────────────────────
class NegotiateRequest(BaseModel):
    product_id: int
    proposed_price: float
    buyer_message: str = ""


class CounterOfferRequest(BaseModel):
    proposed_price: Optional[float] = None
    buyer_message: str = ""
    action: str = "offer"  # "offer", "accept", "decline"


class NegotiateResponse(BaseModel):
    id: int
    product_id: int
    original_price: float
    proposed_price: float
    final_price: Optional[float]
    discount_percent: float
    status: str
    policy_reason: str
    negotiation_transcript: list

    model_config = ConfigDict(from_attributes=True)


# ─── Policy ────────────────────────────────────────────────
class PolicyCheckRequest(BaseModel):
    product_id: int
    proposed_price: float
    merchant_id: int


class PolicyCheckResponse(BaseModel):
    approved: bool
    reason: str
    discount_percent: float
    max_allowed_discount: float
    proposed_price: float
    min_allowed_price: float


# ─── Order ─────────────────────────────────────────────────
class OrderCreateRequest(BaseModel):
    product_id: int
    negotiation_id: Optional[int] = None
    amount: float
    buyer_intent: str = ""


class OrderCreateResponse(BaseModel):
    id: int
    razorpay_order_id: str
    amount: float
    currency: str
    status: str
    razorpay_key_id: str = ""

    model_config = ConfigDict(from_attributes=True)


class OrderVerifyRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


class OrderVerifyResponse(BaseModel):
    verified: bool
    order_id: int
    status: str


# ─── Audit ─────────────────────────────────────────────────
class AuditLogResponse(BaseModel):
    id: int
    timestamp: datetime
    merchant_id: Optional[int]
    actor: str
    action: str
    input_data: dict
    output_data: dict
    decision: str
    reason: str
    actor_uid: str = ""
    actor_email: str = ""
    actor_role: str = ""

    model_config = ConfigDict(from_attributes=True)



# ─── Dashboard ─────────────────────────────────────────────
class TrustBreakdown(BaseModel):
    completeness: float = 0.0
    settlement_consistency: float = 0.0
    dispute_rate: float = 0.0
    freshness: float = 0.0


class DashboardResponse(BaseModel):
    merchant: MerchantResponse
    trust_breakdown: TrustBreakdown
    raw_match_rate: float = 0.0
    manifest_match_rate: float = 0.0
    recent_activity: list[AuditLogResponse] = []
    product_count: int = 0
    flagged_count: int = 0


# ─── Voice Order ───────────────────────────────────────────────
class VoiceOrderStartResponse(BaseModel):
    session_id: str
    state: str


class VoiceUtteranceRequest(BaseModel):
    """Used when sending text transcript instead of audio."""
    transcript: str
    language_code: str = "en-IN"


class VoiceCandidateResponse(BaseModel):
    product_id: int
    name: str
    price: float
    category: str
    merchant_id: int
    merchant_name: str
    merchant_trust_score: float
    match_score: float
    match_reasons: dict = {}
    stock: int = 0
    delivery_days: int = 1


class VoiceOrderResultResponse(BaseModel):
    order_id: int
    razorpay_order_id: str
    amount: float
    currency: str = "INR"
    status: str
    product_name: str = ""
    merchant_name: str = ""


class VoiceUtteranceResponse(BaseModel):
    state: str
    spoken_response: str = ""
    spoken_audio_base64: Optional[str] = None
    candidates: list[VoiceCandidateResponse] = []
    requires_confirmation: bool = False
    order_result: Optional[VoiceOrderResultResponse] = None
    clarification_needed: bool = False
    policy_rejection: Optional[str] = None
    transcript: str = ""
    parsed_intent: Optional[dict] = None


class VoiceSessionResponse(BaseModel):
    session_id: str
    state: str
    candidates: list[VoiceCandidateResponse] = []
    transcript_history: list[str] = []
    order_result: Optional[VoiceOrderResultResponse] = None

