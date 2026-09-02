"""Sarvam AI service — Speech-to-Text (Saaras v3) and Text-to-Speech (Bulbul v3).

Provides voice capabilities for the AgentReady voice assistant.
Gracefully degrades to None returns if API key is missing or service unreachable.
"""
import os
import base64
import httpx
import io
from pathlib import Path
from dotenv import load_dotenv

_env_path = Path(__file__).parent.parent / ".env"
load_dotenv(_env_path)
load_dotenv()

SARVAM_BASE_URL = "https://api.sarvam.ai"

SUPPORTED_LANGUAGES = {
    "hi-IN": "Hindi",
    "en-IN": "English (India)",
    "ta-IN": "Tamil",
    "te-IN": "Telugu",
    "kn-IN": "Kannada",
    "ml-IN": "Malayalam",
    "mr-IN": "Marathi",
    "bn-IN": "Bengali",
    "gu-IN": "Gujarati",
    "pa-IN": "Punjabi",
    "or-IN": "Odia",
}

def _get_api_key() -> str:
    return os.getenv("SARVAM_API_KEY", "").strip()


TTS_SPEAKERS = ["kavya", "aditya", "shubh", "priya", "neha", "rahul", "pooja", "rohan", "simran", "amit", "dev", "ishita", "shreya"]


def is_available() -> bool:
    """Check if Sarvam API key is configured."""
    return bool(_get_api_key())


def speech_to_text(
    audio_bytes: bytes,
    language_code: str = "hi-IN",
    filename: str = "audio.wav",
) -> dict | None:
    """Transcribe audio using Sarvam Saaras v3.

    Args:
        audio_bytes: Raw audio file bytes (WAV, MP3, WebM, etc.)
        language_code: BCP-47 language code (e.g. "hi-IN", "en-IN")
        filename: Original filename for content-type detection

    Returns:
        {"transcript": str, "language": str} or None on failure
    """
    if not is_available():
        return None

    try:
        files = {"file": (filename, io.BytesIO(audio_bytes), "audio/wav")}
        data = {
            "model": "saaras:v3",
            "language_code": language_code,
        }

        resp = httpx.post(
            f"{SARVAM_BASE_URL}/speech-to-text",
            headers={"api-subscription-key": _get_api_key()},
            files=files,
            data=data,
            timeout=30.0,
        )
        resp.raise_for_status()
        result = resp.json()
        return {
            "transcript": result.get("transcript", ""),
            "language": language_code,
            "language_name": SUPPORTED_LANGUAGES.get(language_code, language_code),
        }
    except Exception as e:
        print(f"[Sarvam STT] Error: {e}")
        return None


def text_to_speech(
    text: str,
    language_code: str = "en-IN",
    speaker: str = "kavya",
) -> dict | None:
    """Convert text to speech using Sarvam Bulbul v3.

    Args:
        text: Text to speak
        language_code: Target language code
        speaker: Voice name (kavya, aditya, shubh, etc.)

    Returns:
        {"audio_base64": str, "content_type": "audio/wav"} or None on failure
    """
    if not is_available():
        return None

    try:
        resp = httpx.post(
            f"{SARVAM_BASE_URL}/text-to-speech",
            headers={
                "api-subscription-key": _get_api_key(),
                "Content-Type": "application/json",
            },
            json={
                "text": text,
                "target_language_code": language_code,
                "speaker": speaker,
                "model": "bulbul:v3",
            },
            timeout=30.0,
        )
        resp.raise_for_status()
        result = resp.json()

        # Sarvam returns base64-encoded audio in the "audios" array
        audios = result.get("audios")
        if audios and len(audios) > 0:
            return {
                "audio_base64": audios[0],
                "content_type": "audio/wav",
            }
        return None
    except Exception as e:
        print(f"[Sarvam TTS] Error: {e}")
        return None


def generate_confirmation_speech(
    item_name: str,
    amount: float,
    language_code: str = "en-IN",
    speaker: str = "kavya",
) -> dict | None:
    """Generate Zomato-style order confirmation speech.

    Formats: "Your order for {item} has been placed. Debited ₹{amount}."
    """
    text = (
        f"Your order for {item_name} has been placed successfully. "
        f"Amount debited: {amount:.0f} rupees. "
        f"Thank you for ordering!"
    )
    return text_to_speech(text, language_code, speaker)


def generate_candidates_speech(
    candidates: list[dict],
    language_code: str = "en-IN",
    speaker: str = "kavya",
) -> tuple[str, dict | None]:
    """Generate spoken summary of matched candidates.

    Returns (response_text, tts_result).
    """
    if not candidates:
        response_text = (
            "I couldn't find any items matching your request. "
            "Try broadening your search — for example, increase your budget "
            "or try a different category."
        )
    elif len(candidates) == 1:
        c = candidates[0]
        response_text = (
            f"I found one match: {c['name']} at {c['price']:.0f} rupees "
            f"from {c['merchant_name']}. "
            f"Would you like me to order it?"
        )
    else:
        top = candidates[0]
        response_text = (
            f"I found {len(candidates)} items matching your request. "
            f"The best match is {top['name']} at {top['price']:.0f} rupees "
            f"from {top['merchant_name']}. "
            f"Which one would you like to order?"
        )

    tts_result = text_to_speech(response_text, language_code, speaker)
    return response_text, tts_result

