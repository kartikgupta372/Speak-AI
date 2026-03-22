-- ============================================================================
-- SPEAK – Initial Database Schema
-- Run this SQL in your Supabase SQL editor (or via psql).
-- ============================================================================

-- Enable the pgvector extension (required for vector similarity search)
CREATE EXTENSION IF NOT EXISTS vector;

-- ── updated_at trigger function ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- 1. speakers
--    Reference speaker profiles (Obama, Jobs, Churchill, Tharoor …)
-- ============================================================================
CREATE TABLE IF NOT EXISTS speakers (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    name                TEXT         NOT NULL,
    description         TEXT,
    category            TEXT,                    -- political | tech | motivational | business | …
    nationality         TEXT,
    language            TEXT         NOT NULL DEFAULT 'en',
    image_url           TEXT,
    bio                 TEXT,
    key_characteristics JSONB        DEFAULT '{}',   -- { "pace": "slow", "tone": "warm", … }
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_speakers_updated_at
    BEFORE UPDATE ON speakers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================================
-- 2. speaker_audio_segments
--    Individual audio clips uploaded for each reference speaker.
-- ============================================================================
CREATE TABLE IF NOT EXISTS speaker_audio_segments (
    id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    speaker_id       UUID         NOT NULL REFERENCES speakers(id) ON DELETE CASCADE,
    segment_name     TEXT         NOT NULL,
    audio_url        TEXT,                       -- Cloudinary / Supabase Storage URL
    duration_seconds FLOAT,
    transcription    TEXT,
    timestamp_start  FLOAT,
    timestamp_end    FLOAT,
    quality_score    INTEGER      CHECK (quality_score BETWEEN 0 AND 100),
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sas_speaker_id
    ON speaker_audio_segments(speaker_id);


-- ============================================================================
-- 3. voice_embeddings
--    384-dim text-encoded voice style embeddings + raw acoustic features.
--    One row per ingested audio segment.
-- ============================================================================
CREATE TABLE IF NOT EXISTS voice_embeddings (
    id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    speaker_id            UUID         NOT NULL REFERENCES speakers(id) ON DELETE CASCADE,
    segment_id            UUID         REFERENCES speaker_audio_segments(id) ON DELETE SET NULL,
    embedding             vector(384)  NOT NULL,
    pitch_avg             FLOAT,
    pitch_std             FLOAT,
    pace_syllables_per_sec FLOAT,
    energy_level          FLOAT,       -- 0–100
    silence_ratio         FLOAT,       -- 0–1
    mfcc                  JSONB,       -- list of 13 mean MFCC coefficients
    feature_extraction_date TIMESTAMPTZ DEFAULT NOW(),
    model_version         TEXT         DEFAULT 'all-MiniLM-L6-v2',
    created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ve_speaker_id
    ON voice_embeddings(speaker_id);

-- IVFFlat ANN index for pgvector cosine similarity search.
-- NOTE: Create this AFTER you have ingested enough speaker data
--       (rule of thumb: ≥ lists × 10 rows).  Uncomment when ready.
--
-- CREATE INDEX idx_ve_embedding
--     ON voice_embeddings USING ivfflat (embedding vector_cosine_ops)
--     WITH (lists = 50);


-- ============================================================================
-- 4. user_profiles
--    One row per user.  email is the natural dedup key.
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_profiles (
    id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              TEXT         UNIQUE NOT NULL,   -- app-level UUID (returned to client)
    name                 TEXT         NOT NULL,
    email                TEXT         UNIQUE NOT NULL,
    pitch_avg            FLOAT,
    pace_syllables_per_sec FLOAT,
    energy_level         FLOAT,
    preferred_speaker_id UUID         REFERENCES speakers(id) ON DELETE SET NULL,
    onboarding_goals     JSONB        DEFAULT '{}',      -- normalised intent dict
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================================
-- 5. user_sessions
--    One row per practice recording.
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_sessions (
    id                     UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                TEXT         NOT NULL,       -- FK to user_profiles.user_id (soft)
    speaker_id             UUID         REFERENCES speakers(id) ON DELETE SET NULL,
    session_date           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    audio_recording_url    TEXT,
    transcription          TEXT,
    confidence_score       FLOAT        CHECK (confidence_score  BETWEEN 0 AND 100),
    clarity_score          FLOAT        CHECK (clarity_score     BETWEEN 0 AND 100),
    pacing_score           FLOAT        CHECK (pacing_score      BETWEEN 0 AND 100),
    stress_accuracy        FLOAT        CHECK (stress_accuracy   BETWEEN 0 AND 100),
    feedback               TEXT,
    session_duration_seconds FLOAT,
    acoustic_features      JSONB,                       -- raw feature snapshot for replay/analytics
    created_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_us_user_id
    ON user_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_us_user_created
    ON user_sessions(user_id, created_at DESC);


-- ============================================================================
-- 6. match_speakers()  –  pgvector RPC called by vector_search.py
-- ============================================================================
--
-- Strategy: DISTINCT ON (speaker_id) picks the closest segment per speaker,
-- then the outer SELECT re-orders by similarity descending so the best
-- overall match comes first.
-- ============================================================================
CREATE OR REPLACE FUNCTION match_speakers(
    query_embedding  vector(384),
    match_count      INT     DEFAULT 5,
    filter_language  TEXT    DEFAULT NULL
)
RETURNS TABLE (
    id                  UUID,
    name                TEXT,
    description         TEXT,
    category            TEXT,
    nationality         TEXT,
    language            TEXT,
    image_url           TEXT,
    bio                 TEXT,
    key_characteristics JSONB,
    similarity          FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH best_per_speaker AS (
        -- For each speaker pick the segment whose embedding is closest
        SELECT DISTINCT ON (s.id)
            s.id,
            s.name,
            s.description,
            s.category,
            s.nationality,
            s.language,
            s.image_url,
            s.bio,
            s.key_characteristics,
            (1.0 - (ve.embedding <=> query_embedding))::FLOAT AS similarity
        FROM voice_embeddings ve
        JOIN speakers s ON s.id = ve.speaker_id
        WHERE (filter_language IS NULL OR s.language = filter_language)
        ORDER BY s.id, ve.embedding <=> query_embedding   -- ASC = smallest distance first
    )
    SELECT *
    FROM best_per_speaker
    ORDER BY similarity DESC
    LIMIT match_count;
END;
$$;
