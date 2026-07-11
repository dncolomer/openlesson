-- ============================================
-- PRICING & STRIPE COLUMNS
-- Run this in the Supabase SQL Editor
-- ============================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'inactive',
  ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS extra_lessons INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- Flag the admin user
UPDATE public.profiles
SET is_admin = true, plan = 'pro'
WHERE id = (SELECT id FROM auth.users WHERE email = 'uncertainsystems@gmail.com');
