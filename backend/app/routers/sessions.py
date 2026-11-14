from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from ..agents.blueprint_generator import generate_blueprint
from ..agents.feedback_engine import generate_session_feedback
from ..agents.speaker_matcher import match_speakers
from ..config import settings
from ..database import get_supabase
from ..models.session import SessionResponse
from ..models.speaker import SpeakerMatchResult, SpeakerResponse
from ..services.audio_processor import extract_features
from ..services.embedding_service import generate_embedding
from ..services.scoring import compute_session_scores
from ..services.storage import upload_audio
from ..services.vector_search import get_speaker_avg_features

router = APIRouter()


@router.post(
    "/analyze-session",
    response_model=SessionResponse,
    summary="Analyse a practice recording and return scores + feedback",
)
async def analyze_session(
    user_id: str = Form(..., description="user_id returned during /onboard"),
    target_speaker_id: str = Form(..., description="UUID of the reference speaker to compare against"),
    audio: UploadFile = File(..., description="Practice recording (wav/mp3/m4a, <= 10 MB)"),
) -> SessionResponse:
    audio_bytes = await audio.read()
    max_bytes = settings.MAX_AUDIO_SIZE_MB * 1024 * 1024
    if len(audio_bytes) > max_bytes:
        raise HTTPException(status_code=413, detail=f"Audio exceeds {settings.MAX_AUDIO_SIZE_MB} MB.")
    if len(audio_bytes) == 0:
        raise HTTPException(status_code=422, detail="Audio file is empty.")

    try:
        features = extract_features(audio_bytes)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Audio processing failed: {exc}")

    target_features = get_speaker_avg_features(target_speaker_id)
    if target_features is None:
        raise HTTPException(
            status_code=422,
            detail=(
                "No voice embeddings found for the chosen speaker. "
                "Run the speaker ingestion pipeline first via POST /admin/ingest-speaker-audio."
            ),
        )

    audio_url = ""
    try:
        audio_url = upload_audio(audio_bytes, folder="speak/sessions")
    except Exception:
        pass

    scores = compute_session_scores(features, target_features)

    supabase = get_supabase()

    speaker_row = (
        supabase.table("speakers")
        .select("name")
        .eq("id", target_speaker_id)
        .maybe_single()
        .execute()
    )
    target_speaker_name = (
        speaker_row.data["name"] if speaker_row.data else "target speaker"
    )

    user_row = (
        supabase.table("user_profiles")
        .select("onboarding_goals")
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    intent = user_row.data.get("onboarding_goals") if user_row.data else None

    prev_result = (
        supabase.table("user_sessions")
        .select("confidence_score, clarity_score, pacing_score, stress_accuracy")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    previous_session = prev_result.data[0] if prev_result.data else None

    try:
        feedback_text = generate_session_feedback(
            user_features=features,
            target_features=target_features,
            scores=scores,
            target_speaker_name=target_speaker_name,
            intent=intent,
            previous_session=previous_session,
        )
    except Exception:
        feedback_text = (
            "Session recorded successfully. "
            "Detailed AI feedback is temporarily unavailable — please try again shortly."
        )

    session_id = str(uuid.uuid4())
    acoustic_features_dict = {
        "pitch_avg":             features.pitch_avg,
        "pitch_std":             features.pitch_std,
        "pace_syllables_per_sec": features.pace_syllables_per_sec,
        "energy_level":          features.energy_level,
        "silence_ratio":         features.silence_ratio,
        "mfcc":                  features.mfcc,
    }

    try:
        supabase.table("user_sessions").insert(
            {
                "id":                      session_id,
                "user_id":                 user_id,
                "speaker_id":              target_speaker_id,
                "audio_recording_url":     audio_url,
                "session_duration_seconds": features.duration_seconds,
                "confidence_score":        scores["confidence_score"],
                "clarity_score":           scores["clarity_score"],
                "pacing_score":            scores["pacing_score"],
                "stress_accuracy":         scores["stress_accuracy"],
                "feedback":                feedback_text,
                "acoustic_features":       acoustic_features_dict,
            }
        ).execute()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to save session: {exc}")

    return SessionResponse(
        id=session_id,
        user_id=user_id,
        speaker_id=target_speaker_id,
        session_date=datetime.now(timezone.utc),
        confidence_score=scores["confidence_score"],
        clarity_score=scores["clarity_score"],
        pacing_score=scores["pacing_score"],
        stress_accuracy=scores["stress_accuracy"],
        feedback=feedback_text,
        session_duration_seconds=features.duration_seconds,
        acoustic_features=acoustic_features_dict,
    )


class BlueprintRequest(BaseModel):
    user_id: str
    target_speaker_id: str
    goals: str = ""
    scenario: str = ""


@router.post("/generate-blueprint", summary="Generate a personalised speaking blueprint")
async def generate_blueprint_endpoint(req: BlueprintRequest) -> dict:
    supabase = get_supabase()

    user_row = (
        supabase.table("user_profiles")
        .select("*")
        .eq("user_id", req.user_id)
        .maybe_single()
        .execute()
    )
    if not user_row.data:
        raise HTTPException(
            status_code=404,
            detail="User profile not found. Please complete onboarding first.",
        )

    speaker_row = (
        supabase.table("speakers")
        .select("*")
        .eq("id", req.target_speaker_id)
        .maybe_single()
        .execute()
    )
    if not speaker_row.data:
        raise HTTPException(status_code=404, detail="Target speaker not found.")

    target_features = get_speaker_avg_features(req.target_speaker_id)
    if target_features is None:
        raise HTTPException(
            status_code=422,
            detail="No voice embeddings found for the chosen speaker.",
        )

    intent = user_row.data.get("onboarding_goals") or {}
    if req.goals or req.scenario:
        from ..agents.intent_parser import parse_intent
        intent = parse_intent(req.goals, req.scenario)

    try:
        blueprint = generate_blueprint(
            user_profile=user_row.data,
            target_speaker=speaker_row.data,
            target_features=target_features,
            intent=intent,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Blueprint generation failed: {exc}")

    return {
        "user_id": req.user_id,
        "target_speaker": speaker_row.data.get("name"),
        "blueprint": blueprint,
    }


@router.post(
    "/match-speaker",
    response_model=list[SpeakerMatchResult],
    summary="Match reference speakers from an audio sample",
)
async def match_speaker_from_audio(
    audio: UploadFile = File(..., description="Audio sample (wav/mp3/m4a, <= 10 MB)"),
    language: str = Form("en"),
    goals: str = Form(""),
    scenario: str = Form(""),
) -> list[SpeakerMatchResult]:
    audio_bytes = await audio.read()
    max_bytes = settings.MAX_AUDIO_SIZE_MB * 1024 * 1024
    if len(audio_bytes) > max_bytes:
        raise HTTPException(status_code=413, detail=f"Audio exceeds {settings.MAX_AUDIO_SIZE_MB} MB.")
    if len(audio_bytes) == 0:
        raise HTTPException(status_code=422, detail="Audio file is empty.")

    try:
        features = extract_features(audio_bytes)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Audio processing failed: {exc}")

    embedding = generate_embedding(features)

    intent: dict = {}
    if goals or scenario:
        from ..agents.intent_parser import parse_intent
        intent = parse_intent(goals, scenario)

    raw_matches = match_speakers(embedding, intent, language=language, limit=3)

    return [
        SpeakerMatchResult(
            speaker=SpeakerResponse(**m["speaker"]),
            similarity=m["similarity"],
            match_reason=m["match_reason"],
        )
        for m in raw_matches
    ]
