-- Add extra_lessons column to profiles (if not already exists)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS extra_lessons INTEGER DEFAULT 0;

-- Create function to safely add extra lessons to a user
CREATE OR REPLACE FUNCTION add_user_credits(p_user_id UUID, p_lessons INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles
  SET extra_lessons = COALESCE(extra_lessons, 0) + p_lessons
  WHERE id = p_user_id;
END;
$$;