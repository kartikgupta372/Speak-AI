from __future__ import annotations

from groq import Groq

from ..config import settings
from ..services.audio_processor import AcousticFeatures


def generate_session_feedback(
    user_features: AcousticFeatures,
    target_features: dict,
    scores: dict,
    target_speaker_name: str,
    intent: dict | None = None,
    previous_session: dict | None = None,
) -> str:
    client = Groq(api_key=settings.GROQ_API_KEY)

    t_pitch   = float(target_features.get("pitch_avg") or 0.0)
    t_pace    = float(target_features.get("pace_syllables_per_sec") or 3.0)
    t_energy  = float(target_features.get("energy_level") or 50.0)
    t_silence = float(target_features.get("silence_ratio") or 0.2)

    progress_block = ""
    if previous_session:
        deltas = {
            k: round(scores.get(k, 0) - float(previous_session.get(k, 0)), 1)
            for k in ("confidence_score", "clarity_score", "pacing_score", "stress_accuracy")
        }
        lines = []
        for label, key in [
            ("Confidence", "confidence_score"),
            ("Clarity",    "clarity_score"),
            ("Pacing",     "pacing_score"),
            ("Stress",     "stress_accuracy"),
        ]:
            d = deltas[key]
            sign = "+" if d >= 0 else ""
            lines.append(
                f"  {label}: {previous_session.get(key, 0):.1f} -> {scores.get(key, 0):.1f} ({sign}{d})"
            )
        progress_block = "\nCHANGE FROM PREVIOUS SESSION:\n" + "\n".join(lines)

    goal          = (intent or {}).get("goal", "public speaking")
    desired_style = (intent or {}).get("desired_style", "confident and clear")
    priority_areas = ", ".join((intent or {}).get("priority_areas", ["pace", "confidence"]))

    prompt = f"""You are a professional speech coach giving feedback after a practice session.

TARGET SPEAKER: {target_speaker_name}
USER GOAL: {goal} | DESIRED STYLE: {desired_style}
PRIORITY AREAS: {priority_areas}

USER SESSION METRICS:
  Pitch:         {user_features.pitch_avg:.1f} Hz  (target: {t_pitch:.1f} Hz)
  Pace:          {user_features.pace_syllables_per_sec:.2f} syl/sec  (target: {t_pace:.2f} syl/sec)
  Energy:        {user_features.energy_level:.1f}/100  (target: {t_energy:.1f}/100)
  Silence ratio: {user_features.silence_ratio:.2f}  (target: {t_silence:.2f})

SESSION SCORES (0-100):
  Confidence:      {scores['confidence_score']:.1f}
  Clarity:         {scores['clarity_score']:.1f}
  Pacing:          {scores['pacing_score']:.1f}
  Stress accuracy: {scores['stress_accuracy']:.1f}
{progress_block}

Write exactly 4 short paragraphs separated by blank lines:
1. ONE specific thing the user did well, tied to their numbers.
2. The single biggest gap vs {target_speaker_name} and why it matters for {goal}.
3. Two concrete drills to close that gap (use specific numbers, e.g. "speak at exactly 3.2 syl/sec").
4. One motivating line connecting today's session to their goal.

Be direct and precise. No generic filler. Use the actual numbers."""

    response = client.chat.completions.create(
        model=settings.GROQ_MODEL,
        max_tokens=600,
        messages=[{"role": "user", "content": prompt}],
    )

    return response.choices[0].message.content.strip()
