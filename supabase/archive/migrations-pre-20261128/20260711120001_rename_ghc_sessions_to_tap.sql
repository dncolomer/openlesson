-- Rename legacy GHC session table to TAP terminology.

ALTER TABLE IF EXISTS public.workspace_ghc_sessions
  RENAME TO workspace_tap_sessions;

ALTER INDEX IF EXISTS workspace_ghc_sessions_pkey
  RENAME TO workspace_tap_sessions_pkey;

ALTER INDEX IF EXISTS workspace_ghc_sessions_private_token_hash_key
  RENAME TO workspace_tap_sessions_private_token_hash_key;

ALTER INDEX IF EXISTS workspace_ghc_sessions_plan_user_idx
  RENAME TO workspace_tap_sessions_workspace_user_idx;

ALTER INDEX IF EXISTS workspace_ghc_sessions_token_hash_idx
  RENAME TO workspace_tap_sessions_token_hash_idx;

ALTER INDEX IF EXISTS workspace_ghc_sessions_api_key_idx
  RENAME TO workspace_tap_sessions_api_key_idx;

ALTER INDEX IF EXISTS workspace_ghc_sessions_session_idx
  RENAME TO workspace_tap_sessions_session_idx;

ALTER INDEX IF EXISTS workspace_ghc_sessions_block_idx
  RENAME TO workspace_tap_sessions_block_idx;

ALTER INDEX IF EXISTS idx_workspace_ghc_sessions_guest
  RENAME TO idx_workspace_tap_sessions_guest;

ALTER INDEX IF EXISTS idx_workspace_ghc_sessions_org
  RENAME TO idx_workspace_tap_sessions_org;

ALTER POLICY "Users can read own workspace GHC sessions"
  ON public.workspace_tap_sessions
  RENAME TO "Users can read own workspace TAP sessions";

ALTER POLICY "Users can insert own workspace GHC sessions"
  ON public.workspace_tap_sessions
  RENAME TO "Users can insert own workspace TAP sessions";

ALTER POLICY "Users can update own workspace GHC sessions"
  ON public.workspace_tap_sessions
  RENAME TO "Users can update own workspace TAP sessions";