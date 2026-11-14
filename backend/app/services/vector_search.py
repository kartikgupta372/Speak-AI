from __future__ import annotations

import numpy as np

from ..database import get_supabase


def _vec_to_str(v: list[float]) -> str:
    return "[" + ",".join(f"{x:.8f}" for x in v) + "]"


def find_similar_speakers(
    embedding: list[float],
    limit: int = 5,
    language: str | None = None,
) -> list[dict]:
    supabase = get_supabase()
    params: dict = {
        "query_embedding": _vec_to_str(embedding),
        "match_count": limit,
    }
    if language:
        params["filter_language"] = language

    result = supabase.rpc("match_speakers", params).execute()
    return result.data or []


def get_speaker_avg_features(speaker_id: str) -> dict | None:
    supabase = get_supabase()
    result = (
        supabase.table("voice_embeddings")
        .select(
            "pitch_avg, pitch_std, pace_syllables_per_sec, "
            "energy_level, silence_ratio, mfcc, embedding"
        )
        .eq("speaker_id", speaker_id)
        .execute()
    )

    rows = result.data
    if not rows:
        return None

    def _mean(key: str) -> float:
        vals = [r[key] for r in rows if r.get(key) is not None]
        return float(np.mean(vals)) if vals else 0.0

    avg: dict = {
        "pitch_avg": _mean("pitch_avg"),
        "pitch_std": _mean("pitch_std"),
        "pace_syllables_per_sec": _mean("pace_syllables_per_sec"),
        "energy_level": _mean("energy_level"),
        "silence_ratio": _mean("silence_ratio"),
    }

    mfccs = [r["mfcc"] for r in rows if r.get("mfcc")]
    if mfccs:
        avg["mfcc"] = np.mean(np.array(mfccs, dtype=float), axis=0).tolist()

    embeddings = [r["embedding"] for r in rows if r.get("embedding")]
    if embeddings:
        arr = np.array(embeddings, dtype=float)
        mean_emb = arr.mean(axis=0)
        norm = np.linalg.norm(mean_emb)
        if norm > 0:
            mean_emb = mean_emb / norm
        avg["embedding"] = mean_emb.tolist()

    return avg
