"""SQLAlchemy ORM models for AgentReady with full type annotations."""
import datetime
from typing import Optional, Any, Dict, List
from sqlalchemy import (
    Integer, String, Float, Boolean, Text, DateTime, ForeignKey, JSON
)
from sqlalchemy.orm import Mapped, mapped_column
from backend.database import Base


def utcnow() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc)


class Merchant(Base):
    __tablename__ = "merchants"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(255), default="General")
    raw_catalog_text: Mapped[str] = mapped_column(Text, default="")
    raw_catalog_url: Mapped[str] = mapped_column(String(512), default="")
    trust_score: Mapped[float] = mapped_column(Float, default=0.0)
    status: Mapped[str] = mapped_column(String(50), default="pending")  # pending, processing, active
    policy_rules: Mapped[Dict[str, Any]] = mapped_column(JSON, default=lambda: {
        "max_discount": 10,
        "min_price": 100,
        "max_auto_order": 50000,
        "negotiation_enabled": True
    })
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=utcnow)


class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    merchant_id: Mapped[int] = mapped_column(Integer, ForeignKey("merchants.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    price: Mapped[float] = mapped_column(Float, nullable=False)
    stock: Mapped[int] = mapped_column(Integer, default=0)
    category: Mapped[str] = mapped_column(String(255), default="")
    delivery_days: Mapped[int] = mapped_column(Integer, default=7)
    return_policy: Mapped[str] = mapped_column(String(255), default="No returns")
    variants: Mapped[Dict[str, Any]] = mapped_column(JSON, default=lambda: {})
    confidence_flags: Mapped[Dict[str, Any]] = mapped_column(JSON, default=lambda: {})
    needs_verification: Mapped[bool] = mapped_column(Boolean, default=False)
    raw_text: Mapped[str] = mapped_column(Text, default="")


class Manifest(Base):
    __tablename__ = "manifests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    merchant_id: Mapped[int] = mapped_column(Integer, ForeignKey("merchants.id"), nullable=False, unique=True)
    generated_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=utcnow)
    product_ids: Mapped[List[int]] = mapped_column(JSON, default=lambda: [])
    completeness_score: Mapped[float] = mapped_column(Float, default=0.0)
    raw_product_count: Mapped[int] = mapped_column(Integer, default=0)
    normalized_product_count: Mapped[int] = mapped_column(Integer, default=0)
    flagged_count: Mapped[int] = mapped_column(Integer, default=0)


class Intent(Base):
    __tablename__ = "intents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    raw_text: Mapped[str] = mapped_column(Text, nullable=False)
    parsed_constraints: Mapped[Dict[str, Any]] = mapped_column(JSON, default=lambda: {})
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=utcnow)


class Negotiation(Base):
    __tablename__ = "negotiations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    product_id: Mapped[int] = mapped_column(Integer, ForeignKey("products.id"), nullable=False)
    merchant_id: Mapped[int] = mapped_column(Integer, ForeignKey("merchants.id"), nullable=False)
    original_price: Mapped[float] = mapped_column(Float, nullable=False)
    proposed_price: Mapped[float] = mapped_column(Float, nullable=False)
    final_price: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    discount_percent: Mapped[float] = mapped_column(Float, default=0.0)
    status: Mapped[str] = mapped_column(String(50), default="pending")  # pending, accepted, rejected, blocked
    policy_reason: Mapped[str] = mapped_column(Text, default="")
    negotiation_transcript: Mapped[List[Dict[str, Any]]] = mapped_column(JSON, default=lambda: [])
    buyer_uid: Mapped[str] = mapped_column(String(128), default="")
    buyer_email: Mapped[str] = mapped_column(String(255), default="")
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=utcnow)


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    razorpay_order_id: Mapped[str] = mapped_column(String(255), default="")
    razorpay_payment_id: Mapped[str] = mapped_column(String(255), default="")
    razorpay_signature: Mapped[str] = mapped_column(String(512), default="")
    merchant_id: Mapped[int] = mapped_column(Integer, ForeignKey("merchants.id"), nullable=False)
    product_id: Mapped[int] = mapped_column(Integer, ForeignKey("products.id"), nullable=False)
    negotiation_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("negotiations.id"), nullable=True)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    currency: Mapped[str] = mapped_column(String(10), default="INR")
    status: Mapped[str] = mapped_column(String(50), default="created")  # created, paid, failed, refunded, pending_approval
    buyer_intent: Mapped[str] = mapped_column(Text, default="")
    buyer_uid: Mapped[str] = mapped_column(String(128), default="")
    buyer_email: Mapped[str] = mapped_column(String(255), default="")
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=utcnow)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    timestamp: Mapped[datetime.datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    merchant_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("merchants.id"), nullable=True)
    actor: Mapped[str] = mapped_column(String(50), nullable=False)  # llm, policy, system, buyer
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    input_data: Mapped[Dict[str, Any]] = mapped_column(JSON, default=lambda: {})
    output_data: Mapped[Dict[str, Any]] = mapped_column(JSON, default=lambda: {})
    decision: Mapped[str] = mapped_column(String(50), default="")  # approved, rejected, blocked, info
    reason: Mapped[str] = mapped_column(Text, default="")
    actor_uid: Mapped[str] = mapped_column(String(128), default="")
    actor_email: Mapped[str] = mapped_column(String(255), default="")
    actor_role: Mapped[str] = mapped_column(String(50), default="")
