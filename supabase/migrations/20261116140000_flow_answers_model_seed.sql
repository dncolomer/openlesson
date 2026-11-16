-- Author Unsys seed on product flows. Session prepare prefers this over a
-- linked map-tile seed, then falls back to generate-on-the-fly.

alter table public.solve_flows
  add column if not exists answers_model_seed jsonb;

alter table public.verify_flows
  add column if not exists answers_model_seed jsonb;

alter table public.calibrate_flows
  add column if not exists answers_model_seed jsonb;

comment on column public.solve_flows.answers_model_seed is
  'Author unsys hidden-state seed used for this Solve flow. Null generates on the fly.';

comment on column public.verify_flows.answers_model_seed is
  'Author unsys hidden-state seed used for this Verification flow. Null generates on the fly.';

comment on column public.calibrate_flows.answers_model_seed is
  'Author unsys hidden-state seed used for this Calibration flow. Null generates on the fly.';
