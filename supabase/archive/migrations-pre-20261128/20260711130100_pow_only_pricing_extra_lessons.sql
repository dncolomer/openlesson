-- PoW-only pricing (Jul 2026): profiles.extra_lessons now stores extra Proof-of-Work
-- submissions above the plan base, not extra TAP/ILE sessions.
-- Convert existing session-based extras to PoW units (4 submissions per legacy session).
UPDATE public.profiles
SET extra_lessons = extra_lessons * 4
WHERE extra_lessons > 0
  AND subscription_status = 'active'
  AND plan IN ('free', 'regular', 'regular_2026', 'pro_teams');