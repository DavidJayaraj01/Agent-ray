"""SQLAlchemy ORM models for AgentReady."""
import datetime
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, Text, DateTime, ForeignKey, JSON
)
from backend.database import Base


def utcnow():
    return datetime.datetime.now(datetime.timezone.utc)


class Merchant(Base):
    __tablename__ = "merchants"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    category = Column(String(255), default="General")
    raw_catalog_text = Column(Text, default="")
    raw_catalog_url = Column(String(512), default="")
    trust_score = Column(Float, default=0.0)
    status = Column(String(50), default="pending")  # pending, processing, active
    policy_rules = Column(JSON, default=lambda: {
        "max_discount": 10,
        "min_price": 100,
        "max_auto_order": 50000,
        "negotiation_enabled": True
    })
    created_at = Column(DateTime, default=utcnow)


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    merchant_id = Column(Integer, ForeignKey("merchants.id"), nullable=False)
    name = Column(String(255), nullable=False)
    price = Column(Float, nullable=False)
    stock = Column(Integer, default=0)
    category = Column(String(255), default="")
    delivery_days = Column(Integer, default=7)
    return_policy = Column(String(255), default="No returns")
    variants = Column(JSON, default=lambda: {})
    confidence_flags = Column(JSON, default=lambda: {})
    needs_verification = Column(Boolean, default=False)
    raw_text = Column(Text, default="")


class Manifest(Base):
    __tablename__ = "manifests"

    id = Column(Integer, primary_key=True, index=True)
    merchant_id = Column(Integer, ForeignKey("merchants.id"), nullable=False, unique=True)
    generated_at = Column(DateTime, default=utcnow)
    product_ids = Column(JSON, default=lambda: [])
    completeness_score = Column(Float, default=0.0)
    raw_product_count = Column(Integer, default=0)
    normalized_product_count = Column(Integer, default=0)
    flagged_count = Column(Integer, default=0)


class Intent(Base):
    __tablename__ = "intents"

    id = Column(Integer, primary_key=True, index=True)
    raw_text = Column(Text, nullable=False)
    parsed_constraints = Column(JSON, default=lambda: {})
    created_at = Column(DateTime, default=utcnow)


class Negotiation(Base):
    __tablename__ = "negotiations"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    merchant_id = Column(Integer, ForeignKey("merchants.id"), nullable=False)
    original_price = Column(Float, nullable=False)
    proposed_price = Column(Float, nullable=False)
    final_price = Column(Float, nullable=True)
    discount_percent = Column(Float, default=0.0)
    status = Column(String(50), default="pending")  # pending, accepted, rejected, blocked
    policy_reason = Column(Text, default="")
    negotiation_transcript = Column(JSON, default=lambda: [])
    created_at = Column(DateTime, default=utcnow)


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    razorpay_order_id = Column(String(255), default="")
    razorpay_payment_id = Column(String(255), default="")
    razorpay_signature = Column(String(512), default="")
    merchant_id = Column(Integer, ForeignKey("merchants.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    negotiation_id = Column(Integer, ForeignKey("negotiations.id"), nullable=True)
    amount = Column(Float, nullable=False)
    currency = Column(String(10), default="INR")
    status = Column(String(50), default="created")  # created, paid, failed, refunded
    buyer_intent = Column(Text, default="")
    created_at = Column(DateTime, default=utcnow)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=utcnow, nullable=False)
    merchant_id = Column(Integer, ForeignKey("merchants.id"), nullable=True)
    actor = Column(String(50), nullable=False)  # llm, policy, system, buyer
    action = Column(String(100), nullable=False)
    input_data = Column(JSON, default=lambda: {})
    output_data = Column(JSON, default=lambda: {})
    decision = Column(String(50), default="")  # approved, rejected, blocked, info
    reason = Column(Text, default="")
