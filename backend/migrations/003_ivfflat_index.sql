-- ============================================================================
-- SPEAK Migration 003 – IVFFlat ANN Index for Voice Embeddings
-- Run in Supabase SQL editor AFTER running seed_speakers.py
--
-- Why: pgvector needs data to exist before building IVFFlat.
-- Rule of thumb: lists * 10 rows minimum. We use 4 lists for 16 rows (4 speakers × 4 samples).
-- Scale to lists = 50 when you have 500+ embeddings.
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_ve_embedding
ON voice_embeddings USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 4);

-- Update planner statistics so pgvector uses the index
ANALYZE voice_embeddings;

-- Verify the index was created
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'voice_embeddings'
  AND indexname = 'idx_ve_embedding';
