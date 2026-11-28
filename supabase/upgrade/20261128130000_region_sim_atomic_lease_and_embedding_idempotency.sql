-- Atomic lease acquisition for region_simulation_jobs and idempotency
-- unique index on session_embeddings (owner_user_id, run_id).
BEGIN;

CREATE OR REPLACE FUNCTION public.acquire_region_simulation_job_lease(
  p_job_id uuid,
  p_lease_owner text,
  p_lease_ms integer DEFAULT 65000
) RETURNS SETOF public.region_simulation_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.region_simulation_jobs
  SET
    status = 'running',
    lease_owner = p_lease_owner,
    lease_until = now() + make_interval(secs => GREATEST(1, COALESCE(p_lease_ms, 65000)) / 1000.0),
    updated_at = now()
  WHERE id = p_job_id
    AND status IN ('queued', 'running')
    AND (lease_until IS NULL OR lease_until < now() OR lease_owner = p_lease_owner)
  RETURNING *;
END;
$$;

REVOKE ALL ON FUNCTION public.acquire_region_simulation_job_lease(uuid, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.acquire_region_simulation_job_lease(uuid, text, integer) FROM anon;
REVOKE ALL ON FUNCTION public.acquire_region_simulation_job_lease(uuid, text, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_region_simulation_job_lease(uuid, text, integer) TO service_role;

-- Deduplicate any historical (owner_user_id, run_id) duplicates before adding the unique index.
DELETE FROM public.session_embeddings a
USING public.session_embeddings b
WHERE a.owner_user_id IS NOT NULL
  AND a.run_id IS NOT NULL
  AND a.run_id <> ''
  AND a.owner_user_id = b.owner_user_id
  AND a.run_id = b.run_id
  AND (
    a.created_at < b.created_at
    OR (a.created_at = b.created_at AND a.id::text < b.id::text)
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_session_embeddings_owner_run_uidx
  ON public.session_embeddings USING btree (owner_user_id, run_id)
  WHERE (owner_user_id IS NOT NULL AND run_id IS NOT NULL AND run_id <> '');

COMMIT;
