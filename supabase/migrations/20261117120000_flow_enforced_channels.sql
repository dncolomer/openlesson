-- Author-chosen channels a product-flow run requires (Audio, Muse, Video,
-- Screenshots). Null keeps the previous think-aloud default (Audio on).

alter table public.solve_flows
  add column if not exists enforced_channels jsonb;

alter table public.verify_flows
  add column if not exists enforced_channels jsonb;

alter table public.calibrate_flows
  add column if not exists enforced_channels jsonb;

comment on column public.solve_flows.enforced_channels is
  'Channels this Solve run requires: audio, muse, video, screenshots. Null means Audio on.';

comment on column public.verify_flows.enforced_channels is
  'Channels this Verification run requires: audio, muse, video, screenshots. Null means Audio on.';

comment on column public.calibrate_flows.enforced_channels is
  'Channels this Calibration run requires: audio, muse, video, screenshots. Null means Audio on.';
