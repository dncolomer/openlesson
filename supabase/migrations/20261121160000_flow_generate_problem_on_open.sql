-- Author option: generate the Problem from attached artifacts when a learner opens.
-- Optional-column writes survive until this is applied.

alter table public.solve_flows
  add column if not exists generate_problem_on_open boolean not null default false;

alter table public.verify_flows
  add column if not exists generate_problem_on_open boolean not null default false;

alter table public.calibrate_flows
  add column if not exists generate_problem_on_open boolean not null default false;

comment on column public.solve_flows.generate_problem_on_open is
  'When true, a learner open writes the Problem from attached artifacts.';

comment on column public.verify_flows.generate_problem_on_open is
  'When true, a learner open writes the Problem from attached artifacts.';

comment on column public.calibrate_flows.generate_problem_on_open is
  'When true, a learner open writes the Problem from attached artifacts.';
