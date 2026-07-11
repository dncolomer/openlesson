-- Workspace volume allowance (above plan base) from pricing tier checkout
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS extra_workspaces INTEGER NOT NULL DEFAULT 0;