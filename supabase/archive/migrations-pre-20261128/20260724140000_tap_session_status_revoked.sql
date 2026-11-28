-- Allow TAP guest share links to be invalidated (status = revoked).
-- Constraint may still use the pre-rename name from workspace_ghc_sessions.

alter table public.workspace_tap_sessions
  drop constraint if exists workspace_tap_sessions_status_check;

alter table public.workspace_tap_sessions
  drop constraint if exists workspace_ghc_sessions_status_check;

alter table public.workspace_tap_sessions
  add constraint workspace_tap_sessions_status_check
  check (
    status = any (
      array[
        'pending'::text,
        'in_progress'::text,
        'completed'::text,
        'revoked'::text
      ]
    )
  );
