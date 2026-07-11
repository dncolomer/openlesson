-- ============================================
-- Add transcript column to sessions
-- Stores the full text transcript generated
-- from the session audio recording.
-- ============================================

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS transcript TEXT;
