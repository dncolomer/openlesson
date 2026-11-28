-- Flow authoring is name + one Problem (topic) + optional xAI file artifacts.
-- Verification and Calibration drop the multi-question authoring contract:
-- the stored topic becomes the first pooled question (Calibration: else goal).

alter table public.solve_flows
  add column if not exists artifacts jsonb not null default '[]'::jsonb;

alter table public.verify_flows
  add column if not exists artifacts jsonb not null default '[]'::jsonb;

alter table public.calibrate_flows
  add column if not exists artifacts jsonb not null default '[]'::jsonb;

alter table public.calibrate_flows
  add column if not exists topic text not null default '';

comment on column public.solve_flows.artifacts is
  'xAI Files pointers linked to this flow: [{ name, mimeType, xaiFileId }].';
comment on column public.verify_flows.artifacts is
  'xAI Files pointers linked to this flow: [{ name, mimeType, xaiFileId }].';
comment on column public.calibrate_flows.artifacts is
  'xAI Files pointers linked to this flow: [{ name, mimeType, xaiFileId }].';
comment on column public.calibrate_flows.topic is
  'Problem text. Same field as goal; UI label is Problem.';

update public.verify_flows as f
set
  topic = v.problem,
  questions = jsonb_build_array(
    jsonb_build_object('id', 'q-1', 'text', v.problem)
  )
from (
  select
    id,
    coalesce(
      nullif(btrim(coalesce(questions -> 0 ->> 'text', questions ->> 0)), ''),
      nullif(btrim(topic), ''),
      ''
    ) as problem
  from public.verify_flows
) as v
where f.id = v.id
  and v.problem <> '';

update public.calibrate_flows as f
set
  topic = v.problem,
  goal = v.problem,
  questions = jsonb_build_array(
    jsonb_build_object('id', 'q-1', 'text', v.problem)
  )
from (
  select
    id,
    coalesce(
      nullif(btrim(coalesce(questions -> 0 ->> 'text', questions ->> 0)), ''),
      nullif(btrim(goal), ''),
      nullif(btrim(topic), ''),
      ''
    ) as problem
  from public.calibrate_flows
) as v
where f.id = v.id
  and v.problem <> '';
