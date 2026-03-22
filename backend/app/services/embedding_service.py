"""
embedding_service.py
────────────────────
Converts AcousticFeatures → 384-dim sentence-transformer embedding.

Strategy:
  1. Build a natural-language description of the acoustic features.
  2. Encode that text with SentenceTransformer('all-MiniLM-L6-v2').
  3. Return the normalised 384-dim float list.

Why text-based encoding?
  We don't have a dedicated voice encoder, but a text description of the
  voice style (pitch, pace, energy, pausing) gives a semantically meaningful
  latent space that groups similar speaking styles together — which is exactly
  what we need for similarity search.
"""

from __future__ import annotations

from functools import lru_cache

from sentence_transformers import SentenceTransformer

from .audio_processor import AcousticFeatures
from ..config import settings


@lru_cache(maxsize=1)
def _get_model() -> SentenceTransformer:
    """Load the model once and cache it for the process lifetime."""
    return SentenceTransformer(settings.EMBEDDING_MODEL)


def features_to_text(f: AcousticFeatures) -> str:
    """
    Convert acoustic features to a descriptive sentence.
    Example output:
      "Medium-pitch speaker at 148.3Hz with low variation, moderate pace at
       3.12 syllables per second, medium vocal energy, moderate pauses (silence 0.22)."
    """
    # Pitch description
    if f.pitch_avg > 220:
        pitch_label = "high-pitch"
    elif f.pitch_avg < 110:
        pitch_label = "low-pitch"
    else:
        pitch_label = "medium-pitch"

    pitch_var = "low variation" if f.pitch_std < 20 else ("high variation" if f.pitch_std > 50 else "moderate variation")

    # Pace description
    if f.pace_syllables_per_sec > 4.5:
        pace_label = "fast"
    elif f.pace_syllables_per_sec < 2.5:
        pace_label = "slow"
    else:
        pace_label = "moderate"

    # Energy description
    if f.energy_level > 65:
        energy_label = "high"
    elif f.energy_level < 30:
        energy_label = "low"
    else:
        energy_label = "medium"

    # Pausing description
    if f.silence_ratio > 0.35:
        pause_label = "frequent deliberate pauses"
    elif f.silence_ratio < 0.08:
        pause_label = "minimal pauses, continuous flow"
    else:
        pause_label = "moderate pauses"

    return (
        f"{pitch_label.capitalize()} speaker at {f.pitch_avg:.1f}Hz with {pitch_var}, "
        f"{pace_label} speaking pace at {f.pace_syllables_per_sec:.2f} syllables per second, "
        f"{energy_label} vocal energy level at {f.energy_level:.1f}, "
        f"{pause_label} with silence ratio {f.silence_ratio:.2f}."
    )


def generate_embedding(features: AcousticFeatures) -> list[float]:
    """Return a normalised 384-dim embedding for the given acoustic features."""
    model = _get_model()
    text = features_to_text(features)
    vec = model.encode(text, normalize_embeddings=True)
    return vec.tolist()
