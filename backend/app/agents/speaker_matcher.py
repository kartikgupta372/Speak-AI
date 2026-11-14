from __future__ import annotations

from ..services.vector_search import find_similar_speakers


def match_speakers(
    embedding: list[float],
    intent: dict,
    language: str = "en",
    limit: int = 3,
) -> list[dict]:
    candidates = find_similar_speakers(embedding, limit=limit * 2, language=language)

    if not candidates:
        return []

    results = []
    for row in candidates[:limit]:
        speaker = {
            "id": row.get("id"),
            "name": row.get("name"),
            "description": row.get("description"),
            "category": row.get("category"),
            "nationality": row.get("nationality"),
            "language": row.get("language"),
            "image_url": row.get("image_url"),
            "bio": row.get("bio"),
            "key_characteristics": row.get("key_characteristics"),
        }
        similarity = float(row.get("similarity", 0.0))
        reason = _build_reason(similarity, speaker, intent)

        results.append({
            "speaker": speaker,
            "similarity": round(similarity, 3),
            "match_reason": reason,
        })

    return results


def _build_reason(similarity: float, speaker: dict, intent: dict) -> str:
    pct = int(similarity * 100)
    chars: dict = speaker.get("key_characteristics") or {}

    style_parts = []
    if chars.get("pace"):
        style_parts.append(f"{chars['pace']} pace")
    if chars.get("tone"):
        style_parts.append(f"{chars['tone']} tone")
    if chars.get("energy"):
        style_parts.append(f"{chars['energy']} energy")

    base = f"{pct}% voice style match"
    if style_parts:
        base += f" — {', '.join(style_parts)}"

    desired = intent.get("desired_style", "")
    if desired:
        base += f". Aligns with your goal: {desired}."

    return base
