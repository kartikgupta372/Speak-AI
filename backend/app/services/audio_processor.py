"""
audio_processor.py  (optimised v2)
───────────────────────────────────
Extracts acoustic features from raw audio bytes using librosa.

Key performance changes vs v1:
  • Sample rate dropped 22050 → 16000 Hz  (−27% samples)
  • Audio truncated to max 20 s before any processing
  • pyin (slow Viterbi HMM) → yin (direct YIN algorithm, ~10× faster)
  • hop_length 512 → 1024 for onset detection (2× faster)
  • RMS window capped at 2048 frames
  
Supported formats
─────────────────
Librosa uses soundfile as its primary backend (handles WAV, FLAC, OGG).
For compressed/container formats (WebM, MP4, MP3) it falls back to
audioread, which wraps ffmpeg.

The frontend converts to WAV before uploading (see src/lib/audio.ts).
"""

from __future__ import annotations

import io
import tempfile
import os
from dataclasses import dataclass

import librosa
import numpy as np

# ── Constants ─────────────────────────────────────────────────────────────────
TARGET_SR        = 16_000   # 16 kHz — enough for all speech features
MAX_DURATION_S   = 20       # cap audio at 20 s for feature extraction
HOP_LENGTH       = 1024     # larger hop → faster STFT-based features


@dataclass
class AcousticFeatures:
    pitch_avg: float
    pitch_std: float
    pace_syllables_per_sec: float
    energy_level: float        # 0–100
    silence_ratio: float       # 0–1
    mfcc: list[float]          # 13 coefficients
    duration_seconds: float


# ── Audio loading ─────────────────────────────────────────────────────────────

def _load_audio(audio_bytes: bytes, sr: int) -> tuple[np.ndarray, int]:
    """Load audio bytes → mono numpy array at target sample rate."""
    try:
        audio, sample_rate = librosa.load(io.BytesIO(audio_bytes), sr=sr, mono=True)
        return audio, sample_rate
    except Exception as first_err:
        # Fallback: write to temp file so audioread/ffmpeg can handle WebM/MP4
        try:
            with tempfile.NamedTemporaryFile(suffix=".audio", delete=False) as tmp:
                tmp.write(audio_bytes)
                tmp_path = tmp.name
            try:
                audio, sample_rate = librosa.load(tmp_path, sr=sr, mono=True)
                return audio, sample_rate
            finally:
                try:
                    os.unlink(tmp_path)
                except OSError:
                    pass
        except Exception:
            raise ValueError(
                "Could not decode the audio file. "
                "The frontend should send WAV audio. "
                "If uploading WebM/MP4/MP3 directly, install ffmpeg: "
                "`winget install ffmpeg` (Windows) or `brew install ffmpeg` (macOS). "
                f"Original error: {first_err}"
            )


# ── Fast pitch estimation using YIN ──────────────────────────────────────────

def _fast_pitch(audio: np.ndarray, sr: int) -> tuple[float, float]:
    """
    Estimate pitch using librosa.yin — direct autocorrelation-based algorithm,
    ~10× faster than pyin (which uses a hidden Markov model).

    Returns (pitch_avg, pitch_std) in Hz.
    """
    try:
        f0 = librosa.yin(
            audio,
            fmin=float(librosa.note_to_hz("C2")),   # ~65 Hz
            fmax=float(librosa.note_to_hz("C7")),   # ~2093 Hz
            sr=sr,
            hop_length=HOP_LENGTH,
        )
        # yin returns 0 for unvoiced frames — mask them out
        voiced = f0[f0 > 80.0]
        if voiced.size == 0:
            return 0.0, 0.0
        return float(np.mean(voiced)), float(np.std(voiced))
    except Exception:
        return 0.0, 0.0


# ── Main extraction ───────────────────────────────────────────────────────────

def extract_features(audio_bytes: bytes, sr: int = TARGET_SR) -> AcousticFeatures:
    """
    Load audio from raw bytes and return AcousticFeatures.

    Processing is bounded to MAX_DURATION_S seconds — longer clips are
    trimmed before any computation, keeping latency predictable.
    """
    audio, sample_rate = _load_audio(audio_bytes, sr)
    original_duration = librosa.get_duration(y=audio, sr=sample_rate)

    # ── Truncate to cap worst-case processing time ────────────────────────────
    max_samples = MAX_DURATION_S * sample_rate
    if len(audio) > max_samples:
        audio = audio[:max_samples]
    duration = librosa.get_duration(y=audio, sr=sample_rate)

    if duration < 0.5:
        raise ValueError(
            "Audio clip is too short (< 0.5 s). Please record at least 2–3 seconds."
        )

    # ── Pitch (YIN — fast) ────────────────────────────────────────────────────
    pitch_avg, pitch_std = _fast_pitch(audio, sample_rate)

    # ── Energy (RMS, scaled 0–100) ────────────────────────────────────────────
    rms = librosa.feature.rms(y=audio, hop_length=HOP_LENGTH)[0]
    energy_raw = float(np.mean(rms))
    energy_level = float(np.clip(energy_raw * 250.0, 0.0, 100.0))

    # ── Silence ratio ─────────────────────────────────────────────────────────
    non_silent = librosa.effects.split(audio, top_db=30)
    if non_silent.size > 0:
        speech_samples = sum(end - start for start, end in non_silent)
        speech_duration = speech_samples / sample_rate
    else:
        speech_duration = duration
    silence_ratio = float(np.clip(1.0 - (speech_duration / duration), 0.0, 1.0))

    # ── Pace (syllables/sec via onset strength — no STFT overhead) ───────────
    onset_frames = librosa.onset.onset_detect(
        y=audio, sr=sample_rate, hop_length=HOP_LENGTH, backtrack=True
    )
    pace = float(np.clip(len(onset_frames) / duration, 0.5, 8.0))

    # ── MFCCs (13 coefficients, mean over time) ───────────────────────────────
    mfcc_matrix = librosa.feature.mfcc(
        y=audio, sr=sample_rate, n_mfcc=13, hop_length=HOP_LENGTH
    )
    mfcc_means: list[float] = np.mean(mfcc_matrix, axis=1).tolist()

    return AcousticFeatures(
        pitch_avg=pitch_avg,
        pitch_std=pitch_std,
        pace_syllables_per_sec=pace,
        energy_level=energy_level,
        silence_ratio=silence_ratio,
        mfcc=mfcc_means,
        duration_seconds=float(original_duration),  # report full clip length to user
    )
