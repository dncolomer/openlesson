-- Staging seed data (safe fixtures only — no production PII).
-- Applied after migrations on empty staging branches.

INSERT INTO public.organizations (id, name, slug, created_at)
VALUES (
  '00000000-0000-4000-8000-000000000001',
  'Staging Organization',
  'staging-org',
  NOW()
)
ON CONFLICT (id) DO NOTHING;