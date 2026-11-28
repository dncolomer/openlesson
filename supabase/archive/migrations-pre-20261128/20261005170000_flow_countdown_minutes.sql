-- Countdown chosen when a calibration or verification flow is created.

alter table public.workspace_calibration_flows
  add column if not exists duration_minutes integer not null default 15;

alter table public.workspace_verification_flows
  add column if not exists duration_minutes integer not null default 15;
