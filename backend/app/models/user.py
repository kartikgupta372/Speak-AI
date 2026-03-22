from pydantic import BaseModel
from typing import Any, Optional

# Import here — speaker.py does not import from user.py, so no circular dep.
from .speaker import SpeakerMatchResult


class OnboardingRequest(BaseModel):
    """Used as form fields in multipart upload — not directly as JSON body."""
    name: str
    email: str
    goals: str
    scenario: str
    preferred_language: str = "en"


class UserProfileResponse(BaseModel):
    user_id: str
    name: str
    email: str
    pitch_avg: Optional[float] = None
    pace_syllables_per_sec: Optional[float] = None
    energy_level: Optional[float] = None
    preferred_speaker_id: Optional[str] = None
    onboarding_goals: Optional[dict[str, Any]] = None


class OnboardingResponse(BaseModel):
    user_profile: UserProfileResponse
    matched_speakers: list[SpeakerMatchResult]
    baseline_metrics: dict[str, Any]
    intent: dict[str, Any]
