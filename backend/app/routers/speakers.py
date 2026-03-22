"""
speakers.py
───────────
GET /speakers            – list all reference speakers (filterable)
GET /speakers/{speaker_id} – get a single speaker by UUID
"""

from __future__ import annotations
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query

from ..database import get_supabase
from ..models.speaker import SpeakerResponse

router = APIRouter()


@router.get("/speakers", response_model=list[SpeakerResponse], summary="List reference speakers")
def list_speakers(
    language: str | None = Query(None, description="Filter by language code, e.g. 'en'"),
    category: str | None = Query(None, description="Filter by category, e.g. 'political', 'tech'"),
) -> list[SpeakerResponse]:
    supabase = get_supabase()
    query = supabase.table("speakers").select("*")
    if language:
        query = query.eq("language", language)
    if category:
        query = query.eq("category", category)
    result = query.order("name").execute()
    return result.data or []


@router.get(
    "/speakers/{speaker_id}",
    response_model=SpeakerResponse,
    summary="Get a speaker by ID",
)
def get_speaker(speaker_id: UUID) -> SpeakerResponse:
    supabase = get_supabase()
    result = (
        supabase.table("speakers")
        .select("*")
        .eq("id", str(speaker_id))
        .maybe_single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Speaker not found.")
    return result.data
