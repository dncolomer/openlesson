-- Author-prepared Work canvas (elements, appState, files) shown to learners
-- when the flow opens. Calibration has no Work canvas.

alter table public.solve_flows
  add column if not exists opening_canvas_scene jsonb;

alter table public.verify_flows
  add column if not exists opening_canvas_scene jsonb;

comment on column public.solve_flows.opening_canvas_scene is
  'Serialized Work canvas scene used as the learner opening board.';

comment on column public.verify_flows.opening_canvas_scene is
  'Serialized Work canvas scene used as the learner opening board.';
