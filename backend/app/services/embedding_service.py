from __future__ import annotations

from functools import lru_cache

from sentence_transformers import SentenceTransformer

from .audio_processor import AcousticFeatures
from ..config import settings


@lru_cache(maxsize=1)
def _get_model() -> SentenceTransformer:
    return SentenceTransformer(settings.EMBEDDING_MODEL)


def features_to_text(f: AcousticFeatures) -> str:
    if f.pitch_avg > 220:
        pitch_label = "high-pitch"
    elif f.pitch_avg < 110:
        pitch_label = "low-pitch"
    else:
        pitch_label = "medium-pitch"

    pitch_var = "low variation" if f.pitch_std < 20 else ("high variation" if f.pitch_std > 50 else "moderate variation")

    if f.pace_syllables_per_sec > 4.5:
        pace_label = "fast"
    elif f.pace_syllables_per_sec < 2.5:
        pace_label = "slow"
    else:
        pace_label = "moderate"

    if f.energy_level > 65:
        energy_label = "high"
    elif f.energy_level < 30:
        energy_label = "low"
    else:
        energy_label = "medium"

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
    model = _get_model()
    text = features_to_text(features)
    vec = model.encode(text, normalize_embeddings=True)
    return vec.tolist()
