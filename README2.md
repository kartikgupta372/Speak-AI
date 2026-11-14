# SPEAK AI — Production Changes & Deployment Guide

> All changes made to make this project deployable. Written in plain English.

---

## What Was Broken (and Fixed)

### 1. No Dockerfile — backend couldn't be deployed to Railway
**Problem:** The backend needs `ffmpeg` and `libsndfile` installed at the system level for audio processing (`pydub`, `soundfile`). These aren't available on plain cloud platforms unless you use a Dockerfile that installs them.

Also: `sentence-transformers` downloads a 90MB embedding model on first use. Without pre-downloading it in the image, the first request would time out.

**Fix:** Created a `Dockerfile` that:
- Installs `ffmpeg` and `libsndfile1` at the OS level
- Pre-downloads the `all-MiniLM-L6-v2` embedding model during image build (avoids cold-start timeout)

**File created:** `backend/Dockerfile`

---

### 2. No frontend `.env.example`
**Fix:** Created `frontend/.env.example` with `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_API_KEY` documented.

**File created:** `frontend/.env.example`

---

### 3. Things already production-ready ✅
- **CORS** — `ALLOWED_ORIGINS` reads from env var, supports comma-separated list
- **Auth middleware** — `FRONTEND_API_KEY` env var gates all endpoints in production
- **Config** — pydantic settings reads all values from environment
- **Admin key** — separate `ADMIN_KEY` for admin routes

---

## How to Deploy

### Backend → Railway

1. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
2. Set **Root Directory** to `backend/`
3. Railway detects the `Dockerfile` automatically
4. In Variables tab, add:
   ```
   SUPABASE_URL=https://vwlcmzqpksotjdpibgmy.supabase.co    (already in .env)
   SUPABASE_KEY=...                                            (already in .env)
   GROQ_API_KEY=...                                           (already in .env)
   SUPABASE_STORAGE_BUCKET=speak-audio
   FRONTEND_API_KEY=<generate a strong secret>
   ADMIN_KEY=<generate a strong secret>
   ALLOWED_ORIGINS=https://your-speak.vercel.app
   PORT=8000
   ```
5. Copy the Railway public URL

### Frontend → Vercel

1. Go to [vercel.com](https://vercel.com) → New Project → Import repo
2. Set **Root Directory** to `frontend/`
3. Framework: Next.js (auto-detected)
4. Add environment variables:
   ```
   NEXT_PUBLIC_API_URL=https://speak-backend.up.railway.app/api/v1
   NEXT_PUBLIC_API_KEY=<same value as FRONTEND_API_KEY in backend>
   ```
5. Deploy

### Database (Supabase — already set up)
The Supabase project is already configured. Just make sure to run the migrations if you haven't:
- Go to Supabase → SQL Editor → paste and run `backend/migrations/001_initial_schema.sql`

### Ingest Reference Speakers (one-time admin task)
```bash
cd backend
python seed_speakers.py   # if this exists, or use the ingest script from README
```

---

## Keys You Need

| Key | Where | Required? |
|-----|-------|-----------|
| `SUPABASE_URL` + `SUPABASE_KEY` | Already in `.env` | ✅ Yes |
| `GROQ_API_KEY` | Already in `.env` | ✅ Yes |
| `FRONTEND_API_KEY` | Generate any strong string | ✅ Yes (prod) |
| `ADMIN_KEY` | Generate any strong string | ✅ Yes (prod) |
| `ALLOWED_ORIGINS` | Your Vercel URL | ✅ Yes (prod) |
| `NEXT_PUBLIC_API_URL` | Your Railway URL | ✅ Yes (frontend) |
| `NEXT_PUBLIC_API_KEY` | Same as FRONTEND_API_KEY | ✅ Yes (frontend) |

---

## Local Dev (unchanged)

```bash
# Terminal 1 — backend
cd backend
python -m venv venv
venv\Scripts\activate   # Windows / source venv/bin/activate on Mac
pip install -r requirements.txt
# .env already has your Supabase + Groq keys — no changes needed for dev
uvicorn app.main:app --reload --port 8000

# Terminal 2 — frontend
cd frontend
npm install
# copy .env.example to .env.local (already configured for localhost)
npm run dev   # → http://localhost:3000
```

API docs: **http://localhost:8000/docs**

---

*Changes made by Claude on 2026-06-02*
