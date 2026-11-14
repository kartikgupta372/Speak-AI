#!/usr/bin/env python3
"""
seed_speakers.py
────────────────
Seeds voice_embeddings for the 4 reference speakers already in Supabase.
Run from the backend/ directory after installing requirements:

    cd backend
    pip install -r requirements.txt
    python seed_speakers.py

The script:
  1. Loads the sentence-transformer model (downloads ~90 MB on first run)
  2. Looks up each speaker UUID from the DB by name
  3. Generates 4 synthetic but acoustically realistic embeddings per speaker
  4. Inserts them into voice_embeddings
  5. Prints the IVFFlat index SQL to run in Supabase SQL editor

Safe to re-run — clears old embeddings for these speakers first.
"""

from __future__ import annotations

import os
import sys
import random
import uuid
import json

random.seed(42)

# ── Load .env ─────────────────────────────────────────────────────────────────
from dotenv import load_dotenv
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")

if not SUPABASE_URL or not SUPABASE_KEY:
    sys.exit("ERROR: SUPABASE_URL and SUPABASE_KEY must be set in .env")

from supabase import create_client
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# ── Embedding model ───────────────────────────────────────────────────────────
print("Loading embedding model (first run downloads ~90 MB)...")
from sentence_transformers import SentenceTransformer
model = SentenceTransformer(os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2"))
print("✓ Model loaded\n")


# ── Helpers ───────────────────────────────────────────────────────────────────

def build_text(pitch_avg, pitch_std, pace, energy, silence_ratio) -> str:
    """Same text template as embedding_service.py"""
    pitch_label = "high-pitch" if pitch_avg > 220 else ("low-pitch" if pitch_avg < 110 else "medium-pitch")
    pitch_var = "low variation" if pitch_std < 20 else ("high variation" if pitch_std > 50 else "moderate variation")
    pace_label = "fast" if pace > 4.5 else ("slow" if pace < 2.5 else "moderate")
    energy_label = "high" if energy > 65 else ("low" if energy < 30 else "medium")
    pause_label = (
        "frequent deliberate pauses" if silence_ratio > 0.35
        else ("minimal pauses, continuous flow" if silence_ratio < 0.08 else "moderate pauses")
    )
    return (
        f"{pitch_label.capitalize()} speaker at {pitch_avg:.1f}Hz with {pitch_var}, "
        f"{pace_label} speaking pace at {pace:.2f} syllables per second, "
        f"{energy_label} vocal energy level at {energy:.1f}, "
        f"{pause_label} with silence ratio {silence_ratio:.2f}."
    )


def make_embedding(text: str) -> list[float]:
    return model.encode(text, normalize_embeddings=True).tolist()


def vec_to_str(v: list[float]) -> str:
    return "[" + ",".join(f"{x:.8f}" for x in v) + "]"


def jitter(val: float, pct: float = 0.07) -> float:
    return val * (1.0 + random.uniform(-pct, pct))


BASE_MFCC = [-120.0, 80.0, -10.0, 15.0, -5.0, 8.0, -3.0, 5.0, -2.0, 4.0, -1.5, 2.5, -1.0]

def make_mfcc(offset: float = 0.0) -> list[float]:
    return [v + offset + random.uniform(-2, 2) for v in BASE_MFCC]


# ── Speaker acoustic profiles ─────────────────────────────────────────────────
# Acoustic characteristics based on known speaking styles.
# Each generates 4 jittered samples to simulate multiple clips.

SPEAKER_PROFILES = [
    {
        "name": "Barack Obama",
        "features": {"pitch_avg": 128.0, "pitch_std": 22.0, "pace": 2.75,
                     "energy": 68.0, "silence": 0.32, "mfcc_off": 0.0},
    },
    {
        "name": "Steve Jobs",
        "features": {"pitch_avg": 145.0, "pitch_std": 38.0, "pace": 3.65,
                     "energy": 76.0, "silence": 0.14, "mfcc_off": 5.0},
    },
    {
        "name": "Shashi Tharoor",
        "features": {"pitch_avg": 138.0, "pitch_std": 48.0, "pace": 3.30,
                     "energy": 62.0, "silence": 0.20, "mfcc_off": 2.5},
    },
    {
        "name": "Winston Churchill",
        "features": {"pitch_avg": 108.0, "pitch_std": 28.0, "pace": 2.20,
                     "energy": 72.0, "silence": 0.40, "mfcc_off": -5.0},
    },
]


# ── Main ──────────────────────────────────────────────────────────────────────

def seed_embeddings(profile: dict) -> int:
    """Insert 4 synthetic voice_embeddings for a speaker. Returns count inserted."""
    # Look up speaker UUID by name
    result = (
        supabase.table("speakers")
        .select("id, name")
        .eq("name", profile["name"])
        .eq("is_custom", False)
        .maybe_single()
        .execute()
    )
    if not result.data:
        print(f"  ✗ Speaker '{profile['name']}' not found in DB — run SQL inserts first.")
        return 0

    speaker_id = result.data["id"]
    f = profile["features"]

    # Clear existing embeddings for this speaker
    supabase.table("voice_embeddings").delete().eq("speaker_id", speaker_id).execute()

    inserted = 0
    for i in range(4):
        pitch_avg   = jitter(f["pitch_avg"])
        pitch_std   = jitter(f["pitch_std"])
        pace        = jitter(f["pace"])
        energy      = jitter(f["energy"])
        silence     = max(0.05, min(0.65, jitter(f["silence"], pct=0.05)))
        mfcc        = make_mfcc(f["mfcc_off"])

        text = build_text(pitch_avg, pitch_std, pace, energy, silence)
        embedding = make_embedding(text)

        supabase.table("voice_embeddings").insert({
            "id":                      str(uuid.uuid4()),
            "speaker_id":              speaker_id,
            "segment_id":              None,
            "embedding":               vec_to_str(embedding),
            "pitch_avg":               round(pitch_avg, 2),
            "pitch_std":               round(pitch_std, 2),
            "pace_syllables_per_sec":  round(pace, 3),
            "energy_level":            round(energy, 2),
            "silence_ratio":           round(silence, 3),
            "mfcc":                    mfcc,
            "model_version":           os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2"),
        }).execute()

        inserted += 1

    return inserted


def verify() -> None:
    speakers = supabase.table("speakers").select("id, name").eq("is_custom", False).execute()
    embeddings = supabase.table("voice_embeddings").select("id, speaker_id").execute()
    print("\n✅ Verification:")
    print(f"   Speakers     : {len(speakers.data or [])}")
    print(f"   Embeddings   : {len(embeddings.data or [])}")
    for spk in (speakers.data or []):
        count = sum(1 for e in (embeddings.data or []) if e["speaker_id"] == spk["id"])
        print(f"   {spk['name']:<25} {count} embeddings")


if __name__ == "__main__":
    print("=" * 60)
    print("SPEAK — Voice Embedding Seeder")
    print("=" * 60)
    print()

    total = 0
    for profile in SPEAKER_PROFILES:
        print(f"Seeding: {profile['name']}")
        n = seed_embeddings(profile)
        if n:
            print(f"  ✓ {n} embeddings inserted")
            total += n
        print()

    verify()

    print(f"\n🎉 Done! {total} embeddings seeded.")
    print()
    print("NEXT STEP — Run this SQL in Supabase SQL editor to enable fast ANN search:")
    print("""
  CREATE INDEX IF NOT EXISTS idx_ve_embedding
  ON voice_embeddings USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 4);
  ANALYZE voice_embeddings;
""")
    print("Then start the backend: uvicorn app.main:app --reload --port 8000")
