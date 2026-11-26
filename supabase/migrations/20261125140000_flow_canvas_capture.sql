-- Optional mermaid documents of the Work canvas, stored as BlobStore documents.
-- Default (null) is off. Calibration has no Work canvas.

alter table public.solve_flows
  add column if not exists canvas_capture jsonb;

alter table public.verify_flows
  add column if not exists canvas_capture jsonb;

comment on column public.solve_flows.canvas_capture is
  'Optional { enabled, everyActions }. When enabled, store a mermaid document of the Work canvas every N actions. Default off. Never embedded.';

comment on column public.verify_flows.canvas_capture is
  'Optional { enabled, everyActions }. When enabled, store a mermaid document of the Work canvas every N actions. Default off. Never embedded.';
