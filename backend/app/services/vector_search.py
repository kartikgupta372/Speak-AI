"""
vector_search.py
────────────────
pgvector-based similarity search helpers.

Uses Supabase RPC (stored procedures defined in the migration SQL) to run
efficient ANN queries via the ivfflat index on voice_embeddings.embedding.
"""

from __future__ import annotations

import numpy as np

from ..database import get_supabase


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _vec_to_str(v: list[float]) -> str:
    """Serialise a Python float list to pgvector literal format '[0.1,0.2,...]'."""
    return "[" + ",".join(f"{x:.8f}" for x in v) + "]"


# ---------------------------------------------------------------------------
# Speaker similarity search
# ---------------------------------------------------------------------------

def find_similar_speakers(
    embedding: list[float],
    limit: int = 5,
    language: str | None = None,
) -> list[dict]:
    """
    Call the match_speakers Postgres RPC function.

    Returns a list of dicts, each containing the full speaker row plus a
    'similarity' float (0–1, higher = more similar).
    """
    supabase = get_supabase()
    params: dict = {
        "query_embedding": _vec_to_str(embedding),
        "match_count": limit,
    }
    if language:
        params["filter_language"] = language

    result = supabase.rpc("match_speakers", params).execute()
    return result.data or []


# ---------------------------------------------------------------------------
# Speaker feature averaging (for feedback comparison)
# ---------------------------------------------------------------------------

def get_speaker_avg_features(speaker_id: str) -> dict | None:
    """
    Fetch all voice_embeddings for a speaker and return averaged
    acoustic features + a re-normalised average embedding.
    Returns None if no embeddings exist.
    """
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

    # Average MFCCs (stored as JSON arrays)
    mfccs = [r["mfcc"] for r in rows if r.get("mfcc")]
    if mfccs:
        avg["mfcc"] = np.mean(np.array(mfccs, dtype=float), axis=0).tolist()

    # Average embedding and re-normalise
    embeddings = [r["embedding"] for r in rows if r.get("embedding")]
    if embeddings:
        arr = np.array(embeddings, dtype=float)
        mean_emb = arr.mean(axis=0)
        norm = np.linalg.norm(mean_emb)
        if norm > 0:
            mean_emb = mean_emb / norm
        avg["embedding"] = mean_emb.tolist()

    return avg
