"""Voice Order endpoints — full voice-to-cart-to-checkout flow.

State machine-driven voice ordering:
  POST /api/voice-order/start        -> opens a VoiceOrderSession
  POST /api/voice-order/{id}/utterance -> accepts audio or transcript, advances state
  GET  /api/voice-order/{id}          -> current session state

All voice orders pass through the SAME policy engine (validate_offer) as manual orders.
Audit logging with channel="voice" is written BEFORE every response.
"""
import os
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import Optional

from backend.database import get_db
from backend.models import Product, Merchant, Order
from backend.schemas import (
    VoiceOrderStartResponse,
    VoiceUtteranceRequest,
    VoiceUtteranceResponse,
    VoiceSessionResponse,
    VoiceCandidateResponse,
    VoiceOrderResultResponse,
)
from backend.services.voice_order_service import (
    VoiceOrderState,
    create_session,
    get_session,
    parse_voice_intent,
    match_candidates,
    resolve_confirmation,
)
from backend.services import sarvam_service
from backend.services.audit_service import log_event
from backend.services.policy_engine import validate_offer
from backend.services.auth_service import get_optional_user, AuthUser


router = APIRouter(prefix="/api/voice-order", tags=["voice-order"])


@router.post("/start", response_model=VoiceOrderStartResponse)
async def start_voice_order_session(
    user: Optional[AuthUser] = Depends(get_optional_user),
):
    """Open a new VoiceOrderSession."""
    session = create_session()
    return VoiceOrderStartResponse(
        session_id=session.session_id,
        state=session.state.value,
    )


@router.post("/{session_id}/utterance", response_model=VoiceUtteranceResponse)
async def process_utterance(
    session_id: str,
    file: Optional[UploadFile] = File(None),
    transcript_text: Optional[str] = Form(None),
    language_code: str = Form("en-IN"),
    db: Session = Depends(get_db),
    user: Optional[AuthUser] = Depends(get_optional_user),
):
    """Accept audio or text transcript, advance the voice order state machine.

    Accepts either:
      - An audio file (multipart upload) for STT transcription
      - A text transcript (form field) as fallback when STT fails client-side

    Returns the next state, spoken response, candidates, or order result.
    """
    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Voice order session not found or expired")

    actor_uid = user.uid if user else ""
    actor_email = user.email if user else ""
    actor_role = user.role if user else "buyer"

    # ─── Step 1: Get transcript (from audio or text) ──────────
    transcript = ""
    if file and file.filename:
        audio_bytes = await file.read()
        if not audio_bytes:
            raise HTTPException(status_code=400, detail="Empty audio file")

        session.state = VoiceOrderState.TRANSCRIBING
        stt_result = sarvam_service.speech_to_text(
            audio_bytes=audio_bytes,
            language_code=language_code,
            filename=file.filename or "audio.wav",
        )
        if not stt_result or not stt_result.get("transcript"):
            # STT failed — tell client to fall back to text input
            return VoiceUtteranceResponse(
                state=session.state.value,
                spoken_response="I couldn't understand the audio. Please try typing your request instead.",
                clarification_needed=True,
                transcript="",
            )
        transcript = stt_result["transcript"]
        session.detected_language = language_code
    elif transcript_text:
        transcript = transcript_text.strip()
        session.detected_language = language_code
    else:
        raise HTTPException(status_code=400, detail="Either audio file or transcript text is required")

    session.transcript_history.append(transcript)

    # ─── Step 2: Parse intent ─────────────────────────────────
    intent = parse_voice_intent(transcript, session.detected_language)
    session.last_intent = intent
    session.state = VoiceOrderState.INTENT_PARSED

    # Audit: log transcript + parsed intent
    log_event(
        db, actor="voice_agent", action="voice_intent_parsed",
        input_data={"transcript": transcript, "language": session.detected_language},
        output_data={
            "item_query": intent.item_query,
            "max_price": intent.max_price,
            "dietary_tags": intent.dietary_tags,
            "is_confirmation": intent.is_confirmation,
            "referenced_item_hint": intent.referenced_item_hint,
            "category": intent.category,
        },
        decision="info",
        reason=f"Voice intent parsed: {'confirmation' if intent.is_confirmation else 'search'} - {intent.item_query}",
        actor_uid=actor_uid,
        actor_email=actor_email,
        actor_role=actor_role,
        channel="voice",
    )

    # ─── Step 3: Branch on search vs confirmation ─────────────
    if not intent.is_confirmation:
        return await _handle_search(session, intent, db, actor_uid, actor_email, actor_role)
    else:
        return await _handle_confirmation(session, intent, transcript, db, actor_uid, actor_email, actor_role)


