-- ============================================
-- Add YouTube/source fields to learning_plans
-- Enables tracking how plans were created and storing
-- video context for chat/tutoring sessions
-- ============================================

-- Source type indicates how the plan was generated
-- 'topic' = from a text topic (default/existing behavior)
-- 'youtube' = from a YouTube video URL
ALTER TABLE learning_plans 
ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'topic';

-- Source URL stores the YouTube URL for video-based plans
ALTER TABLE learning_plans 
ADD COLUMN IF NOT EXISTS source_url TEXT;

-- Source summary stores AI-generated summary of the source content
-- This provides context for the chat/tutoring AI during sessions
ALTER TABLE learning_plans 
ADD COLUMN IF NOT EXISTS source_summary TEXT;

-- Add comments for documentation
COMMENT ON COLUMN learning_plans.source_type IS 'How the plan was created: topic (text input) or youtube (video URL)';
COMMENT ON COLUMN learning_plans.source_url IS 'Source URL for youtube-based plans';
COMMENT ON COLUMN learning_plans.source_summary IS 'AI-generated summary of source content for chat context during tutoring sessions';
