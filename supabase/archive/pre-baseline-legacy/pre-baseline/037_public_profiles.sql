-- Public learning profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS display_name TEXT,
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS profile_visibility TEXT DEFAULT 'private'
  CHECK (profile_visibility IN ('public', 'private')),
ADD COLUMN IF NOT EXISTS public_activity_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS public_stats_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS public_session_titles_enabled BOOLEAN DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username_unique
ON profiles (lower(username))
WHERE username IS NOT NULL AND username <> '';

CREATE INDEX IF NOT EXISTS idx_profiles_public_username
ON profiles (lower(username))
WHERE profile_visibility = 'public';

DROP POLICY IF EXISTS "Anyone can view public profiles" ON profiles;
CREATE POLICY "Anyone can view public profiles"
  ON profiles FOR SELECT
  USING (profile_visibility = 'public');

CREATE OR REPLACE FUNCTION get_public_profile_session_summary(profile_username TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_profile profiles%ROWTYPE;
  completed_count INTEGER := 0;
  learning_minutes INTEGER := 0;
  recent_activity JSONB := '[]'::jsonb;
  daily_minutes JSONB := '[]'::jsonb;
BEGIN
  SELECT * INTO target_profile
  FROM profiles
  WHERE lower(username) = lower(profile_username)
    AND profile_visibility = 'public'
  LIMIT 1;

  IF target_profile.id IS NULL THEN
    RETURN jsonb_build_object(
      'completed_sessions', NULL,
      'learning_minutes', NULL,
      'activity', '[]'::jsonb,
      'daily_minutes', '[]'::jsonb
    );
  END IF;

  IF target_profile.public_stats_enabled THEN
    SELECT COUNT(*), COALESCE(ROUND(SUM(COALESCE(duration_ms, 0)) / 60000.0), 0)::INTEGER
    INTO completed_count, learning_minutes
    FROM sessions
    WHERE user_id = target_profile.id
      AND status IN ('completed', 'ended_by_tutor');
  END IF;

  IF target_profile.public_activity_enabled THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', id,
      'type', 'session_completed',
      'title', CASE
        WHEN target_profile.public_session_titles_enabled THEN problem
        ELSE 'Completed a learning session'
      END,
      'occurred_at', COALESCE(ended_at, created_at)
    ) ORDER BY COALESCE(ended_at, created_at) DESC), '[]'::jsonb)
    INTO recent_activity
    FROM (
      SELECT id, problem, ended_at, created_at
      FROM sessions
      WHERE user_id = target_profile.id
        AND status IN ('completed', 'ended_by_tutor')
      ORDER BY COALESCE(ended_at, created_at) DESC
      LIMIT 6
    ) recent_sessions;
  END IF;

  IF target_profile.public_stats_enabled THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'date', activity_date,
      'minutes', minutes
    ) ORDER BY activity_date), '[]'::jsonb)
    INTO daily_minutes
    FROM (
      SELECT
        COALESCE(ended_at, created_at)::date AS activity_date,
        COALESCE(ROUND(SUM(COALESCE(duration_ms, 0)) / 60000.0), 0)::INTEGER AS minutes
      FROM sessions
      WHERE user_id = target_profile.id
        AND status IN ('completed', 'ended_by_tutor')
        AND COALESCE(ended_at, created_at) >= CURRENT_DATE - INTERVAL '364 days'
      GROUP BY COALESCE(ended_at, created_at)::date
    ) daily_sessions;
  END IF;

  RETURN jsonb_build_object(
    'completed_sessions', CASE WHEN target_profile.public_stats_enabled THEN completed_count ELSE NULL END,
    'learning_minutes', CASE WHEN target_profile.public_stats_enabled THEN learning_minutes ELSE NULL END,
    'activity', recent_activity,
    'daily_minutes', daily_minutes
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_public_profile_session_summary(TEXT) TO anon, authenticated;
