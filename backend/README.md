# SPEAK Backend

AI-powered speech coaching API — FastAPI + Supabase + pgvector + Anthropic.

## Setup

### 1. Create virtual environment & install deps

```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your Supabase, Anthropic, and Cloudinary credentials
```

### 3. Run database migrations

Open your Supabase project → SQL Editor → paste and run `migrations/001_initial_schema.sql`.

### 4. Start the server

```bash
uvicorn app.main:app --reload --port 8000
```

API docs: http://localhost:8000/docs

---

## Ingest a Reference Speaker (Admin)

```bash
python scripts/ingest_speaker.py \
  --audio path/to/obama_speech.mp3 \
  --name "Barack Obama" \
  --category political \
  --language en \
  --characteristics '{"pace":"moderate","tone":"warm","energy":"medium"}'
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/onboard` | Onboard user: baseline audio + metadata → matched speakers |
| GET | `/speakers` | List reference speakers (filter by category/language) |
| GET | `/speakers/{id}` | Get single speaker detail |
| POST | `/generate-blueprint` | Generate personalized speaking blueprint |
| POST | `/analyze-session` | Analyze practice session → scores + feedback |
| GET | `/user-progress/{user_id}` | Get session history + progress trend |
| GET | `/health` | Health check |
