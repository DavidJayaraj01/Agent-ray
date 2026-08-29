"""WebSocket negotiation — real-time streaming of offers, counters, and policy checks."""
import asyncio
import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from backend.database import SessionLocal
from backend.models import Product, Merchant, Negotiation
from backend.services.llm_service import generate_negotiation_response
from backend.services.policy_engine import validate_offer
from backend.services.audit_service import log_event

router = APIRouter(tags=["ws_negotiate"])

# In-memory rate tracking for abuse guard
_negotiation_attempts: dict[str, list[float]] = {}
RATE_WINDOW_SECONDS = 600  # 10 minutes
MAX_ATTEMPTS = 5


def _check_rate_limit(product_id: int, proposed_price: float = 0, original_price: float = 0) -> dict:
    """Check if negotiation rate limit is exceeded for a product."""
    if proposed_price >= original_price or (original_price > 0 and original_price <= 500):
        return {"approved": True}

    import time
    key = f"product_{product_id}"
    now = time.time()

    if key not in _negotiation_attempts:
        _negotiation_attempts[key] = []

    # Clean old entries
    _negotiation_attempts[key] = [t for t in _negotiation_attempts[key] if now - t < RATE_WINDOW_SECONDS]

    if len(_negotiation_attempts[key]) >= MAX_ATTEMPTS:
        return {
            "approved": False,
            "reason": (
                f"Rate limit exceeded: {MAX_ATTEMPTS} negotiation attempts "
                f"on this product in the last {RATE_WINDOW_SECONDS // 60} minutes. "
                f"Please wait before trying again."
            ),
        }

    _negotiation_attempts[key].append(now)
    return {"approved": True}



