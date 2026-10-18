-- First-class flow display names, independent of topic/goal.
alter table public.workspace_verification_flows
  add column if not exists name text;

alter table public.workspace_calibration_flows
  add column if not exists name text;
