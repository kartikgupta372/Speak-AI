from pydantic import BaseModel
from typing import Any, Optional
from uuid import UUID


class SpeakerResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    nationality: Optional[str] = None
    language: str = "en"
    image_url: Optional[str] = None
    bio: Optional[str] = None
    key_characteristics: Optional[dict[str, Any]] = None


class SpeakerMatchResult(BaseModel):
    speaker: SpeakerResponse
    similarity: float
    match_reason: str
