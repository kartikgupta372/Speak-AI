"""
custom_speakers.py
──────────────────
User-facing custom speaker creation — no admin key required.

POST /speakers/custom
  Create a speaker from a name + 1–5 audio samples.
  Runs the same ingestion pipeline as the admin endpoint.
  Returns speaker_id immediately so the user can start a chat session.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from typing import List

from ..config import settings
from ..database import get_supabase
from ..services.audio_processor import extract_features
from ..services.embedding_service import generate_embedding
from ..services.storage import upload_audio
from ..services.vector_search import _vec_to_str

router = APIRouter()


@router.post("/speakers/custom", summary="Create a custom speaker from audio samples")
async def create_custom_speaker(
    name: str = Form(..., description="Name of the speaker (any person you want to emulate)"),
    description: str = Form("", description="Short description"),
    category: str = Form("custom", description="Category e.g. custom, business, entertainment"),
    audio_samples: List[UploadFile] = File(..., description="1–5 audio clips of this speaker"),
) -> dict:
    if len(audio_samples) == 0:
        raise HTTPException(status_code=422, detail="At least 1 audio sample is required.")
    if len(audio_samples) > 5:
        raise HTTPException(status_code=422, detail="Maximum 5 audio samples allowed.")

    supabase = get_supabase()

    # Create speaker record
    speaker_id = str(uuid.uuid4())
    supabase.table("speakers").insert({
        "id": speaker_id,
        "name": name,
        "description": description or f"Custom speaker: {name}",
        "category": category,
        "language": "en",
        "is_custom": True,
    }).execute()

    ingested = 0
    errors = []

    for i, audio_file in enumerate(audio_samples):
        try:
            audio_bytes = await audio_file.read()
            if len(audio_bytes) == 0:
                continue
            max_bytes = settings.MAX_AUDIO_SIZE_MB * 1024 * 1024
            if len(audio_bytes) > max_bytes:
                errors.append(f"Sample {i+1} too large — skipped.")
                continue

            features = extract_features(audio_bytes)
            embedding = generate_embedding(features)

            # Upload audio (non-fatal)
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
            errors.append(f"Sample {i+1} failed: {str(exc)[:80]}")

    if ingested == 0:
        # Roll back speaker record
        try:
            supabase.table("speakers").delete().eq("id", speaker_id).execute()
        except Exception:
            pass
        raise HTTPException(
            status_code=422,
            detail=f"No samples could be processed. Errors: {'; '.join(errors)}",
        )

    return {
        "speaker_id": speaker_id,
        "name": name,
        "samples_ingested": ingested,
        "warnings": errors,
        "message": f"Custom speaker '{name}' created with {ingested} sample(s). Ready to use.",
    }
