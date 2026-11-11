-- Drop the Browse Problems catalog and the Solve-flow tag that pointed at it.
-- Existing catalog-minted Solve flows remain as ordinary owner Solve flows.

drop index if exists public.solve_flows_owner_practice_problem_uidx;

alter table public.solve_flows
  drop constraint if exists solve_flows_practice_problem_id_fkey;

alter table public.solve_flows
  drop column if exists practice_problem_id;

drop policy if exists "Authenticated users can read published practice problems"
  on public.practice_problems;

drop table if exists public.practice_problems;
