from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, UploadFile

from ..config import settings
from ..database import get_supabase
from ..models.speaker import SpeakerResponse
from ..services.audio_processor import extract_features
from ..services.embedding_service import generate_embedding
from ..services.storage import upload_audio
from ..services.vector_search import _vec_to_str

router = APIRouter(prefix="/admin")


async def require_admin(x_admin_key: str = Header(default="")) -> None:
    if settings.ADMIN_KEY and x_admin_key != settings.ADMIN_KEY:
        raise HTTPException(status_code=403, detail="Invalid or missing X-Admin-Key header.")


@router.post("/speakers", response_model=SpeakerResponse, dependencies=[Depends(require_admin)])
async def create_speaker(
    name: str = Form(...),
    description: str = Form(""),
    category: str = Form(""),
    nationality: str = Form(""),
    language: str = Form("en"),
    image_url: str = Form(""),
    bio: str = Form(""),
) -> SpeakerResponse:
    supabase = get_supabase()
    result = supabase.table("speakers").insert(
        {
            "name":        name,
            "description": description or None,
            "category":    category    or None,
            "nationality": nationality or None,
            "language":    language,
            "image_url":   image_url   or None,
            "bio":         bio         or None,
        }
    ).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create speaker.")
    return result.data[0]


@router.post(
    "/ingest-speaker-audio",
    summary="Ingest one audio segment for a reference speaker",
    dependencies=[Depends(require_admin)],
)
async def ingest_speaker_audio(
    speaker_id: str = Form(..., description="UUID of an existing speaker record"),
    segment_name: str = Form(..., description="Human label, e.g. 'inauguration_speech_2009_clip1'"),
    quality_score: int = Form(80, ge=0, le=100),
    audio: UploadFile = File(..., description="Audio clip (wav/mp3, <= 10 MB)"),
) -> dict:
    audio_bytes = await audio.read()
    max_bytes = settings.MAX_AUDIO_SIZE_MB * 1024 * 1024
    if len(audio_bytes) > max_bytes:
        raise HTTPException(status_code=413, detail=f"Audio exceeds {settings.MAX_AUDIO_SIZE_MB} MB.")
    if len(audio_bytes) == 0:
        raise HTTPException(status_code=422, detail="Audio file is empty.")

    supabase = get_supabase()
    spk = (
        supabase.table("speakers")
        .select("id, name")
        .eq("id", speaker_id)
        .maybe_single()
        .execute()
    )
    if not spk.data:
        raise HTTPException(status_code=404, detail=f"Speaker {speaker_id} not found.")

    try:
        features = extract_features(audio_bytes)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Audio processing failed: {exc}")

    embedding = generate_embedding(features)

    audio_url = ""
    try:
        audio_url = upload_audio(audio_bytes, folder=f"speak/speakers/{speaker_id}")
    except Exception:
        pass

    segment_id = str(uuid.uuid4())
    supabase.table("speaker_audio_segments").insert(
        {
            "id":               segment_id,
            "speaker_id":       speaker_id,
            "segment_name":     segment_name,
            "audio_url":        audio_url,
            "duration_seconds": features.duration_seconds,
            "quality_score":    quality_score,
        }
    ).execute()

    embedding_id = str(uuid.uuid4())
    supabase.table("voice_embeddings").insert(
        {
            "id":                    embedding_id,
            "speaker_id":            speaker_id,
            "segment_id":            segment_id,
            "embedding":             _vec_to_str(embedding),
            "pitch_avg":             features.pitch_avg,
            "pitch_std":             features.pitch_std,
            "pace_syllables_per_sec": features.pace_syllables_per_sec,
            "energy_level":          features.energy_level,
            "silence_ratio":         features.silence_ratio,
            "mfcc":                  features.mfcc,
            "model_version":         settings.EMBEDDING_MODEL,
        }
    ).execute()

    return {
        "status":       "ingested",
        "speaker_id":   speaker_id,
        "speaker_name": spk.data["name"],
        "segment_id":   segment_id,
        "embedding_id": embedding_id,
        "duration_seconds": features.duration_seconds,
        "audio_url":    audio_url,
    }
