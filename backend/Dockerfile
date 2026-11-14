# SPEAK Backend — Dockerfile
# FastAPI + audio processing (librosa, soundfile, pydub) + sentence-transformers
# Deploy to Railway: set Root Directory to "backend/" → Railway detects Dockerfile.

FROM python:3.11-slim

# ── System dependencies for audio processing ───────────────────────────────────
# ffmpeg   → pydub audio conversion
# libsndfile1 → soundfile (reading/writing WAV, FLAC, etc.)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libsndfile1 \
    gcc \
    g++ \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies first (layer cache)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download the sentence-transformers embedding model during build
# This avoids a slow cold-start on the first request in production
RUN python -c "\
from sentence_transformers import SentenceTransformer; \
SentenceTransformer('all-MiniLM-L6-v2'); \
print('Embedding model cached.')"

# Copy source
COPY . .

ENV PORT=8000
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

EXPOSE 8000

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
