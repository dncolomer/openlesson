CREATE TABLE IF NOT EXISTS insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES learning_plans(id) ON DELETE SET NULL,
  plan_node_id UUID,
  session_id UUID,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  thought_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_thoughts JSONB NOT NULL DEFAULT '[]'::jsonb,
  share_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  is_public BOOLEAN NOT NULL DEFAULT true,
  aesthetic_image TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS insights_user_id_idx ON insights(user_id);
CREATE INDEX IF NOT EXISTS insights_plan_id_idx ON insights(plan_id);
CREATE INDEX IF NOT EXISTS insights_share_token_idx ON insights(share_token);

ALTER TABLE insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY insights_owner_all ON insights
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY insights_public_read ON insights
  FOR SELECT
  USING (is_public = true);