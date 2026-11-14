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
    audio: UploadFile = File(..., description="Baseline speech recording (wav/mp3/m4a, <= 10 MB)"),
) -> OnboardingResponse:
    audio_bytes = await audio.read()
    max_bytes = settings.MAX_AUDIO_SIZE_MB * 1024 * 1024
    if len(audio_bytes) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"Audio file exceeds the {settings.MAX_AUDIO_SIZE_MB} MB limit.",
        )
    if len(audio_bytes) == 0:
        raise HTTPException(status_code=422, detail="Audio file is empty.")

    try:
        features = extract_features(audio_bytes)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Audio processing failed: {exc}")

    embedding = generate_embedding(features)

    audio_url = ""
    try:
        audio_url = upload_audio(audio_bytes, folder="speak/baseline")
    except Exception:
        pass

    intent = parse_intent(goals, scenario)

    raw_matches = match_speakers(embedding, intent, language=preferred_language, limit=3)

    supabase = get_supabase()

    existing = (
        supabase.table("user_profiles")
        .select("user_id")
        .eq("email", email)
        .maybe_single()
        .execute()
    )

    if existing.data:
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
