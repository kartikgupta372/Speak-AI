"""
intent_parser.py
────────────────
Parses free-text user goals + scenario into a normalised intent dict
using the Groq API (llama-4-scout).

Output schema:
  {
    "goal":           "interview" | "presentation" | "pitch" | "public_speaking" | "conversation" | "other",
    "desired_style":  "brief adjective e.g. authoritative, warm, dynamic",
    "priority_areas": ["pace", "energy", "clarity", "pauses", "confidence"],
    "context":        "one-line summary"
  }
"""

from __future__ import annotations

import json

from groq import Groq

from ..config import settings


def parse_intent(goals: str, scenario: str) -> dict:
    """Return a normalised intent dict derived from user-supplied text."""
    client = Groq(api_key=settings.GROQ_API_KEY)

    prompt = f"""You are parsing user input for a speech coaching app.
Given the user's goals and scenario, return a JSON object — no preamble, no markdown fences.

Rules:
- "goal" must be one of: interview, presentation, pitch, public_speaking, conversation, other
- "desired_style": 2–4 words describing the vocal style they want (e.g. "authoritative and calm")
- "priority_areas": list of 1–3 items from: pace, energy, clarity, pauses, confidence, tone
- "context": one concise sentence summarising the situation

User goals: {goals}
Scenario: {scenario}

JSON output only:"""

    response = client.chat.completions.create(
        model=settings.GROQ_MODEL,
        max_tokens=256,
        messages=[{"role": "user", "content": prompt}],
    )

    raw: str = response.choices[0].message.content.strip()

    # Strip accidental markdown fences
    if raw.startswith("```"):
        parts = raw.split("```")
        raw = parts[1].lstrip("json").strip() if len(parts) > 1 else raw

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        # Fallback: return safe defaults rather than crashing
        return {
            "goal": scenario.lower() if scenario else "public_speaking",
            "desired_style": "confident and clear",
            "priority_areas": ["pace", "confidence", "clarity"],
            "context": goals[:200] if goals else "General speaking improvement",
        }
