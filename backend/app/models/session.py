from pydantic import BaseModel
from typing import Any, Optional
from datetime import datetime
from uuid import UUID


class SessionScores(BaseModel):
    confidence_score: float
    clarity_score: float
    pacing_score: float
    stress_accuracy: float


class SessionResponse(BaseModel):
    id: Optional[str] = None
    user_id: str
    speaker_id: Optional[str] = None
    session_date: Optional[datetime] = None
    confidence_score: float
    clarity_score: float
    pacing_score: float
    stress_accuracy: float
    feedback: str
    session_duration_seconds: float
    acoustic_features: Optional[dict[str, Any]] = None


class ProgressResponse(BaseModel):
    sessions: list[SessionResponse]
    total_sessions: int
    avg_confidence: float
    avg_clarity: float
    avg_pacing: float
    improvement_trend: str
