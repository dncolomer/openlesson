-- PR 4: drop Rabbit Hole game, marketing leads, and map-ready notify.
-- Expand-block (`lib/rabbit-hole-expand.ts`) and Calibrate sounding "rabbit-hole"
-- tap rules are a different concept and stay.

drop table if exists public.rabbit_hole_plays cascade;
drop table if exists public.rabbit_hole_nodes cascade;
drop table if exists public.rabbit_hole_top_questions cascade;
drop table if exists public.map_ready_notify_requests cascade;
drop table if exists public.leads cascade;

alter table public.profiles
  drop column if exists rabbit_hole_bonus_plays;

alter table public.profiles
  drop column if exists rabbit_hole_bonus_points;

-- Privilege trigger still referenced the bonus columns.
create or replace function public.prevent_privilege_escalation()
returns trigger
language plpgsql
as $$
begin
  if not public.is_admin_user() then
    if new.is_admin is distinct from old.is_admin then
      raise exception 'Cannot modify is_admin';
    end if;
    if new.plan is distinct from old.plan then
      raise exception 'Cannot modify plan';
    end if;
    if new.subscription_status is distinct from old.subscription_status then
      raise exception 'Cannot modify subscription_status';
    end if;
    if new.current_period_end is distinct from old.current_period_end then
      raise exception 'Cannot modify current_period_end';
    end if;
    if new.stripe_customer_id is distinct from old.stripe_customer_id then
      raise exception 'Cannot modify stripe_customer_id';
    end if;
    if new.stripe_subscription_id is distinct from old.stripe_subscription_id then
      raise exception 'Cannot modify stripe_subscription_id';
    end if;
    if new.extra_lessons is distinct from old.extra_lessons then
      raise exception 'Cannot modify extra_lessons';
    end if;
    if new.extra_workspaces is distinct from old.extra_workspaces then
      raise exception 'Cannot modify extra_workspaces';
    end if;
    if new.token_tier is distinct from old.token_tier then
      raise exception 'Cannot modify token_tier';
    end if;
    if new.token_validated_at is distinct from old.token_validated_at then
      raise exception 'Cannot modify token_validated_at';
    end if;
    if new.token_validity_expires_at is distinct from old.token_validity_expires_at then
      raise exception 'Cannot modify token_validity_expires_at';
    end if;
  end if;
  return new;
end;
$$;
