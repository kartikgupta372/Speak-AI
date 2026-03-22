"""
audio_processor.py
──────────────────
Extracts acoustic features from raw audio bytes using librosa.

Features extracted:
  - pitch_avg / pitch_std  : fundamental frequency statistics (Hz) via pyin
  - pace_syllables_per_sec : onset-detection-based syllable rate proxy
  - energy_level           : normalised RMS energy (0–100)
  - silence_ratio          : fraction of audio that is silence (0–1)
  - mfcc                   : list of 13 mean MFCC coefficients
  - duration_seconds       : clip length in seconds
"""

from __future__ import annotations

import io
from dataclasses import dataclass

import librosa
import numpy as np


@dataclass
class AcousticFeatures:
    pitch_avg: float
    pitch_std: float
    pace_syllables_per_sec: float
    energy_level: float          # 0–100
    silence_ratio: float         # 0–1
    mfcc: list[float]            # 13 coefficients
    duration_seconds: float


def extract_features(audio_bytes: bytes, sr: int = 22050) -> AcousticFeatures:
    """Load audio from raw bytes and return AcousticFeatures."""
    # --- load ---------------------------------------------------------------
    audio, sample_rate = librosa.load(io.BytesIO(audio_bytes), sr=sr, mono=True)
    duration = librosa.get_duration(y=audio, sr=sample_rate)

    if duration < 0.5:
        raise ValueError("Audio clip is too short (< 0.5 s). Please record at least 2–3 seconds.")

    # --- pitch (pyin) -------------------------------------------------------
    f0, voiced_flag, _ = librosa.pyin(
        audio,
        fmin=float(librosa.note_to_hz("C2")),
        fmax=float(librosa.note_to_hz("C7")),
        sr=sample_rate,
    )
    voiced_f0 = f0[voiced_flag] if voiced_flag is not None else np.array([])
    pitch_avg = float(np.mean(voiced_f0)) if voiced_f0.size > 0 else 0.0
    pitch_std = float(np.std(voiced_f0)) if voiced_f0.size > 0 else 0.0

    # --- energy (RMS, scaled to 0–100) -------------------------------------
    rms = librosa.feature.rms(y=audio)[0]
    # rms values are typically 0.0–0.5 for speech; multiply to map to 0–100
    energy_raw = float(np.mean(rms))
    energy_level = float(np.clip(energy_raw * 250.0, 0.0, 100.0))

    # --- silence ratio ------------------------------------------------------
    # split returns non-silent intervals; sum their lengths vs total
    non_silent = librosa.effects.split(audio, top_db=30)
    if non_silent.size > 0:
        speech_samples = sum(end - start for start, end in non_silent)
        speech_duration = speech_samples / sample_rate
    else:
        speech_duration = duration
    silence_ratio = float(np.clip(1.0 - (speech_duration / duration), 0.0, 1.0))

    # --- pace (syllables / sec via onset detection) -------------------------
    hop_length = 512
    onset_frames = librosa.onset.onset_detect(
        y=audio, sr=sample_rate, hop_length=hop_length, backtrack=True
    )
    # Each onset ≈ one syllable (rough but consistent proxy)
    pace = float(np.clip(len(onset_frames) / duration, 0.5, 8.0))

    # --- MFCCs (13 coefficients, mean over time) ----------------------------
    mfcc_matrix = librosa.feature.mfcc(y=audio, sr=sample_rate, n_mfcc=13)
    mfcc_means: list[float] = np.mean(mfcc_matrix, axis=1).tolist()

    return AcousticFeatures(
        pitch_avg=pitch_avg,
        pitch_std=pitch_std,
        pace_syllables_per_sec=pace,
        energy_level=energy_level,
        silence_ratio=silence_ratio,
        mfcc=mfcc_means,
        duration_seconds=float(duration),
    )
