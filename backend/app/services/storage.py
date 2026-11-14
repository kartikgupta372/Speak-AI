"""
storage.py
──────────
Upload audio files to Supabase Storage and return a public URL.

Bucket: configured via SUPABASE_STORAGE_BUCKET env var (default: "speak-audio").
The bucket is created automatically at startup (see main.py lifespan).

Falls back gracefully (returns empty string) on any error so sessions
can still be saved without audio replay.
"""

from __future__ import annotations

import uuid

from ..config import settings
from ..database import get_supabase


def ensure_bucket() -> None:
    """
    Create the storage bucket if it does not already exist.
    Called once at app startup — safe to call repeatedly.
    """
    supabase = get_supabase()
    bucket = settings.SUPABASE_STORAGE_BUCKET
    try:
        buckets = supabase.storage.list_buckets()
        existing = {b.name for b in buckets}
        if bucket not in existing:
            supabase.storage.create_bucket(
                bucket,
                options={"public": True, "allowed_mime_types": ["audio/*"], "file_size_limit": 20 * 1024 * 1024},
            )
            print(f"✓  Supabase Storage bucket '{bucket}' created.")
        else:
            print(f"✓  Supabase Storage bucket '{bucket}' ready.")
    except Exception as exc:
        print(f"⚠  Storage bucket check failed (non-fatal): {exc}")


def upload_audio(audio_bytes: bytes, folder: str = "sessions") -> str:
    """
    Upload raw audio bytes to Supabase Storage.

    Parameters
    ----------
    audio_bytes : bytes
        Raw WAV/MP3 content.
    folder : str
        Sub-folder within the bucket (e.g. 'sessions', 'speakers/obama').

    Returns
    -------
    str
        Public HTTPS URL, or empty string if upload fails.
    """
    if not audio_bytes:
        return ""

    supabase = get_supabase()
    bucket = settings.SUPABASE_STORAGE_BUCKET
    file_id = str(uuid.uuid4())
    path = f"{folder}/{file_id}.wav"

    try:
        supabase.storage.from_(bucket).upload(
            path=path,
            file=audio_bytes,
            file_options={"content-type": "audio/wav", "upsert": "true"},
        )
        url: str = supabase.storage.from_(bucket).get_public_url(path)
        return url
    except Exception as exc:
        print(f"⚠  Audio upload failed (non-fatal): {exc}")
        return ""
