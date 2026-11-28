-- Add source column to transcript_chunks for user uploads
ALTER TABLE transcript_chunks ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'session' CHECK (source IN ('session', 'user_upload'));

-- Update existing chunks to have 'session' source
UPDATE transcript_chunks SET source = 'session' WHERE source IS NULL;

-- Make session_id nullable for user uploads
ALTER TABLE transcript_chunks ALTER COLUMN session_id DROP NOT NULL;

-- Add index on source for filtering
CREATE INDEX IF NOT EXISTS idx_transcript_chunks_source ON transcript_chunks(source);
