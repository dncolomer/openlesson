-- Solve / Calibrate / Verify cookie and public runs persist PoW without a map workspace.
alter table public.proof_of_work
  alter column workspace_id drop not null;
