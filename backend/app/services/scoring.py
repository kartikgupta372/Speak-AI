"""
scoring.py
──────────
Computes 4 session scores (0–100) by comparing user acoustic features
against the averaged target-speaker feature profile.

Scores:
  pacing_score     – how close the user's syllable rate is to the target
  confidence_score – energy match + penalty for excessive silence
  clarity_score    – pace in natural range + manageable silence
  stress_accuracy  – pitch-variation match to the target speaker
"""

from __future__ import annotations

import numpy as np

from .audio_processor import AcousticFeatures


# ── Internal helpers ──────────────────────────────────────────────────────────

def _silence_clarity(silence_ratio: float) -> float:
    """
    Optimal silence ratio: 0.10–0.40 (natural conversational pausing).
    Below 0.10 → mild penalty (possibly too rushed).
    Above 0.40 → increasing penalty (choppy flow).
    """
    if 0.10 <= silence_ratio <= 0.40:
        return 100.0
    elif silence_ratio < 0.10:
        # score rises from 70 to 100 as silence_ratio goes 0 → 0.10
        return float(np.clip(70.0 + silence_ratio * 300.0, 0.0, 100.0))
    else:
        # silence_ratio > 0.40
        return float(np.clip(100.0 - (silence_ratio - 0.40) * 250.0, 0.0, 100.0))


# ── Public API ────────────────────────────────────────────────────────────────

def compute_session_scores(
    user_features: AcousticFeatures,
    target_features: dict,
) -> dict:
    """
    Return a dict with keys:
      confidence_score, clarity_score, pacing_score, stress_accuracy
    All values are floats in [0, 100] rounded to 1 decimal place.
    """
    # ── Pacing score ──────────────────────────────────────────────────────────
    # How close is the user's syllable rate to the target?
    target_pace = float(target_features.get("pace_syllables_per_sec") or 3.0)
    pace_diff_ratio = abs(user_features.pace_syllables_per_sec - target_pace) / max(target_pace, 0.5)
    pacing_score = float(np.clip(100.0 * (1.0 - pace_diff_ratio), 0.0, 100.0))

    # ── Confidence score ──────────────────────────────────────────────────────
    # Energy match to the target, with a penalty for excessive silence.
    target_energy = float(target_features.get("energy_level") or 50.0)
    energy_diff = abs(user_features.energy_level - target_energy)
    energy_match = float(np.clip(100.0 - energy_diff, 0.0, 100.0))
    silence_penalty = user_features.silence_ratio * 30.0   # max 30-point penalty
    confidence_score = float(np.clip(energy_match - silence_penalty, 0.0, 100.0))

    # ── Clarity score ─────────────────────────────────────────────────────────
    # Pace in a natural range (2.5–4.5 syl/sec) + manageable silence ratio.
    pace = user_features.pace_syllables_per_sec
    if 2.5 <= pace <= 4.5:
        pace_clarity = 100.0
    elif pace < 2.5:
        # Too slow: score scales from 0 to 80 as pace goes 0 → 2.5
        pace_clarity = float(np.clip(pace / 2.5 * 80.0, 0.0, 80.0))
    else:
        # Too fast: each 0.1 syl/sec above 4.5 costs 1.5 points
        pace_clarity = float(np.clip(100.0 - (pace - 4.5) * 15.0, 0.0, 100.0))

    clarity_score = (pace_clarity + _silence_clarity(user_features.silence_ratio)) / 2.0

    # ── Stress accuracy ───────────────────────────────────────────────────────
    # Pitch-variation (std) match to the target speaker.
    target_pitch_std = float(target_features.get("pitch_std") or 30.0)
    pitch_std_diff = abs(user_features.pitch_std - target_pitch_std)
    stress_accuracy = float(np.clip(100.0 - pitch_std_diff * 0.8, 0.0, 100.0))

    return {
        "confidence_score": round(confidence_score, 1),
        "clarity_score":    round(clarity_score, 1),
        "pacing_score":     round(pacing_score, 1),
        "stress_accuracy":  round(stress_accuracy, 1),
    }
