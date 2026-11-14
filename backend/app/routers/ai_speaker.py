"""
ai_speaker.py
─────────────
POST /speakers/ai-custom

Create a custom speaker using:
  1. User's own Groq / OpenAI API key to fetch rich speaker info via LLM
  2. Uploaded audio samples for acoustic embedding
  3. Speaker stored as is_custom=True, linked to the user

The user's API key is NEVER stored — used only for the single LLM call.
"""

from __future__ import annotations

import json
import uuid
from typing import List, Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from ..config import settings
from ..database import get_supabase
from ..services.audio_processor import extract_features
from ..services.embedding_service import generate_embedding
from ..services.storage import upload_audio
from ..services.vector_search import _vec_to_str

router = APIRouter()


# ── LLM speaker info fetch ─────────────────────────────────────────────────────

def _fetch_speaker_info_groq(speaker_name: str, api_key: str) -> dict:
    """Use Groq with the user's key to get structured speaker info."""
    from groq import Groq
    client = Groq(api_key=api_key)

    prompt = f"""You are a speech and communication analyst. 
Provide a structured JSON profile for the public speaker: "{speaker_name}"

Return ONLY valid JSON (no markdown, no explanation) with this exact structure:
{{
  "name": "{speaker_name}",
  "description": "One-line description of their speaking role/identity",
  "category": "one of: political, tech, business, entertainment, sports, intellectual, science, custom",
  "nationality": "their country",
  "bio": "3-4 sentences about their speaking style and what makes them distinctive as a communicator",
  "key_characteristics": {{
    "pace": "descriptor like: fast, measured, deliberate, energetic, slow",
    "tone": "descriptor like: authoritative, warm, intellectual, enthusiastic, calm",
    "energy": "descriptor like: high, medium, controlled, explosive",
    "style": "2-4 word phrase describing overall delivery"
  }},
  "signature_techniques": "Comma-separated list of 3-5 rhetorical techniques they are known for",
  "famous_speeches": "Comma-separated list of 2-3 famous speeches or talks",
  "coaching_focus": "What a person should focus on to sound like this speaker (1 sentence)"
}}

If you don't know this person well, use reasonable assumptions based on their field.
Return ONLY the JSON object."""

    resp = client.chat.completions.create(
        model=settings.GROQ_MODEL,
        max_tokens=600,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
    )
    raw = resp.choices[0].message.content.strip()
    # Strip any accidental markdown fences
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw.strip())


def _fetch_speaker_info_openai(speaker_name: str, api_key: str) -> dict:
    """Use OpenAI with the user's key to get structured speaker info."""
    import openai
    client = openai.OpenAI(api_key=api_key)

    prompt = f"""You are a speech and communication analyst.
Provide a structured JSON profile for the public speaker: "{speaker_name}"

Return ONLY valid JSON with this exact structure:
{{
  "name": "{speaker_name}",
  "description": "One-line description",
  "category": "one of: political, tech, business, entertainment, sports, intellectual, science, custom",
  "nationality": "their country",
  "bio": "3-4 sentences about their speaking style",
  "key_characteristics": {{
    "pace": "fast/measured/deliberate/energetic/slow",
    "tone": "authoritative/warm/intellectual/enthusiastic/calm",
    "energy": "high/medium/controlled/explosive",
    "style": "2-4 word phrase"
  }},
  "signature_techniques": "3-5 rhetorical techniques, comma-separated",
  "famous_speeches": "2-3 famous speeches, comma-separated",
  "coaching_focus": "What to focus on to sound like them (1 sentence)"
}}

Return ONLY the JSON object."""

    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        max_tokens=600,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
    )
    raw = resp.choices[0].message.content.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw.strip())


def fetch_speaker_info(speaker_name: str, api_key: str, provider: str) -> dict:
    """Dispatch to the right LLM provider."""
    try:
        if provider.lower() == "openai":
            return _fetch_speaker_info_openai(speaker_name, api_key)
        else:
            return _fetch_speaker_info_groq(speaker_name, api_key)
    except json.JSONDecodeError:
        # Fallback minimal profile if JSON parse fails
        return {
            "name": speaker_name,
            "description": f"Custom speaker: {speaker_name}",
            "category": "custom",
            "nationality": "Unknown",
            "bio": f"{speaker_name} is a speaker you want to emulate. Practice matching their unique vocal style.",
            "key_characteristics": {"pace": "moderate", "tone": "confident", "energy": "medium", "style": "clear and direct"},
            "signature_techniques": "clarity, pacing, emphasis",
            "famous_speeches": "N/A",
            "coaching_focus": f"Focus on matching {speaker_name}'s overall delivery rhythm and tone.",
        }
    except Exception as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Could not fetch speaker info using your API key. Check that the key is valid and has credits. Error: {str(exc)[:120]}"
        )


# ── Main endpoint ──────────────────────────────────────────────────────────────

