-- TAPBench key session stop (agent POST .../stop).
ALTER TABLE public.tapbench_task_keys
  ADD COLUMN IF NOT EXISTS stopped_at timestamptz;

COMMENT ON COLUMN public.tapbench_task_keys.stopped_at IS
  'When the agent stopped this TAPBench key session. Further Stash/Submit with this key is rejected.';
