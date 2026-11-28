-- profiles RLS was enabled but "Admins can view all profiles" subqueries profiles,
-- causing infinite recursion. Use the existing SECURITY DEFINER helper instead.

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "Admins can view all profiles"
  ON public.profiles
  FOR SELECT
  USING (public.is_admin_user());