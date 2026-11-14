from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import settings
from .routers import admin, onboarding, progress, sessions, speakers, chat, custom_speakers, ai_speaker


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── 1. Load embedding model ───────────────────────────────────────────────
    try:
        from .services.embedding_service import _get_model
        _get_model()
        print("✓  Embedding model loaded.")
    except Exception as exc:
        print(f"⚠  Embedding model failed to load: {exc}. Will retry on first request.")

    # ── 2. Ensure Supabase Storage bucket exists ──────────────────────────────
    try:
        from .services.storage import ensure_bucket
        ensure_bucket()
    except Exception as exc:
        print(f"⚠  Storage bucket init failed (non-fatal): {exc}")

    yield


app = FastAPI(
    title="SPEAK API",
    description="AI-powered speech coaching — voice analysis, speaker matching, chat coaching.",
    version="2.0.0",
    lifespan=lifespan,
)

# ── CORS ─────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins_list,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

_PUBLIC_PATHS = {"/health", "/docs", "/redoc", "/openapi.json"}


@app.middleware("http")
async def api_key_middleware(request: Request, call_next):
    if request.method == "OPTIONS" or request.url.path in _PUBLIC_PATHS:
        return await call_next(request)
    if not settings.FRONTEND_API_KEY:
        return await call_next(request)
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return JSONResponse(
            status_code=401,
            content={"detail": "Missing Authorization header. Expected: Bearer <key>"},
        )
    token = auth_header[len("Bearer "):]
    if token != settings.FRONTEND_API_KEY:
        return JSONResponse(status_code=401, content={"detail": "Invalid API key."})
    return await call_next(request)


PREFIX = "/api/v1"

app.include_router(onboarding.router,       prefix=PREFIX, tags=["Onboarding"])
app.include_router(speakers.router,         prefix=PREFIX, tags=["Speakers"])
app.include_router(sessions.router,         prefix=PREFIX, tags=["Sessions"])
app.include_router(progress.router,         prefix=PREFIX, tags=["Progress"])
app.include_router(admin.router,            prefix=PREFIX, tags=["Admin"])
app.include_router(chat.router,             prefix=PREFIX, tags=["Chat"])
app.include_router(custom_speakers.router,  prefix=PREFIX, tags=["Custom Speakers"])
app.include_router(ai_speaker.router,       prefix=PREFIX, tags=["AI Speaker"])


@app.get("/health", tags=["Health"])
def health_check() -> dict:
    return {
        "status": "ok",
        "service": "SPEAK API",
        "version": "2.0.0",
        "auth_enabled": bool(settings.FRONTEND_API_KEY),
        "admin_key_set": bool(settings.ADMIN_KEY),
        "storage_bucket": settings.SUPABASE_STORAGE_BUCKET,
    }
