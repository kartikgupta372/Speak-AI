"""
speakers.py
───────────
GET /speakers              – list all reference (non-custom) speakers
GET /speakers/{speaker_id} – get a single speaker by UUID
"""

from __future__ import annotations
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query

from ..database import get_supabase, fetch_one
from ..models.speaker import SpeakerResponse

router = APIRouter()


@router.get("/speakers", response_model=list[SpeakerResponse], summary="List reference speakers")
def list_speakers(
    language: str | None = Query(None, description="Filter by language code, e.g. 'en'"),
    category: str | None = Query(None, description="Filter by category, e.g. 'political', 'tech'"),
    include_custom: bool = Query(False, description="Include user-uploaded custom speakers"),
    user_id: str | None = Query(None, description="Include custom speakers created by this user"),
) -> list[SpeakerResponse]:
    supabase = get_supabase()

    # Always include built-in speakers
    q_builtin = supabase.table("speakers").select("*").eq("is_custom", False)
    if language:
        q_builtin = q_builtin.eq("language", language)
    if category:
        q_builtin = q_builtin.eq("category", category)
    builtin = q_builtin.order("name").execute().data or []

    # Include user's own custom speakers if user_id provided
    custom = []
    if user_id:
        q_custom = (supabase.table("speakers").select("*")
                    .eq("is_custom", True)
                    .eq("created_by_user_id", user_id))
        if language:
            q_custom = q_custom.eq("language", language)
        custom = q_custom.order("name").execute().data or []

    return builtin + custom


@router.get(
    "/speakers/{speaker_id}",
    response_model=SpeakerResponse,
    summary="Get a speaker by ID",
)
def get_speaker(speaker_id: UUID) -> SpeakerResponse:
    row = fetch_one("speakers", eq={"id": str(speaker_id)})
    if not row:
        raise HTTPException(status_code=404, detail="Speaker not found.")
    return row
