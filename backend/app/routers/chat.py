"""
chat.py
───────
Chat-based coaching session endpoints.

POST /chat/message
  Accept one audio turn, analyze it, generate short conversational
  feedback, return scores + text + whether 90% milestone is hit.

POST /chat/sessions
  Create a new chat session for a user + target speaker.

GET /chat/sessions/{user_id}
  List all chat sessions for a user (sidebar).
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from ..config import settings
from ..database import get_supabase, fetch_one
from ..services.audio_processor import extract_features
from ..services.scoring import compute_session_scores
from ..services.vector_search import get_speaker_avg_features
from ..services.storage import upload_audio

router = APIRouter(prefix="/chat")


# ── Pydantic models ────────────────────────────────────────────────────────────

class ChatSession(BaseModel):
    id: str
    user_id: str
    speaker_id: str
    speaker_name: str
    goal: str
    style: str
    created_at: str
    best_score: float = 0.0
    turn_count: int = 0


class ChatMessageResponse(BaseModel):
    turn_id: str
    scores: dict          # confidence, clarity, pacing, stress_accuracy, overall
    feedback_text: str    # short conversational (2–3 sentences)
    tts_text: str         # what the coach should speak aloud (1–2 sentences)
    milestone_reached: bool   # True when overall >= 90
    milestone_message: str    # shown when milestone hit
    progress_pct: float       # overall / 90 * 100, capped at 100
    turn_count: int


# ── Helper: fast conversational feedback via Groq ─────────────────────────────

def _fast_feedback(
    scores: dict,
    speaker_name: str,
    goal: str,
    style: str,
    turn: int,
    prev_overall: float,
    features,
    target_features: dict,
) -> tuple[str, str]:
    """Return (feedback_text, tts_text) — short and conversational."""
    from groq import Groq
    client = Groq(api_key=settings.GROQ_API_KEY)

    overall = scores["overall"]
    delta = overall - prev_overall
    delta_str = f"+{delta:.1f}" if delta >= 0 else f"{delta:.1f}"

    t_pace = float(target_features.get("pace_syllables_per_sec") or 3.0)
    t_energy = float(target_features.get("energy_level") or 50.0)

    prompt = f"""You are a concise speech coach. Turn {turn} of a practice session.

TARGET: {speaker_name} ({style} style) | GOAL: {goal}
SCORES: Confidence {scores['confidence_score']:.0f}, Clarity {scores['clarity_score']:.0f}, Pacing {scores['pacing_score']:.0f}, Stress {scores['stress_accuracy']:.0f} → Overall {overall:.0f}/100 ({delta_str} from last turn)
USER: pace {features.pace_syllables_per_sec:.1f} syl/s (target {t_pace:.1f}), energy {features.energy_level:.0f}/100 (target {t_energy:.0f})

Write TWO things:
1. FEEDBACK (2 sentences): one thing done well + one specific improvement with a number.
2. TTS (1 sentence): what the coach should say aloud — motivating, direct, ends with a specific drill instruction.

