-- ============================================
-- Uncertain Systems — Database Schema (authoritative entry point)
-- ============================================
--
-- This file is NOT a source of truth. The database is defined by timestamped
-- migrations in `supabase/migrations/`, applied in filename order.
--
-- Current chain:
--   20260711120000_baseline.sql  — squashed production public schema
--   20260711120001_rename_ghc_sessions_to_tap.sql
--
-- Historical migrations live in `supabase/migrations/_archive/pre-baseline/`.
--
-- To set up a fresh database (staging branch or new project):
--
--   npm run db:migrate:staging   # or db:migrate for production
--   npm run db:check-drift:staging
--   4. Storage buckets must be created via the dashboard:
--        - `session-audio`  (private) — audio chunks: {user_id}/{session_id}.webm
--        - `plan-covers`    (private) — AI-generated plan cover images
--      The legacy buckets (`session-transcript`, `session-eeg`, `session-tool`,
--      `session-facial`, `session-screens`, `plan-files`, `user-transcripts`)
--      are no longer used — storage is now xAI Files for everything except
--      audio. See `028_plan_files_xai.sql`, `033_transcripts_xai.sql`,
--      `034_session_data_xai.sql`, `035_session_analysis.sql`.
--
-- Data plane summary:
--   - Supabase Postgres:  all relational state + RLS
--   - Supabase Storage:   audio blobs, AI plan cover images
--   - xAI Files:          transcripts, EEG, facial, tool events, screenshots,
--                         plan attachments, analysis heartbeat records.
--                         Rows in session_* tables point to xai_file_id.
--
-- DO NOT add new tables here. Add a new migration file instead.
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- PROFILES (extends auth.users)
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'username');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

-- ============================================
-- SESSIONS
-- ============================================
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  problem TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'ended_by_tutor')),
  duration_ms INTEGER DEFAULT 0,
  audio_path TEXT,              -- Supabase Storage path (session-audio/...)
  report TEXT,                  -- AI-generated session report (markdown)
  report_generated_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at DESC);

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own sessions" ON sessions;
CREATE POLICY "Users can view own sessions"
  ON sessions FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own sessions" ON sessions;
CREATE POLICY "Users can create own sessions"
  ON sessions FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own sessions" ON sessions;
CREATE POLICY "Users can update own sessions"
  ON sessions FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own sessions" ON sessions;
CREATE POLICY "Users can delete own sessions"
  ON sessions FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- PROBES (guiding questions generated during sessions)
-- ============================================
CREATE TABLE IF NOT EXISTS probes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE NOT NULL,
  timestamp_ms INTEGER NOT NULL,
  gap_score FLOAT NOT NULL,
  signals TEXT[] DEFAULT '{}',
  text TEXT NOT NULL,
  expanded_text TEXT,
  is_revealed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_probes_session_id ON probes(session_id);

ALTER TABLE probes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own probes" ON probes;
CREATE POLICY "Users can view own probes"
  ON probes FOR SELECT USING (
    EXISTS (SELECT 1 FROM sessions WHERE sessions.id = probes.session_id AND sessions.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can create probes for own sessions" ON probes;
CREATE POLICY "Users can create probes for own sessions"
  ON probes FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM sessions WHERE sessions.id = probes.session_id AND sessions.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can update own probes" ON probes;
CREATE POLICY "Users can update own probes"
  ON probes FOR UPDATE USING (
    EXISTS (SELECT 1 FROM sessions WHERE sessions.id = probes.session_id AND sessions.user_id = auth.uid())
  );

-- ============================================
-- EVERYTHING ELSE lives in migrations/
--
--   002_pricing.sql, 003_transcript.sql, 004_starred_probes.sql (root level,
--   legacy numbering; applied before migrations/*)
--
--   migrations/005_agent_api_keys.sql
--   migrations/006_transcript_source.sql
--   migrations/007_session_status.sql
--   migrations/008_token_validation.sql
--   migrations/009_add_node_positions.sql
--   migrations/010_public_workspaces.sql (historical 010; renamed in 054)
--   migrations/011_public_profiles_read.sql
--   migrations/012_partner_program.sql
--   migrations/013_add_credits.sql
--   migrations/014_leads_table.sql
--   migrations/015_organizations.sql
--   migrations/016_session_plans.sql
--   migrations/017_probe_plan_step_link.sql
--   migrations/018_planning_prompt_and_description.sql
--   migrations/019_probe_archive_focus.sql
--   migrations/020_youtube_source.sql        (YouTube source flag; later removed)
--   migrations/021_session_screenshots.sql
--   migrations/022_partner_fixes.sql
--   migrations/023_plan_notes.sql
--   migrations/024_plan_analytics.sql
--   migrations/025_plan_cover_images.sql
--   migrations/026_agent_v2.sql
--   migrations/027_plan_files.sql  (+ _verify, _debug variants)
--   migrations/028_plan_files_xai.sql           (plan files → xAI Files)
--   migrations/029_remove_rag_and_youtube.sql   (drop pgvector + RAG + YouTube)
--   migrations/030_plan_files_verify.sql
--   migrations/031_cleanup_legacy_plan_files.sql
--   migrations/032_fix_plan_analytics.sql
--   migrations/033_transcripts_xai.sql          (transcripts → xAI Files)
--   migrations/034_session_data_xai.sql         (EEG/tool/facial/screens → xAI Files)
--   migrations/035_session_analysis.sql         (heartbeat analysis → xAI Files)
--   migrations/036_group_plans.sql              (group workspaces + block_sessions; see 054)
--   migrations/037_public_profiles.sql          (public profile stats)
--   migrations/038_fix_group_plan_performance_sessions.sql
--
-- Note:
--   * `001_add_vector_search.sql` is historical — migration 029 drops the
--     vector RAG subsystem entirely, so re-running 001 on a fresh DB would
--     succeed but the RPC is removed again by 029.
--   * The following tables defined in earlier revisions of this file have
--     been removed and are NOT part of the current schema:
--       user_transcripts, transcript_chunks, transcript_rag_chunks,
--       session_eeg_data, session_transcripts (plural), session_data.
--     Do not reference them in new code.
-- ============================================
