"""
progress.py
───────────
GET /user-progress/{user_id}

Returns the full session history for a user plus aggregated stats and
a simple improvement trend label.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..database import get_supabase
from ..models.session import ProgressResponse, SessionResponse

router = APIRouter()


@router.get(
    "/user-progress/{user_id}",
    response_model=ProgressResponse,
    summary="Get session history and progress stats for a user",
)
def get_user_progress(user_id: str) -> ProgressResponse:
    supabase = get_supabase()

    result = (
        supabase.table("user_sessions")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at")          # ascending → chronological
        .execute()
    )

    sessions_data = result.data or []

    if not sessions_data:
        return ProgressResponse(
            sessions=[],
            total_sessions=0,
            avg_confidence=0.0,
            avg_clarity=0.0,
            avg_pacing=0.0,
            improvement_trend="no_data",
        )

    # Normalise nullable DB fields before Pydantic validation
    sessions: list[SessionResponse] = []
    for row in sessions_data:
        row["feedback"]                 = row.get("feedback") or ""
        row["session_duration_seconds"] = row.get("session_duration_seconds") or 0.0
        sessions.append(SessionResponse(**row))

    total = len(sessions)
    avg_confidence = sum(s.confidence_score for s in sessions) / total
    avg_clarity    = sum(s.clarity_score    for s in sessions) / total
    avg_pacing     = sum(s.pacing_score     for s in sessions) / total

    # Trend: compare composite score of earliest third vs latest third.
    trend = "stable"
    if total >= 4:
        split = max(1, total // 3)

        def _composite(session_list: list[SessionResponse]) -> float:
            n = len(session_list)
            return sum(
                s.confidence_score + s.clarity_score + s.pacing_score
                for s in session_list
            ) / (3 * n)

        early_score  = _composite(sessions[:split])
        recent_score = _composite(sessions[-split:])

        if recent_score > early_score + 5:
            trend = "improving"
        elif recent_score < early_score - 5:
            trend = "declining"

    return ProgressResponse(
        sessions=sessions,
        total_sessions=total,
        avg_confidence=round(avg_confidence, 1),
        avg_clarity=round(avg_clarity, 1),
        avg_pacing=round(avg_pacing, 1),
        improvement_trend=trend,
    )