@router.post("/speakers/ai-custom", summary="Create AI-enriched custom speaker")
async def create_ai_custom_speaker(
    speaker_name: str = Form(..., description="Full name of the speaker"),
    user_id: str = Form(..., description="User ID (from localStorage speak_user_id)"),
    user_api_key: str = Form(..., description="User's Groq or OpenAI API key (not stored)"),
    api_provider: str = Form("groq", description="'groq' or 'openai'"),
    audio_samples: List[UploadFile] = File(..., description="1–5 audio clips of the speaker"),
) -> dict:
    """
    Create a custom speaker enriched with AI-generated profile data.
    The user's API key is used only for the LLM call and is NEVER persisted.
    """
    if not speaker_name.strip():
        raise HTTPException(status_code=422, detail="Speaker name is required.")
    if not user_api_key.strip():
        raise HTTPException(status_code=422, detail="API key is required.")
    if api_provider.lower() not in ("groq", "openai"):
        raise HTTPException(status_code=422, detail="api_provider must be 'groq' or 'openai'.")
    if len(audio_samples) == 0:
        raise HTTPException(status_code=422, detail="At least 1 audio sample is required.")
    if len(audio_samples) > 5:
        raise HTTPException(status_code=422, detail="Maximum 5 audio samples allowed.")

    supabase = get_supabase()
    speaker_id = str(uuid.uuid4())

    # ── Step 1: Fetch AI profile ──────────────────────────────────────────────
    info = fetch_speaker_info(speaker_name.strip(), user_api_key.strip(), api_provider)

    # ── Step 2: Insert speaker record ─────────────────────────────────────────
    supabase.table("speakers").insert({
        "id": speaker_id,
        "name": info.get("name", speaker_name.strip()),
        "description": info.get("description", f"Custom speaker: {speaker_name}"),
        "category": info.get("category", "custom"),
        "nationality": info.get("nationality", ""),
        "language": "en",
        "bio": info.get("bio", ""),
        "key_characteristics": info.get("key_characteristics", {}),
        "is_custom": True,
        "created_by_user_id": user_id,
    }).execute()

    # ── Step 3: Process audio samples ─────────────────────────────────────────
    ingested = 0
    errors: list[str] = []
    max_bytes = settings.MAX_AUDIO_SIZE_MB * 1024 * 1024

    for i, audio_file in enumerate(audio_samples):
        try:
            audio_bytes = await audio_file.read()
            if not audio_bytes:
                continue
            if len(audio_bytes) > max_bytes:
                errors.append(f"Sample {i+1} too large (>{settings.MAX_AUDIO_SIZE_MB}MB) — skipped.")
                continue

            features = extract_features(audio_bytes)
            embedding = generate_embedding(features)

            audio_url = ""
            try:
                audio_url = upload_audio(audio_bytes, folder=f"speak/custom/{speaker_id}")
            except Exception:
                pass

            segment_id = str(uuid.uuid4())
            supabase.table("speaker_audio_segments").insert({
                "id": segment_id,
                "speaker_id": speaker_id,
                "segment_name": f"sample_{i+1}",
                "audio_url": audio_url,
                "duration_seconds": features.duration_seconds,
                "quality_score": 70,
            }).execute()

            supabase.table("voice_embeddings").insert({
                "id": str(uuid.uuid4()),
                "speaker_id": speaker_id,
                "segment_id": segment_id,
                "embedding": _vec_to_str(embedding),
                "pitch_avg": features.pitch_avg,
                "pitch_std": features.pitch_std,
                "pace_syllables_per_sec": features.pace_syllables_per_sec,
                "energy_level": features.energy_level,
                "silence_ratio": features.silence_ratio,
                "mfcc": features.mfcc,
                "model_version": settings.EMBEDDING_MODEL,
            }).execute()

            ingested += 1
        except Exception as exc:
            errors.append(f"Sample {i+1}: {str(exc)[:80]}")

    if ingested == 0:
        # Roll back speaker on total failure
        try:
            supabase.table("speakers").delete().eq("id", speaker_id).execute()
        except Exception:
            pass
        raise HTTPException(
            status_code=422,
            detail=f"No audio samples could be processed. {'; '.join(errors)}"
        )

    return {
        "speaker_id": speaker_id,
        "name": info.get("name", speaker_name),
        "description": info.get("description", ""),
        "category": info.get("category", "custom"),
        "bio": info.get("bio", ""),
        "key_characteristics": info.get("key_characteristics", {}),
        "signature_techniques": info.get("signature_techniques", ""),
        "famous_speeches": info.get("famous_speeches", ""),
        "coaching_focus": info.get("coaching_focus", ""),
        "samples_ingested": ingested,
        "warnings": errors,
        "message": f"Speaker '{info.get('name', speaker_name)}' created with {ingested} audio sample(s). Ready to practice!",
    }
