-- Public user profiles are no longer shown in the app.

DROP FUNCTION IF EXISTS public.get_public_profile_session_summary(text);

DROP POLICY IF EXISTS "Anyone can view public profiles" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view all usernames" ON public.profiles;

DROP INDEX IF EXISTS public.idx_profiles_public_username;
DROP INDEX IF EXISTS public.idx_profiles_public_username_unique;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_profile_visibility_check,
  DROP COLUMN IF EXISTS display_name,
  DROP COLUMN IF EXISTS bio,
  DROP COLUMN IF EXISTS avatar_url,
  DROP COLUMN IF EXISTS profile_visibility,
  DROP COLUMN IF EXISTS public_activity_enabled,
  DROP COLUMN IF EXISTS public_stats_enabled,
  DROP COLUMN IF EXISTS public_session_titles_enabled;