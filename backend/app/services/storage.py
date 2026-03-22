"""
storage.py
──────────
Upload audio files to Cloudinary and return a public URL.

Falls back gracefully (returns empty string) when Cloudinary credentials
are not configured — useful for local development without cloud storage.
"""

from __future__ import annotations

import cloudinary
import cloudinary.uploader

from ..config import settings


def _init() -> None:
    cloudinary.config(
        cloud_name=settings.CLOUDINARY_CLOUD_NAME,
        api_key=settings.CLOUDINARY_API_KEY,
        api_secret=settings.CLOUDINARY_API_SECRET,
        secure=True,
    )


def upload_audio(audio_bytes: bytes, folder: str = "speak/sessions") -> str:
    """
    Upload raw audio bytes to Cloudinary.

    Parameters
    ----------
    audio_bytes : bytes
        Raw audio content.
    folder : str
        Cloudinary folder path (e.g. 'speak/sessions', 'speak/speakers').

    Returns
    -------
    str
        Secure HTTPS URL, or empty string if upload fails / not configured.
    """
    if not settings.CLOUDINARY_CLOUD_NAME:
        return ""

    _init()
    result = cloudinary.uploader.upload(
        audio_bytes,
        resource_type="video",   # Cloudinary uses "video" for audio too
        folder=folder,
        format="mp3",
        overwrite=False,
    )
    return result.get("secure_url", "")