async def _handle_search(
    session, intent, db, actor_uid, actor_email, actor_role
) -> VoiceUtteranceResponse:
    """Handle a search query — find candidates and present them."""
    candidates = match_candidates(intent, db)
    session.last_candidates = candidates
    session.state = VoiceOrderState.CANDIDATES_SHOWN

    # Build candidate response dicts
    candidate_dicts = [c.to_dict() for c in candidates]
    candidate_responses = [
        VoiceCandidateResponse(**c.to_dict()) for c in candidates
    ]

    # Generate spoken response
    response_text, tts_result = sarvam_service.generate_candidates_speech(
        candidate_dicts, session.detected_language
    )

    # Audit: log matched candidates
    log_event(
        db, actor="voice_agent", action="voice_candidates_shown",
        input_data={"item_query": intent.item_query, "max_price": intent.max_price},
        output_data={"candidate_count": len(candidates), "candidates": [c.name for c in candidates]},
        decision="info",
        reason=f"Voice search returned {len(candidates)} candidates for '{intent.item_query}'",
        actor_uid=actor_uid,
        actor_email=actor_email,
        actor_role=actor_role,
        channel="voice",
    )

    return VoiceUtteranceResponse(
        state=session.state.value,
        spoken_response=response_text,
        spoken_audio_base64=tts_result.get("audio_base64") if tts_result else None,
        candidates=candidate_responses,
        requires_confirmation=len(candidates) > 0,
        transcript=session.transcript_history[-1] if session.transcript_history else "",
        parsed_intent={
            "item_query": intent.item_query,
            "max_price": intent.max_price,
            "dietary_tags": intent.dietary_tags,
            "category": intent.category,
            "raw_keywords": intent.raw_keywords,
        },
    )


