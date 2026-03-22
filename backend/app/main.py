"""
main.py
───────
SPEAK API – FastAPI application entry point.

Startup:
  Pre-loads the SentenceTransformer model so the first real request
  doesn't pay the cold-start penalty (~1–2 s).

Routes (all under /api/v1):
  Onboarding  → POST /onboard
  Speakers    → GET  /speakers, GET /speakers/{id}
  Sessions    → POST /analyze-session, /generate-blueprint, /match-speaker
  Progress    → GET  /user-progress/{user_id}
  Admin       → POST /admin/speakers, /admin/ingest-speaker-audio

Health check → GET /health
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import admin, onboarding, progress, sessions, speakers


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Warm up the embedding model once on startup (lru_cache keeps it alive)
    from .services.embedding_service import _get_model
    _get_model()
    yield


app = FastAPI(
    title="SPEAK API",
    description=(
        "AI-powered speech coaching — voice analysis, speaker matching, "
        "personalised blueprints, and session feedback."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
# Restrict allow_origins to your frontend domain in production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
PREFIX = "/api/v1"

app.include_router(onboarding.router, prefix=PREFIX, tags=["Onboarding"])
app.include_router(speakers.router,   prefix=PREFIX, tags=["Speakers"])
app.include_router(sessions.router,   prefix=PREFIX, tags=["Sessions"])
app.include_router(progress.router,   prefix=PREFIX, tags=["Progress"])
app.include_router(admin.router,      prefix=PREFIX, tags=["Admin"])


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/health", tags=["Health"])
def health_check() -> dict:
    return {"status": "ok", "service": "SPEAK API", "version": "1.0.0"}
