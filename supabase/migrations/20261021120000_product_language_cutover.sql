-- Product-language cutover: Calibrate, Verify, and Learn on three tables.
-- Operator accepted brief downtime; no compatibility VIEWs.
--
-- Before apply on prod, dump unused tables if you need them:
--   pg_dump -t workspace_tapbench_links -t tapbench_runs -t tapbench_task_keys
--          -t tapbench_key_guests -t workspace_practice_portals
--          -t workspace_teach_backs

-- ── 1. Split workspace_tap_sessions into Verify + Calibrate ─────────────────

ALTER TABLE IF EXISTS public.workspace_tap_sessions
  RENAME TO workspace_verify_sessions;

ALTER INDEX IF EXISTS workspace_tap_sessions_pkey
  RENAME TO workspace_verify_sessions_pkey;
ALTER INDEX IF EXISTS workspace_tap_sessions_private_token_hash_key
  RENAME TO workspace_verify_sessions_private_token_hash_key;
ALTER INDEX IF EXISTS workspace_tap_sessions_workspace_user_idx
  RENAME TO workspace_verify_sessions_workspace_user_idx;
ALTER INDEX IF EXISTS workspace_tap_sessions_token_hash_idx
  RENAME TO workspace_verify_sessions_token_hash_idx;
ALTER INDEX IF EXISTS workspace_tap_sessions_api_key_idx
  RENAME TO workspace_verify_sessions_api_key_idx;
ALTER INDEX IF EXISTS workspace_tap_sessions_session_idx
  RENAME TO workspace_verify_sessions_session_idx;
ALTER INDEX IF EXISTS workspace_tap_sessions_block_idx
  RENAME TO workspace_verify_sessions_block_idx;
ALTER INDEX IF EXISTS idx_workspace_tap_sessions_guest
  RENAME TO idx_workspace_verify_sessions_guest;
ALTER INDEX IF EXISTS idx_workspace_tap_sessions_org
  RENAME TO idx_workspace_verify_sessions_org;
ALTER INDEX IF EXISTS idx_workspace_tap_sessions_assigned_user
  RENAME TO idx_workspace_verify_sessions_assigned_user;
ALTER INDEX IF EXISTS workspace_tap_sessions_public_token_key
  RENAME TO workspace_verify_sessions_public_token_key;
ALTER INDEX IF EXISTS idx_workspace_tap_sessions_access_mode
  RENAME TO idx_workspace_verify_sessions_access_mode;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'workspace_verify_sessions'
      AND policyname = 'Users can read own workspace TAP sessions'
  ) THEN
    ALTER POLICY "Users can read own workspace TAP sessions"
      ON public.workspace_verify_sessions
      RENAME TO "Users can read own workspace Verify sessions";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'workspace_verify_sessions'
      AND policyname = 'Users can insert own workspace TAP sessions'
  ) THEN
    ALTER POLICY "Users can insert own workspace TAP sessions"
      ON public.workspace_verify_sessions
      RENAME TO "Users can insert own workspace Verify sessions";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'workspace_verify_sessions'
      AND policyname = 'Users can update own workspace TAP sessions'
  ) THEN
    ALTER POLICY "Users can update own workspace TAP sessions"
      ON public.workspace_verify_sessions
      RENAME TO "Users can update own workspace Verify sessions";
  END IF;
END $$;

-- Drop the old kind CHECK before copying so Calibrate can store `calibrate`.
ALTER TABLE public.workspace_verify_sessions
  DROP CONSTRAINT IF EXISTS workspace_tap_sessions_interaction_kind_check;
ALTER TABLE public.workspace_verify_sessions
  DROP CONSTRAINT IF EXISTS workspace_verify_sessions_interaction_kind_check;

-- Copy columns/constraints without indexes (index names would collide).
CREATE TABLE IF NOT EXISTS public.workspace_calibrate_sessions
  (LIKE public.workspace_verify_sessions INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING STORAGE INCLUDING COMMENTS INCLUDING GENERATED INCLUDING IDENTITY);

INSERT INTO public.workspace_calibrate_sessions
SELECT * FROM public.workspace_verify_sessions
WHERE interaction_kind = 'scout';

DELETE FROM public.workspace_verify_sessions
WHERE interaction_kind = 'scout';

CREATE UNIQUE INDEX IF NOT EXISTS workspace_calibrate_sessions_private_token_hash_key
  ON public.workspace_calibrate_sessions (private_token_hash);
CREATE INDEX IF NOT EXISTS workspace_calibrate_sessions_workspace_user_idx
  ON public.workspace_calibrate_sessions (workspace_id, user_id);
CREATE INDEX IF NOT EXISTS workspace_calibrate_sessions_token_hash_idx
  ON public.workspace_calibrate_sessions (private_token_hash);
