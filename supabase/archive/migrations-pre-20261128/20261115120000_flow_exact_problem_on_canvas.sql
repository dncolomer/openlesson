-- Author option: put the flow Problem on the Work canvas as written.
-- Calibration has no Work canvas.

alter table public.solve_flows
  add column if not exists exact_problem_on_canvas boolean not null default false;

alter table public.verify_flows
  add column if not exists exact_problem_on_canvas boolean not null default false;

comment on column public.solve_flows.exact_problem_on_canvas is
  'When true, the session Work canvas opens with the flow Problem as written.';

comment on column public.verify_flows.exact_problem_on_canvas is
  'When true, the session Work canvas opens with the flow Problem as written.';
