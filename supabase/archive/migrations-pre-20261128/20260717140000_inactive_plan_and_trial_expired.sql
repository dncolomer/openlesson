-- Replace free/legacy plans with inactive; mark expired trials for email targeting.
-- Allowed plans: inactive | trial | regular_2026 | pro_teams | api_metered
-- Notable statuses: active | inactive | trial_expired | canceled | past_due | …

-- 1) Soft-expired trials → inactive + trial_expired (email cohort)
UPDATE public.profiles
SET
  plan = 'inactive',
  subscription_status = 'trial_expired'
WHERE plan = 'trial'
  AND current_period_end IS NOT NULL
  AND current_period_end <= now();

-- 2) Free + legacy Individual/Pro → inactive (ends grandfathered access)
UPDATE public.profiles
SET
  plan = 'inactive',
  subscription_status = CASE
    WHEN subscription_status IN ('canceled', 'past_due', 'unpaid', 'trial_expired')
      THEN subscription_status
    ELSE 'inactive'
  END,
  extra_lessons = 0,
  extra_workspaces = 0,
  current_period_end = NULL
WHERE plan IN ('free', 'regular', 'pro');

-- 3) New signups default to inactive (no freemium plan id)
ALTER TABLE public.profiles
  ALTER COLUMN plan SET DEFAULT 'inactive';
