-- Collapse product plans to inactive | trial | api_metered.
-- Migrate removed paid tiers (Individual / Pro-Teams / legacy regular|pro) → api_metered.
-- Trial and inactive are unchanged. Does not touch Stripe remote subscriptions.

-- Organizations: any non-trial paid / legacy plan → sole remaining paid tier
UPDATE public.organizations
SET
  plan = 'api_metered',
  extra_lessons = 0
WHERE plan IN ('regular_2026', 'pro_teams', 'regular', 'pro');

-- Profiles: same rewrite for any residual personal plan column writes
UPDATE public.profiles
SET
  plan = 'api_metered',
  extra_lessons = 0
WHERE plan IN ('regular_2026', 'pro_teams', 'regular', 'pro');
