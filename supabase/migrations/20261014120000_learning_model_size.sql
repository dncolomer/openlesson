-- Learning model granularity: 4, 8, or 16 actions.
-- Learning workspaces store it on the workspace. Verification/calibration flows store it per flow.

alter table public.workspaces
  add column if not exists learning_model_size integer not null default 4;

alter table public.workspace_verification_flows
  add column if not exists action_catalog integer not null default 4;

alter table public.workspace_calibration_flows
  add column if not exists action_catalog integer not null default 4;