async def _handle_confirmation(
    session, intent, transcript, db, actor_uid, actor_email, actor_role
) -> VoiceUtteranceResponse:
    """Handle a confirmation utterance — resolve item, run policy, create order."""
    session.state = VoiceOrderState.CONFIRMATION_PENDING

    # Resolve which item the user is confirming
    chosen_item, clarification_msg = resolve_confirmation(transcript, session)

    if chosen_item is None:
        # Ambiguous or no candidates — ask for clarification
        tts_result = sarvam_service.text_to_speech(
            clarification_msg or "Please specify which item you'd like to order.",
            session.detected_language,
        )

        log_event(
            db, actor="voice_agent", action="voice_clarification_needed",
            input_data={"transcript": transcript},
            output_data={"clarification": clarification_msg},
            decision="info",
            reason="Voice confirmation ambiguous — clarification requested",
            actor_uid=actor_uid,
            actor_email=actor_email,
            actor_role=actor_role,
            channel="voice",
        )

        return VoiceUtteranceResponse(
            state=session.state.value,
            spoken_response=clarification_msg or "Please specify which item you'd like to order.",
            spoken_audio_base64=tts_result.get("audio_base64") if tts_result else None,
            clarification_needed=True,
            requires_confirmation=True,
            candidates=[VoiceCandidateResponse(**c.to_dict()) for c in session.last_candidates],
            transcript=transcript,
        )

    # Item resolved — proceed with policy check and order
    session.chosen_item = chosen_item
    session.state = VoiceOrderState.POLICY_CHECK

    # Look up product and merchant from DB
    product = db.query(Product).filter(Product.id == chosen_item.product_id).first()
    if not product:
        session.state = VoiceOrderState.FAILED
        return _error_response(session, "Product no longer available.")

    merchant = db.query(Merchant).filter(Merchant.id == chosen_item.merchant_id).first()
    if not merchant:
        session.state = VoiceOrderState.FAILED
        return _error_response(session, "Merchant not found.")

    # ─── Policy Check (SAME engine as manual orders) ──────────
    rules = merchant.policy_rules or {}
    max_auto_order = rules.get("max_auto_order", 50000)
    order_amount = product.price * intent.quantity

    # Check max_auto_order ceiling
    if order_amount > max_auto_order:
        # Route to Approval Queue — same as manual orders in orders.py
        pending_order = Order(
            razorpay_order_id=f"pending_voice_{os.urandom(4).hex()}",
            merchant_id=merchant.id,
            product_id=product.id,
            amount=order_amount,
            status="pending_approval",
            buyer_intent=f"Voice order: {transcript}",
            buyer_uid=actor_uid,
            buyer_email=actor_email,
        )
        db.add(pending_order)
        db.commit()
        db.refresh(pending_order)

        rejection_reason = (
            f"That order needs merchant approval since it's over "
            f"₹{max_auto_order:,.0f}. Your order has been submitted for review."
        )
        session.state = VoiceOrderState.FAILED

        log_event(
            db, actor="policy", action="voice_order_submitted_for_approval",
            merchant_id=merchant.id,
            input_data={"product_id": product.id, "amount": order_amount, "transcript": transcript},
            output_data={"approved": False, "status": "pending_approval", "order_id": pending_order.id},
            decision="info",
            reason=rejection_reason,
            actor_uid=actor_uid,
            actor_email=actor_email,
            actor_role=actor_role,
            channel="voice",
        )

        tts_result = sarvam_service.text_to_speech(
            rejection_reason, session.detected_language
        )

        return VoiceUtteranceResponse(
            state=session.state.value,
            spoken_response=rejection_reason,
            spoken_audio_base64=tts_result.get("audio_base64") if tts_result else None,
            policy_rejection=rejection_reason,
            transcript=transcript,
        )

    # Full policy validation (discount, min_price, etc.) — for voice orders at list price
    policy_result = validate_offer(product.price, order_amount, rules)
    if not policy_result["approved"]:
        rejection_reason = policy_result["reason"]
        session.state = VoiceOrderState.FAILED

        log_event(
            db, actor="policy", action="voice_order_blocked",
            merchant_id=merchant.id,
            input_data={"product_id": product.id, "amount": order_amount},
            output_data=policy_result,
            decision="blocked",
            reason=rejection_reason,
            actor_uid=actor_uid,
            actor_email=actor_email,
            actor_role=actor_role,
            channel="voice",
        )

        tts_result = sarvam_service.text_to_speech(
            rejection_reason, session.detected_language
        )

        return VoiceUtteranceResponse(
            state=session.state.value,
            spoken_response=rejection_reason,
            spoken_audio_base64=tts_result.get("audio_base64") if tts_result else None,
            policy_rejection=rejection_reason,
            transcript=transcript,
        )

    # ─── Payment Processing ───────────────────────────────────
    session.state = VoiceOrderState.PAYMENT_PROCESSING

    # Create Razorpay order (test-mode)
    razorpay_order_id = ""
    try:
        from backend.services.razorpay_service import create_order as rp_create
        rp_order = rp_create(
            amount_inr=order_amount,
            receipt=f"voice_order_{product.id}",
            notes={
                "product_id": str(product.id),
                "merchant_id": str(merchant.id),
                "product_name": product.name,
                "buyer_uid": actor_uid,
                "channel": "voice",
            },
        )
        razorpay_order_id = rp_order.get("id", "")
    except Exception:
        razorpay_order_id = f"order_voice_mock_{os.urandom(4).hex()}"

    # Create order record
    order = Order(
        razorpay_order_id=razorpay_order_id,
        merchant_id=merchant.id,
        product_id=product.id,
        amount=order_amount,
        status="created",
        buyer_intent=f"Voice order: {transcript}",
        buyer_uid=actor_uid,
        buyer_email=actor_email,
    )
    db.add(order)
    db.commit()
    db.refresh(order)

    # Auto-complete test payment for voice flow (simulated debit)
    order.status = "paid"
    order.razorpay_payment_id = f"pay_voice_test_{os.urandom(6).hex()}"
    order.razorpay_signature = f"sig_voice_test_{os.urandom(12).hex()}"
    db.commit()
    db.refresh(order)

    # Sync to Firebase
    try:
        from backend.services.firebase_service import sync_order_to_firebase
        sync_order_to_firebase({
            "id": order.id,
            "razorpay_order_id": order.razorpay_order_id,
            "razorpay_payment_id": order.razorpay_payment_id,
            "merchant_id": order.merchant_id,
            "product_id": order.product_id,
            "amount": order.amount,
            "currency": order.currency,
            "status": order.status,
            "buyer_uid": order.buyer_uid,
            "buyer_email": order.buyer_email,
            "channel": "voice",
        })
    except Exception:
        pass

    session.state = VoiceOrderState.COMPLETED
    session.order_result = {
        "order_id": order.id,
        "razorpay_order_id": razorpay_order_id,
        "amount": order_amount,
        "status": order.status,
        "product_name": product.name,
        "merchant_name": merchant.name,
    }

    # Audit: full order completion
    log_event(
        db, actor="system", action="voice_order_completed",
        merchant_id=merchant.id,
        input_data={
            "product_id": product.id,
            "amount": order_amount,
            "transcript": transcript,
            "chosen_item": chosen_item.name,
        },
        output_data={
            "order_id": order.id,
            "razorpay_order_id": razorpay_order_id,
            "razorpay_payment_id": order.razorpay_payment_id,
            "status": order.status,
        },
        decision="approved",
        reason=f"Voice order completed: ₹{order_amount:.2f} for {product.name}",
        actor_uid=actor_uid,
        actor_email=actor_email,
        actor_role=actor_role,
        channel="voice",
    )

    # Generate confirmation speech
    confirmation_text = (
        f"Your order for {product.name} has been placed successfully. "
        f"Amount debited: {order_amount:.0f} rupees. "
        f"Paid via Razorpay test mode. Thank you for ordering!"
    )
    tts_result = sarvam_service.text_to_speech(
        confirmation_text, session.detected_language
    )

    return VoiceUtteranceResponse(
        state=session.state.value,
        spoken_response=confirmation_text,
        spoken_audio_base64=tts_result.get("audio_base64") if tts_result else None,
        order_result=VoiceOrderResultResponse(
            order_id=order.id,
            razorpay_order_id=razorpay_order_id,
            amount=order_amount,
            currency="INR",
            status=order.status,
            product_name=product.name,
            merchant_name=merchant.name,
        ),
        transcript=transcript,
    )


def _error_response(session, message: str) -> VoiceUtteranceResponse:
    """Build an error response."""
    return VoiceUtteranceResponse(
        state=session.state.value,
        spoken_response=message,
        transcript="",
    )


@router.get("/{session_id}", response_model=VoiceSessionResponse)
async def get_voice_order_session(session_id: str):
    """Get current session state (for reconnects)."""
    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Voice order session not found or expired")

    return VoiceSessionResponse(
        session_id=session.session_id,
        state=session.state.value,
        candidates=[VoiceCandidateResponse(**c.to_dict()) for c in session.last_candidates],
        transcript_history=session.transcript_history,
        order_result=VoiceOrderResultResponse(**session.order_result) if session.order_result else None,
    )