CREATE INDEX IF NOT EXISTS workspace_calibrate_sessions_api_key_idx
  ON public.workspace_calibrate_sessions (created_by_api_key_id);
CREATE INDEX IF NOT EXISTS workspace_calibrate_sessions_session_idx
  ON public.workspace_calibrate_sessions (session_id);
CREATE INDEX IF NOT EXISTS workspace_calibrate_sessions_block_idx
  ON public.workspace_calibrate_sessions (block_id);
CREATE INDEX IF NOT EXISTS idx_workspace_calibrate_sessions_guest
  ON public.workspace_calibrate_sessions (guest_user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_calibrate_sessions_org
  ON public.workspace_calibrate_sessions (organization_id);
CREATE INDEX IF NOT EXISTS idx_workspace_calibrate_sessions_assigned_user
  ON public.workspace_calibrate_sessions (assigned_user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS workspace_calibrate_sessions_public_token_key
  ON public.workspace_calibrate_sessions (public_token);
CREATE INDEX IF NOT EXISTS idx_workspace_calibrate_sessions_access_mode
  ON public.workspace_calibrate_sessions (workspace_id, access_mode, created_at DESC);

ALTER TABLE public.workspace_verify_sessions
  ADD COLUMN IF NOT EXISTS session_shell text;

ALTER TABLE public.workspace_calibrate_sessions
  ADD COLUMN IF NOT EXISTS session_shell text;

UPDATE public.workspace_verify_sessions
SET session_shell = CASE
  WHEN interaction_kind IN ('exercise', 'solo') THEN 'solo'
  ELSE 'dialog'
END
WHERE session_shell IS NULL;

UPDATE public.workspace_verify_sessions
SET interaction_kind = 'verify'
WHERE interaction_kind IS DISTINCT FROM 'verify';

UPDATE public.workspace_calibrate_sessions
SET interaction_kind = 'calibrate'
WHERE interaction_kind IS DISTINCT FROM 'calibrate';

ALTER TABLE public.workspace_verify_sessions
  ADD CONSTRAINT workspace_verify_sessions_interaction_kind_check
  CHECK (interaction_kind IN ('verify'));

ALTER TABLE public.workspace_verify_sessions
  DROP CONSTRAINT IF EXISTS workspace_verify_sessions_session_shell_check;
ALTER TABLE public.workspace_verify_sessions
  ADD CONSTRAINT workspace_verify_sessions_session_shell_check
  CHECK (session_shell IS NULL OR session_shell IN ('dialog', 'solo'));

ALTER TABLE public.workspace_calibrate_sessions
  DROP CONSTRAINT IF EXISTS workspace_tap_sessions_interaction_kind_check;
ALTER TABLE public.workspace_calibrate_sessions
  DROP CONSTRAINT IF EXISTS workspace_verify_sessions_interaction_kind_check;
ALTER TABLE public.workspace_calibrate_sessions
  DROP CONSTRAINT IF EXISTS workspace_calibrate_sessions_interaction_kind_check;
ALTER TABLE public.workspace_calibrate_sessions
  ADD CONSTRAINT workspace_calibrate_sessions_interaction_kind_check
  CHECK (interaction_kind IN ('calibrate'));

ALTER TABLE public.workspace_calibrate_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own workspace Calibrate sessions" ON public.workspace_calibrate_sessions;
CREATE POLICY "Users can read own workspace Calibrate sessions"
  ON public.workspace_calibrate_sessions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own workspace Calibrate sessions" ON public.workspace_calibrate_sessions;
CREATE POLICY "Users can insert own workspace Calibrate sessions"
  ON public.workspace_calibrate_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own workspace Calibrate sessions" ON public.workspace_calibrate_sessions;
CREATE POLICY "Users can update own workspace Calibrate sessions"
  ON public.workspace_calibrate_sessions FOR UPDATE
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.workspace_calibrate_sessions IS
  'Guest/owner Calibrate sessions (formerly TAP interaction_kind=scout).';
COMMENT ON TABLE public.workspace_verify_sessions IS
  'Guest/owner Verify sessions (formerly TAP conversational/exercise).';

-- ── 2. Rename Learn links ───────────────────────────────────────────────────

ALTER TABLE IF EXISTS public.workspace_ile_links
  RENAME TO workspace_learn_links;

ALTER INDEX IF EXISTS workspace_ile_links_pkey
  RENAME TO workspace_learn_links_pkey;
ALTER INDEX IF EXISTS workspace_ile_links_private_token_hash_key
  RENAME TO workspace_learn_links_private_token_hash_key;
ALTER INDEX IF EXISTS idx_workspace_ile_links_workspace
  RENAME TO idx_workspace_learn_links_workspace;
ALTER INDEX IF EXISTS idx_workspace_ile_links_guest
  RENAME TO idx_workspace_learn_links_guest;
ALTER INDEX IF EXISTS idx_workspace_ile_links_assigned
  RENAME TO idx_workspace_learn_links_assigned;
ALTER INDEX IF EXISTS workspace_ile_links_public_token_key
  RENAME TO workspace_learn_links_public_token_key;
ALTER INDEX IF EXISTS idx_workspace_ile_links_access_mode
  RENAME TO idx_workspace_learn_links_access_mode;

ALTER TABLE public.workspace_learn_links
  DROP CONSTRAINT IF EXISTS workspace_ile_links_session_mode_check;
ALTER TABLE public.workspace_learn_links
  DROP CONSTRAINT IF EXISTS workspace_learn_links_session_mode_check;

UPDATE public.workspace_learn_links
SET session_mode = CASE
  WHEN session_mode IN ('project', 'solo', 'exercise') THEN 'solo'
  ELSE 'dialog'
END
WHERE session_mode IS DISTINCT FROM 'dialog' AND session_mode IS DISTINCT FROM 'solo';

ALTER TABLE public.workspace_learn_links
  ALTER COLUMN session_mode SET DEFAULT 'dialog';

ALTER TABLE public.workspace_learn_links
  ADD CONSTRAINT workspace_learn_links_session_mode_check
  CHECK (session_mode IN ('dialog', 'solo'));

COMMENT ON TABLE public.workspace_learn_links IS
  'Guest Learn session links (formerly workspace_ile_links).';

-- ── 3. Practice options: add new keys, keep old keys ────────────────────────

UPDATE public.blocks
SET practice_options = COALESCE(practice_options, '{}'::jsonb)
  || jsonb_build_object(
    'allow_calibrate', COALESCE(practice_options->'allow_calibrate', practice_options->'allow_scout', 'true'::jsonb),
    'allow_learn', COALESCE(practice_options->'allow_learn', practice_options->'allow_explore', 'true'::jsonb),
    'allow_verify', COALESCE(practice_options->'allow_verify', 'true'::jsonb)
  )
WHERE practice_options IS NOT NULL;

-- ── 4. API scopes: union sessions:* with tap:* ──────────────────────────────

UPDATE public.agent_api_keys
SET scopes = ARRAY(
  SELECT DISTINCT v FROM (
    SELECT s AS v FROM unnest(scopes) s
    UNION ALL
    SELECT CASE s
      WHEN 'tap:read' THEN 'sessions:read'
      WHEN 'tap:write' THEN 'sessions:write'
      ELSE NULL
    END
    FROM unnest(scopes) s
    WHERE s IN ('tap:read', 'tap:write')
  ) q
  WHERE v IS NOT NULL
)
WHERE scopes IS NOT NULL
  AND (scopes @> ARRAY['tap:read'] OR scopes @> ARRAY['tap:write']);

UPDATE public.mcp_oauth_tokens
SET scopes = ARRAY(
  SELECT DISTINCT v FROM (
    SELECT s AS v FROM unnest(scopes) s
    UNION ALL
    SELECT CASE s
      WHEN 'tap:read' THEN 'sessions:read'
      WHEN 'tap:write' THEN 'sessions:write'
      ELSE NULL
    END
    FROM unnest(scopes) s
    WHERE s IN ('tap:read', 'tap:write')
  ) q
  WHERE v IS NOT NULL
)
WHERE scopes IS NOT NULL
  AND (scopes @> ARRAY['tap:read'] OR scopes @> ARRAY['tap:write']);

UPDATE public.mcp_oauth_authorization_codes
SET scopes = ARRAY(
  SELECT DISTINCT v FROM (
    SELECT s AS v FROM unnest(scopes) s
    UNION ALL
    SELECT CASE s
      WHEN 'tap:read' THEN 'sessions:read'
      WHEN 'tap:write' THEN 'sessions:write'
      ELSE NULL
    END
    FROM unnest(scopes) s
    WHERE s IN ('tap:read', 'tap:write')
  ) q
  WHERE v IS NOT NULL
)
WHERE scopes IS NOT NULL
  AND (scopes @> ARRAY['tap:read'] OR scopes @> ARRAY['tap:write']);

-- ── 5. PoW tool_name / trace_type / tool_action / source_link_kind ──────────

UPDATE public.workspace_proof_of_work
SET tool_name = CASE tool_name
  WHEN 'tap-thought-trace' THEN 'thought-trace'
  WHEN 'ile-thought-trace' THEN 'thought-trace'
  WHEN 'tap-speech-segment' THEN 'speech-segment'
  WHEN 'ile-speech-segment' THEN 'speech-segment'
  WHEN 'tap-idle-heartbeat' THEN 'idle-heartbeat'
  WHEN 'ile-idle-heartbeat' THEN 'idle-heartbeat'
  WHEN 'ile-tab-unfocus' THEN 'tab-unfocus'
  WHEN 'ile-helios-chat' THEN 'learn-chat'
  WHEN 'tap-helios-chat' THEN 'session-chat'
  WHEN 'tap-transcript' THEN 'transcript'
  ELSE tool_name
END
WHERE tool_name IN (
  'tap-thought-trace', 'ile-thought-trace',
  'tap-speech-segment', 'ile-speech-segment',
  'tap-idle-heartbeat', 'ile-idle-heartbeat',
  'ile-tab-unfocus', 'ile-helios-chat', 'tap-helios-chat', 'tap-transcript'
);

UPDATE public.workspace_proof_of_work
SET tool_action = CASE
  WHEN tool_action LIKE 'system1:%' THEN 'observation:' || substr(tool_action, 9)
  WHEN tool_action LIKE 'system2:%' THEN 'action:' || substr(tool_action, 9)
  ELSE tool_action
END
WHERE tool_action LIKE 'system1:%' OR tool_action LIKE 'system2:%';

UPDATE public.workspace_proof_of_work
SET metadata = jsonb_set(metadata, '{trace_type}', to_jsonb(
  CASE metadata->>'trace_type'
    WHEN 'system1' THEN 'observation'
    WHEN 'system2' THEN 'action'
    ELSE metadata->>'trace_type'
  END
))
WHERE metadata ? 'trace_type'
  AND metadata->>'trace_type' IN ('system1', 'system2');

UPDATE public.workspace_proof_of_work
SET metadata = jsonb_set(metadata, '{source_link_kind}', to_jsonb(
  CASE metadata->>'source_link_kind'
    WHEN 'tap' THEN 'verify'
    WHEN 'ile' THEN 'learn'
    ELSE metadata->>'source_link_kind'
  END
))
WHERE metadata ? 'source_link_kind'
  AND metadata->>'source_link_kind' IN ('tap', 'ile');

UPDATE public.workspace_proof_of_work
SET metadata = jsonb_set(metadata, '{type}', to_jsonb(
  CASE metadata->>'type'
    WHEN 'uncertain_systems_tap_thought_trace' THEN 'uncertain_systems_thought_trace'
    WHEN 'uncertain_systems_ile_thought_trace' THEN 'uncertain_systems_thought_trace'
    WHEN 'uncertain_systems_ile_chat_exchange' THEN 'uncertain_systems_learn_chat'
    WHEN 'uncertain_systems_tap_transcript' THEN 'uncertain_systems_transcript'
    ELSE metadata->>'type'
  END
))
WHERE metadata ? 'type'
  AND metadata->>'type' IN (
    'uncertain_systems_tap_thought_trace',
    'uncertain_systems_ile_thought_trace',
    'uncertain_systems_ile_chat_exchange',
    'uncertain_systems_tap_transcript'
  );

UPDATE public.workspace_proof_of_work
SET metadata = jsonb_set(metadata, '{tim_source}', '"upload_learn_chapter_done"'::jsonb)
WHERE metadata ? 'tim_source'
  AND metadata->>'tim_source' = 'upload_ile_chapter_done';

-- ── 6. Drop unused TAPBench / portal / teach-back tables ────────────────────

DO $$
DECLARE
  n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.tapbench_key_guests;
  RAISE NOTICE 'drop tapbench_key_guests count=%', n;
  SELECT count(*) INTO n FROM public.tapbench_runs;
  RAISE NOTICE 'drop tapbench_runs count=%', n;
  SELECT count(*) INTO n FROM public.tapbench_task_keys;
  RAISE NOTICE 'drop tapbench_task_keys count=%', n;
  SELECT count(*) INTO n FROM public.workspace_tapbench_links;
  RAISE NOTICE 'drop workspace_tapbench_links count=%', n;
  SELECT count(*) INTO n FROM public.workspace_practice_portals;
  RAISE NOTICE 'drop workspace_practice_portals count=%', n;
  SELECT count(*) INTO n FROM public.workspace_teach_backs;
  RAISE NOTICE 'drop workspace_teach_backs count=%', n;
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'unused-table count skipped (missing table)';
END $$;

DROP TABLE IF EXISTS public.tapbench_key_guests;
DROP TABLE IF EXISTS public.tapbench_runs;
DROP TABLE IF EXISTS public.tapbench_task_keys;
DROP TABLE IF EXISTS public.workspace_tapbench_links;
DROP TABLE IF EXISTS public.workspace_practice_portals;
DROP TABLE IF EXISTS public.workspace_teach_backs;

NOTIFY pgrst, 'reload schema';
