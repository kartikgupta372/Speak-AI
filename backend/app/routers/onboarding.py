"""
onboarding.py
─────────────
POST /onboard

Full onboarding flow:
  1. Validate & read multipart audio upload.
  2. Extract acoustic features via librosa.
  3. Generate 384-dim embedding.
  4. Upload audio to Cloudinary (non-fatal if it fails).
  5. Parse user intent via Claude.
  6. Match reference speakers via pgvector similarity search.
  7. Upsert user profile in Supabase (email is the dedup key).
  8. Return user profile + matched speakers + baseline metrics + intent.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from ..agents.intent_parser import parse_intent
from ..agents.speaker_matcher import match_speakers
from ..config import settings
from ..database import get_supabase
from ..models.speaker import SpeakerMatchResult, SpeakerResponse
from ..models.user import OnboardingResponse, UserProfileResponse
from ..services.audio_processor import extract_features
from ..services.embedding_service import generate_embedding
from ..services.storage import upload_audio

router = APIRouter()


@router.post("/onboard", response_model=OnboardingResponse, summary="Onboard a new user")
async def onboard(
    name: str = Form(...),
    email: str = Form(...),
    goals: str = Form(...),
    scenario: str = Form(...),
    preferred_language: str = Form("en"),
    audio: UploadFile = File(..., description="Baseline speech recording (wav/mp3/m4a, ≤ 10 MB)"),
) -> OnboardingResponse:
    # ── 1. Read & size-check audio ────────────────────────────────────────────
    audio_bytes = await audio.read()
    max_bytes = settings.MAX_AUDIO_SIZE_MB * 1024 * 1024
    if len(audio_bytes) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"Audio file exceeds the {settings.MAX_AUDIO_SIZE_MB} MB limit.",
        )
    if len(audio_bytes) == 0:
        raise HTTPException(status_code=422, detail="Audio file is empty.")

    # ── 2. Extract acoustic features ──────────────────────────────────────────
    try:
        features = extract_features(audio_bytes)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Audio processing failed: {exc}")

    # ── 3. Generate voice embedding ───────────────────────────────────────────
    embedding = generate_embedding(features)

    # ── 4. Upload audio to cloud storage (non-fatal) ──────────────────────────
    audio_url = ""
    try:
        audio_url = upload_audio(audio_bytes, folder="speak/baseline")
    except Exception:
        pass  # local dev without Cloudinary is fine

    # ── 5. Parse intent ───────────────────────────────────────────────────────
    intent = parse_intent(goals, scenario)

    # ── 6. Match reference speakers ───────────────────────────────────────────
    raw_matches = match_speakers(embedding, intent, language=preferred_language, limit=3)

    # ── 7. Upsert user profile ────────────────────────────────────────────────
    supabase = get_supabase()

    existing = (
        supabase.table("user_profiles")
        .select("user_id")
        .eq("email", email)
        .maybe_single()
        .execute()
    )

    if existing.data:
        # Returning user — preserve their user_id, update metrics
        user_id = existing.data["user_id"]
        supabase.table("user_profiles").update(
            {
                "name": name,
                "pitch_avg": features.pitch_avg,
                "pace_syllables_per_sec": features.pace_syllables_per_sec,
                "energy_level": features.energy_level,
                "onboarding_goals": intent,
            }
        ).eq("email", email).execute()
    else:
        # New user
        user_id = str(uuid.uuid4())
        supabase.table("user_profiles").insert(
            {
                "user_id": user_id,
                "name": name,
                "email": email,
                "pitch_avg": features.pitch_avg,
                "pace_syllables_per_sec": features.pace_syllables_per_sec,
                "energy_level": features.energy_level,
                "onboarding_goals": intent,
            }
        ).execute()

    # ── 8. Build response ─────────────────────────────────────────────────────
    user_profile = UserProfileResponse(
        user_id=user_id,
        name=name,
        email=email,
        pitch_avg=features.pitch_avg,
        pace_syllables_per_sec=features.pace_syllables_per_sec,
        energy_level=features.energy_level,
        onboarding_goals=intent,
    )

    matched_speakers = [
        SpeakerMatchResult(
            speaker=SpeakerResponse(**m["speaker"]),
            similarity=m["similarity"],
            match_reason=m["match_reason"],
        )
        for m in raw_matches
    ]

    baseline_metrics = {
        "pitch_avg": features.pitch_avg,
        "pitch_std": features.pitch_std,
        "pace_syllables_per_sec": features.pace_syllables_per_sec,
        "energy_level": features.energy_level,
        "silence_ratio": features.silence_ratio,
        "duration_seconds": features.duration_seconds,
        "mfcc": features.mfcc,
    }

    return OnboardingResponse(
        user_profile=user_profile,
        matched_speakers=matched_speakers,
        baseline_metrics=baseline_metrics,
        intent=intent,
    )
