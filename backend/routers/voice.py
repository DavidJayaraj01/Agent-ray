"""Voice assistant endpoints — Sarvam AI STT/TTS + intent pipeline."""
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from backend.services import sarvam_service
from backend.services.llm_service import parse_intent

router = APIRouter(prefix="/api/voice", tags=["voice"])


class TTSRequest(BaseModel):
    text: str
    language_code: str = "en-IN"
    speaker: str = "kavya"


class ConverseResponse(BaseModel):
    transcript: str
    language: str
    language_name: str
    parsed_intent: dict
    match_results: list
    tts_audio_base64: str | None = None
    response_text: str = ""


@router.get("/status")
def voice_status():
    """Check if Sarvam AI voice service is available."""
    return {
        "available": sarvam_service.is_available(),
        "supported_languages": sarvam_service.SUPPORTED_LANGUAGES,
        "speakers": sarvam_service.TTS_SPEAKERS,
    }


@router.post("/stt")
async def speech_to_text(
    file: UploadFile = File(...),
    language_code: str = Form("hi-IN"),
):
    """Transcribe audio file using Sarvam Saaras v3."""
    if not sarvam_service.is_available():
        raise HTTPException(status_code=503, detail="Sarvam AI API key not configured. Add SARVAM_API_KEY to .env")

    audio_bytes = await file.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Empty audio file")

    result = sarvam_service.speech_to_text(
        audio_bytes=audio_bytes,
        language_code=language_code,
        filename=file.filename or "audio.wav",
    )

    if result is None:
        raise HTTPException(status_code=502, detail="Sarvam STT service failed")

    return result


@router.post("/tts")
def text_to_speech(data: TTSRequest):
    """Convert text to speech using Sarvam Bulbul v3."""
    if not sarvam_service.is_available():
        raise HTTPException(status_code=503, detail="Sarvam AI API key not configured")

    if not data.text.strip():
        raise HTTPException(status_code=400, detail="Text is empty")

    result = sarvam_service.text_to_speech(
        text=data.text,
        language_code=data.language_code,
        speaker=data.speaker,
    )

    if result is None:
        raise HTTPException(status_code=502, detail="Sarvam TTS service failed")

    return result


@router.post("/converse")
async def converse(
    file: UploadFile = File(...),
    language_code: str = Form("hi-IN"),
):
    """Full voice pipeline: STT → Intent Parse → Match → TTS Response.

    1. Transcribe audio with Sarvam STT
    2. Parse intent with local LLM / rule engine
    3. Match products from all merchants
    4. Generate spoken summary with Sarvam TTS
    """
    if not sarvam_service.is_available():
        raise HTTPException(status_code=503, detail="Sarvam AI not configured")

    # Step 1: STT
    audio_bytes = await file.read()
    stt_result = sarvam_service.speech_to_text(audio_bytes, language_code, file.filename or "audio.wav")
    if not stt_result or not stt_result.get("transcript"):
        raise HTTPException(status_code=502, detail="Could not transcribe audio")

    transcript = stt_result["transcript"]

    # Step 2: Parse intent
    parsed = parse_intent(transcript)

    # Step 3: Match products
    from sqlalchemy.orm import Session
    from backend.database import SessionLocal
    from backend.models import Merchant, Product
    db = SessionLocal()
    match_results = []
    try:
        products = db.query(Product).all()
        merchants = {m.id: m for m in db.query(Merchant).all()}

        budget = parsed.get("budget")
        category = parsed.get("category", "").lower() if parsed.get("category") else ""
        keywords = [k.lower() for k in parsed.get("keywords", [])]

        for p in products:
            score = 0
            reasons = []

            # Category match
            if category and category in (p.category or "").lower():
                score += 40
                reasons.append(f"Category: {p.category}")

            # Keyword match
            p_name_lower = (p.name or "").lower()
            for kw in keywords:
                if kw in p_name_lower or kw in (p.category or "").lower():
                    score += 15
                    reasons.append(f"Keyword: {kw}")

            # Budget match
            if budget:
                if p.price <= budget:
                    score += 25
                    reasons.append(f"Within budget ₹{budget:,.0f}")
                elif p.price <= budget * 1.2:
                    score += 10
                    reasons.append("Slightly over budget")

            if score > 0:
                m = merchants.get(p.merchant_id)
                match_results.append({
                    "product": {
                        "id": p.id, "name": p.name, "price": p.price,
                        "category": p.category, "merchant_id": p.merchant_id,
                        "stock": p.stock, "delivery_days": p.delivery_days,
                    },
                    "match_score": min(score, 100),
                    "match_reasons": reasons,
                    "merchant_name": m.name if m else "",
                    "merchant_trust_score": m.trust_score if m else 0,
                })

        match_results.sort(key=lambda x: x["match_score"], reverse=True)
        match_results = match_results[:5]
    finally:
        db.close()

    # Step 4: Generate response text + TTS
    if match_results:
        top = match_results[0]
        response_text = (
            f"I found {len(match_results)} products matching your request. "
            f"The best match is {top['product']['name']} at ₹{top['product']['price']:,.0f} "
            f"from {top['merchant_name']}."
        )
    else:
        response_text = "I couldn't find products matching your request. Try being more specific about what you're looking for."

    tts_result = sarvam_service.text_to_speech(response_text, "en-IN", "kavya")

    return {
        "transcript": transcript,
        "language": language_code,
        "language_name": sarvam_service.SUPPORTED_LANGUAGES.get(language_code, language_code),
        "parsed_intent": parsed,
        "match_results": match_results,
        "response_text": response_text,
        "tts_audio_base64": tts_result.get("audio_base64") if tts_result else None,
    }
