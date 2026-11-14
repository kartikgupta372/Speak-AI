from __future__ import annotations

import json

from groq import Groq

from ..config import settings


def generate_blueprint(
    user_profile: dict,
    target_speaker: dict,
    target_features: dict,
    intent: dict,
) -> dict:
    client = Groq(api_key=settings.GROQ_API_KEY)

    u_pace   = float(user_profile.get("pace_syllables_per_sec") or 3.0)
    u_energy = float(user_profile.get("energy_level") or 50.0)
    u_pitch  = float(user_profile.get("pitch_avg") or 150.0)

    t_pace   = float(target_features.get("pace_syllables_per_sec") or 3.0)
    t_energy = float(target_features.get("energy_level") or 50.0)
    t_pitch  = float(target_features.get("pitch_avg") or 150.0)

    speaker_name  = target_speaker.get("name", "target speaker")
    speaker_chars = target_speaker.get("key_characteristics") or {}
    goal          = intent.get("goal", "public speaking")
    desired_style = intent.get("desired_style", "confident and clear")

    prompt = f"""You are a speech coach building a personalised speaking blueprint.

USER BASELINE:
  Pace:   {u_pace:.2f} syl/sec
  Energy: {u_energy:.1f}/100
  Pitch:  {u_pitch:.1f} Hz

TARGET SPEAKER: {speaker_name}
SPEAKER CHARACTERISTICS: {json.dumps(speaker_chars)}
TARGET METRICS:
  Pace:   {t_pace:.2f} syl/sec
  Energy: {t_energy:.1f}/100
  Pitch:  {t_pitch:.1f} Hz

USER GOAL: {goal}
DESIRED STYLE: {desired_style}

Return ONLY a raw JSON object — no markdown, no preamble:
{{
  "overview": "2-sentence plan summary",
  "pace_guidance": "exact instruction with target numbers",
  "pause_guidance": "when and how long to pause for impact",
  "energy_guidance": "how to modulate vocal energy",
  "emphasis_guidance": "which types of words/phrases to stress and how",
  "daily_exercises": ["exercise 1", "exercise 2", "exercise 3"],
  "milestone": "what measurable success looks like after 2 weeks"
}}"""

    response = client.chat.completions.create(
        model=settings.GROQ_MODEL,
        max_tokens=900,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = response.choices[0].message.content.strip()

    if raw.startswith("```"):
        parts = raw.split("```")
        raw = parts[1].lstrip("json").strip() if len(parts) > 1 else raw

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pace_delta = t_pace - u_pace
        return {
            "overview": (
                f"Your goal is to sound more like {speaker_name}: {desired_style}. "
                f"Focus on closing the gap in pace ({pace_delta:+.2f} syl/sec) and energy."
            ),
            "pace_guidance": f"Target {t_pace:.2f} syl/sec (you are currently at {u_pace:.2f}).",
            "pause_guidance": "Insert 0.5-1 second pauses after key points to let them land.",
            "energy_guidance": f"Aim for energy level {t_energy:.0f}/100; project from your chest, not your throat.",
            "emphasis_guidance": "Stress the most important noun or verb in each sentence.",
            "daily_exercises": [
                f"Record 2 minutes of reading aloud at {t_pace:.1f} syl/sec using a metronome app.",
                f"Shadow {speaker_name} for 10 minutes — match pace and pauses exactly.",
                "Practise one 90-second pitch daily and score yourself on energy.",
            ],
            "milestone": "After 2 weeks your pacing and confidence scores should each rise by >= 15 points.",
        }
