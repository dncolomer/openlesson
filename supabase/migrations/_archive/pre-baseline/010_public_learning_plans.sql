-- Add public/community learning plans features
ALTER TABLE learning_plans 
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS author_id UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS remix_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS original_plan_id UUID REFERENCES learning_plans(id);

-- Enable RLS on learning_plans if not already enabled
ALTER TABLE learning_plans ENABLE ROW LEVEL SECURITY;

-- Users can read their own plans
DROP POLICY IF EXISTS "Users can view own plans" ON learning_plans;
CREATE POLICY "Users can view own plans" ON learning_plans FOR SELECT USING (user_id = auth.uid());

-- Users can update their own plans
DROP POLICY IF EXISTS "Users can update own plans" ON learning_plans;
CREATE POLICY "Users can update own plans" ON learning_plans FOR UPDATE USING (user_id = auth.uid());

-- Add RLS policy to allow reading public plans
DROP POLICY IF EXISTS "Anyone can view public learning plans" ON learning_plans;
CREATE POLICY "Anyone can view public learning plans" ON learning_plans FOR SELECT USING (is_public = true);
