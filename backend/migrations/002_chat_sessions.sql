-- ============================================================================
-- SPEAK Migration 002 – Chat Sessions & Turns
-- Run in Supabase SQL editor AFTER 001_initial_schema.sql
-- ============================================================================

-- Add is_custom flag to speakers (for custom speaker feature)
ALTER TABLE speakers ADD COLUMN IF NOT EXISTS is_custom BOOLEAN DEFAULT FALSE;

-- ── chat_sessions ─────────────────────────────────────────────────────────────
-- One row per coaching conversation. A user can have many sessions.
CREATE TABLE IF NOT EXISTS chat_sessions (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      TEXT         NOT NULL,
    speaker_id   UUID         REFERENCES speakers(id) ON DELETE SET NULL,
    speaker_name TEXT         NOT NULL DEFAULT '',
    goal         TEXT         NOT NULL DEFAULT 'public speaking',
    style        TEXT         NOT NULL DEFAULT 'confident',
    best_score   FLOAT        DEFAULT 0.0,
    turn_count   INTEGER      DEFAULT 0,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cs_user_id ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_cs_user_updated ON chat_sessions(user_id, updated_at DESC);

-- ── chat_turns ────────────────────────────────────────────────────────────────
-- One row per voice turn inside a chat session.
CREATE TABLE IF NOT EXISTS chat_turns (
    id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id       UUID         NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    user_id          TEXT         NOT NULL,
    turn_number      INTEGER      NOT NULL,
    confidence_score FLOAT,
    clarity_score    FLOAT,
    pacing_score     FLOAT,
    stress_accuracy  FLOAT,
    overall_score    FLOAT,
    feedback         TEXT,
    duration_seconds FLOAT,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ct_session_id ON chat_turns(session_id);
CREATE INDEX IF NOT EXISTS idx_ct_session_turn ON chat_turns(session_id, turn_number);

-- updated_at trigger for chat_sessions
CREATE OR REPLACE FUNCTION update_chat_session_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cs_updated_at
    BEFORE UPDATE ON chat_sessions
    FOR EACH ROW EXECUTE FUNCTION update_chat_session_updated_at();