Format exactly:
FEEDBACK: <text>
TTS: <text>"""

    resp = client.chat.completions.create(
        model=settings.GROQ_MODEL,
        max_tokens=200,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = resp.choices[0].message.content.strip()
    feedback = ""
    tts = ""
    for line in raw.split("\n"):
        if line.startswith("FEEDBACK:"):
            feedback = line[len("FEEDBACK:"):].strip()
        elif line.startswith("TTS:"):
            tts = line[len("TTS:"):].strip()

    if not feedback:
        feedback = f"Overall score: {overall:.0f}/100. Focus on matching {speaker_name}'s pace of {t_pace:.1f} syllables per second."
    if not tts:
        tts = f"Good effort. Now try speaking at exactly {t_pace:.1f} syllables per second and record again."

    return feedback, tts


# ── POST /chat/sessions ────────────────────────────────────────────────────────

class NewSessionRequest(BaseModel):
    user_id: str
    speaker_id: str
    goal: str = "public speaking"
    style: str = "confident"


@router.post("/sessions", response_model=ChatSession)
async def create_chat_session(req: NewSessionRequest) -> ChatSession:
    supabase = get_supabase()

    # Get speaker name
    spk = fetch_one("speakers", eq={"id": req.speaker_id}, columns="name")
    speaker_name = spk["name"] if spk else "Speaker"

    session_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    supabase.table("chat_sessions").insert({
        "id": session_id,
        "user_id": req.user_id,
        "speaker_id": req.speaker_id,
        "speaker_name": speaker_name,
        "goal": req.goal,
        "style": req.style,
        "created_at": now,
        "best_score": 0.0,
        "turn_count": 0,
    }).execute()

    return ChatSession(
        id=session_id,
        user_id=req.user_id,
        speaker_id=req.speaker_id,
        speaker_name=speaker_name,
        goal=req.goal,
        style=req.style,
        created_at=now,
    )


# ── GET /chat/sessions/{user_id} ───────────────────────────────────────────────

@router.get("/sessions/{user_id}", response_model=list[ChatSession])
def list_chat_sessions(user_id: str) -> list[ChatSession]:
    supabase = get_supabase()
    result = (
        supabase.table("chat_sessions")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(20)
        .execute()
    )
    return result.data or []


# ── POST /chat/message ─────────────────────────────────────────────────────────

@router.post("/message", response_model=ChatMessageResponse)
async def chat_message(
    session_id: str = Form(...),
    user_id: str = Form(...),
    audio: UploadFile = File(...),
) -> ChatMessageResponse:
    supabase = get_supabase()

    # ── 1. Load session ───────────────────────────────────────────────────────
    session = fetch_one("chat_sessions", eq={"id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found.")
    speaker_id = session["speaker_id"]
    speaker_name = session.get("speaker_name", "Target Speaker")
    goal = session.get("goal", "public speaking")
    style = session.get("style", "confident")

    # ── 2. Read audio ─────────────────────────────────────────────────────────
    audio_bytes = await audio.read()
    if len(audio_bytes) == 0:
        raise HTTPException(status_code=422, detail="Audio file is empty.")
    max_bytes = settings.MAX_AUDIO_SIZE_MB * 1024 * 1024
    if len(audio_bytes) > max_bytes:
        raise HTTPException(status_code=413, detail="Audio too large.")

    # ── 3. Extract features ───────────────────────────────────────────────────
    try:
        features = extract_features(audio_bytes)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Audio processing failed: {exc}")

    # ── 4. Target speaker features ────────────────────────────────────────────
    target_features = get_speaker_avg_features(speaker_id)
    if not target_features:
        # Graceful fallback — use neutral defaults so chat still works
        target_features = {
            "pace_syllables_per_sec": 3.0,
            "energy_level": 55.0,
            "pitch_avg": 150.0,
            "pitch_std": 30.0,
            "silence_ratio": 0.2,
        }

    # ── 5. Compute scores ─────────────────────────────────────────────────────
    scores = compute_session_scores(features, target_features)
    overall = round(
        (scores["confidence_score"] + scores["clarity_score"] +
         scores["pacing_score"] + scores["stress_accuracy"]) / 4, 1
    )
    scores["overall"] = overall

    # ── 6. Previous overall for delta ─────────────────────────────────────────
    prev_overall = float(session.get("best_score") or 0.0)
    turn_count = int(session.get("turn_count") or 0) + 1

    # ── 7. Generate feedback ──────────────────────────────────────────────────
    try:
        feedback_text, tts_text = _fast_feedback(
            scores, speaker_name, goal, style,
            turn_count, prev_overall, features, target_features,
        )
    except Exception:
        feedback_text = f"Turn {turn_count}: Overall score {overall:.0f}/100. Keep practising!"
        tts_text = f"Score is {overall:.0f} out of 100. Try again — focus on your pace."

    # ── 8. Milestone check ────────────────────────────────────────────────────
    milestone_reached = overall >= 90.0
    milestone_message = ""
    if milestone_reached:
        milestone_message = (
            f"🎉 Outstanding! You've reached {overall:.0f}% accuracy — "
            f"you're now speaking at {speaker_name}'s level for {goal}. "
            "You've mastered this style. Start a new chat to take on a new challenge!"
        )

    # ── 9. Update session ─────────────────────────────────────────────────────
    new_best = max(overall, prev_overall)
    supabase.table("chat_sessions").update({
        "best_score": new_best,
        "turn_count": turn_count,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", session_id).execute()

    # ── 10. Store turn ────────────────────────────────────────────────────────
    turn_id = str(uuid.uuid4())
    try:
        supabase.table("chat_turns").insert({
            "id": turn_id,
            "session_id": session_id,
            "user_id": user_id,
            "turn_number": turn_count,
            "confidence_score": scores["confidence_score"],
            "clarity_score": scores["clarity_score"],
            "pacing_score": scores["pacing_score"],
            "stress_accuracy": scores["stress_accuracy"],
            "overall_score": overall,
            "feedback": feedback_text,
            "duration_seconds": features.duration_seconds,
        }).execute()
    except Exception:
        pass  # non-fatal

    progress_pct = min(100.0, round(overall / 90.0 * 100, 1))

    return ChatMessageResponse(
        turn_id=turn_id,
        scores=scores,
        feedback_text=feedback_text,
        tts_text=tts_text,
        milestone_reached=milestone_reached,
        milestone_message=milestone_message,
        progress_pct=progress_pct,
        turn_count=turn_count,
    )