@router.websocket("/ws/negotiate/{product_id}")
async def ws_negotiate(websocket: WebSocket, product_id: int):
    """WebSocket negotiation endpoint.

    Streams negotiation transcript in real-time:
    1. Client sends: { "proposed_price": float, "buyer_message": str }
    2. Server streams individual messages with delays for live-demo effect
    3. Supports multi-round: after "counter", client can send another offer (max 3 rounds)
    """
    await websocket.accept()
    round_count = 0
    max_rounds = 3
    negotiation_id = None

    db: Session = SessionLocal()
    try:
        # Validate product exists
        product = db.query(Product).filter(Product.id == product_id).first()
        if not product:
            await websocket.send_json({"type": "error", "message": "Product not found"})
            await websocket.close()
            return

        merchant = db.query(Merchant).filter(Merchant.id == product.merchant_id).first()
        if not merchant:
            await websocket.send_json({"type": "error", "message": "Merchant not found"})
            await websocket.close()
            return

        policy_rules = merchant.policy_rules or {}

        # Send initial product info
        await websocket.send_json({
            "type": "info",
            "message": f"Connected to negotiation for {product.name} (₹{product.price:,.0f})",
            "product": {
                "id": product.id,
                "name": product.name,
                "price": product.price,
                "category": product.category,
            },
        })

        counter_price = None
        while round_count < max_rounds:
            # Wait for buyer's offer
            try:
                raw = await websocket.receive_text()
                data = json.loads(raw)
            except (WebSocketDisconnect, json.JSONDecodeError):
                break

            proposed_price = data.get("proposed_price", 0)
            buyer_message = data.get("buyer_message", "")
            action = data.get("action", "offer")  # "offer", "accept", "decline"
            round_count += 1

            # Handle explicit buyer decline
            if action == "decline":
                await websocket.send_json({
                    "type": "buyer",
                    "message": "I decline this counter-offer.",
                    "round": round_count,
                })
                await websocket.send_json({
                    "type": "policy",
                    "status": "rejected",
                    "message": "Negotiation concluded without agreement.",
                    "final_price": None,
                    "round": round_count,
                })
                if negotiation_id:
                    neg = db.query(Negotiation).filter(Negotiation.id == negotiation_id).first()
                    if neg:
                        neg.status = "rejected"
                        db.commit()
                break

            # Handle explicit buyer acceptance of counter offer
            if action == "accept" and counter_price:
                proposed_price = counter_price
                await websocket.send_json({
                    "type": "buyer",
                    "message": f"I accept your counter-offer of ₹{counter_price:,.0f}!",
                    "round": round_count,
                })
                await asyncio.sleep(0.4)
                await websocket.send_json({
                    "type": "merchant_ai",
                    "message": f"Deal accepted! We have locked in ₹{counter_price:,.0f} for you.",
                    "counter_price": counter_price,
                    "recommended_action": "accept",
                    "round": round_count,
                })
                await asyncio.sleep(0.4)
                policy_result = validate_offer(product.price, counter_price, policy_rules)
                await websocket.send_json({
                    "type": "policy",
                    "status": "accepted",
                    "message": f"Policy approved: ₹{counter_price:,.0f} ({policy_result.get('discount_percent', 0):.1f}% discount)",
                    "final_price": counter_price,
                    "discount_percent": policy_result.get("discount_percent", 0),
                    "round": round_count,
                })
                if negotiation_id:
                    neg = db.query(Negotiation).filter(Negotiation.id == negotiation_id).first()
                    if neg:
                        neg.status = "accepted"
                        neg.final_price = counter_price
                        db.commit()
                await websocket.send_json({
                    "type": "negotiation_update",
                    "negotiation_id": negotiation_id,
                    "status": "accepted",
                    "final_price": counter_price,
                    "round": round_count,
                    "max_rounds": max_rounds,
                })
                break

            # Rate limit check (abuse guard)
            rate_check = _check_rate_limit(product_id, proposed_price=proposed_price, original_price=product.price)

            if not rate_check["approved"]:
                await websocket.send_json({
                    "type": "policy",
                    "status": "blocked",
                    "message": rate_check["reason"],
                })
                log_event(
                    db, actor="policy", action="negotiation_rate_limited",
                    merchant_id=merchant.id,
                    input_data={"product_id": product_id, "proposed_price": proposed_price},
                    output_data=rate_check,
                    decision="blocked",
                    reason=rate_check["reason"],
                )
                db.commit()
                break

            # Stream: Buyer message
            await websocket.send_json({
                "type": "buyer",
                "message": buyer_message or f"I'd like to get this for ₹{proposed_price:,.0f}.",
                "round": round_count,
            })
            await asyncio.sleep(0.5)

            # Stream: "Thinking" indicator
            await websocket.send_json({
                "type": "thinking",
                "message": "Merchant AI is considering your offer...",
            })
            await asyncio.sleep(0.8)

            # LLM negotiation response (non-blocking in worker thread)
            llm_response = await asyncio.to_thread(
                generate_negotiation_response,
                product_name=product.name,
                original_price=product.price,
                proposed_price=proposed_price,
                merchant_policy=policy_rules,
                buyer_message=buyer_message,
            )

            counter_price = llm_response.get("counter_price", proposed_price)
            recommended_action = llm_response.get("recommended_action", "counter")
            llm_message = llm_response.get("message", "")

            # Stream: Merchant AI response
            await websocket.send_json({
                "type": "merchant_ai",
                "message": llm_message,
                "counter_price": counter_price,
                "recommended_action": recommended_action,
                "round": round_count,
            })
            await asyncio.sleep(0.6)

            # Policy engine validation
            final_price = counter_price if recommended_action in ("accept", "counter") else proposed_price
            policy_result = validate_offer(product.price, final_price, policy_rules)

            # Determine status
            if not policy_result["approved"]:
                status = "blocked"
                final_price_db = None
                policy_reason = policy_result["reason"]
            elif recommended_action == "accept":
                status = "accepted"
                final_price_db = final_price
                policy_reason = policy_result["reason"]
            elif recommended_action == "reject":
                status = "rejected"
                final_price_db = None
                policy_reason = "Merchant declined the offer"
            else:
                status = "counter"
                final_price_db = counter_price
                policy_reason = f"Merchant countered at ₹{counter_price:,.0f}. {policy_result['reason']}"

            # Stream: Policy check
            await websocket.send_json({
                "type": "policy",
                "status": status,
                "message": policy_reason,
                "final_price": final_price_db,
                "discount_percent": policy_result.get("discount_percent", 0),
                "round": round_count,
            })

            # Log to audit
            log_event(
                db, actor="llm", action="ws_negotiation",
                merchant_id=merchant.id,
                input_data={
                    "product_id": product.id,
                    "proposed_price": proposed_price,
                    "round": round_count,
                },
                output_data={
                    "counter_price": counter_price,
                    "status": status,
                    "policy_result": policy_result,
                },
                decision="approved" if status == "accepted" else "blocked" if status == "blocked" else "info",
                reason=policy_reason,
            )

            # Create/update negotiation record
            if negotiation_id is None:
                neg = Negotiation(
                    product_id=product.id,
                    merchant_id=merchant.id,
                    original_price=product.price,
                    proposed_price=proposed_price,
                    final_price=final_price_db,
                    discount_percent=policy_result.get("discount_percent", 0),
                    status=status,
                    policy_reason=policy_reason,
                    negotiation_transcript=[
                        {"role": "buyer", "message": buyer_message or f"Can I get this for ₹{proposed_price:,.0f}?"},
                        {"role": "merchant_ai", "message": llm_message},
                        {"role": "policy", "message": policy_reason, "status": status},
                    ],
                )
                db.add(neg)
                db.commit()
                db.refresh(neg)
                negotiation_id = neg.id
            else:
                neg = db.query(Negotiation).filter(Negotiation.id == negotiation_id).first()
                if neg:
                    transcript = list(neg.negotiation_transcript or [])
                    transcript.extend([
                        {"role": "buyer", "message": buyer_message or f"Counter: ₹{proposed_price:,.0f}"},
                        {"role": "merchant_ai", "message": llm_message},
                        {"role": "policy", "message": policy_reason, "status": status},
                    ])
                    neg.negotiation_transcript = transcript
                    neg.proposed_price = proposed_price
                    neg.final_price = final_price_db
                    neg.status = status
                    neg.policy_reason = policy_reason
                    neg.discount_percent = policy_result.get("discount_percent", 0)
                    db.commit()

            # Send negotiation_id to client
            await websocket.send_json({
                "type": "negotiation_update",
                "negotiation_id": negotiation_id,
                "status": status,
                "final_price": final_price_db,
                "round": round_count,
                "max_rounds": max_rounds,
            })

            # If terminal state, close
            if status in ("accepted", "blocked", "rejected"):
                break

            # If counter, keep connection open for next round
            if status == "counter" and round_count < max_rounds:
                await websocket.send_json({
                    "type": "counter_prompt",
                    "message": f"Round {round_count}/{max_rounds}: The merchant countered at ₹{counter_price:,.0f}. You can accept, make a new offer, or walk away.",
                    "counter_price": counter_price,
                    "rounds_remaining": max_rounds - round_count,
                })

        # Final close
        if round_count >= max_rounds:
            await websocket.send_json({
                "type": "max_rounds",
                "message": f"Maximum {max_rounds} negotiation rounds reached. Please accept the current offer or try again later.",
            })

    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass
    finally:
        db.close()
        try:
            await websocket.close()
        except Exception:
            pass
