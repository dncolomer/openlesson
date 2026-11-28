-- ============================================
-- AGENT API KEYS (for agentic mode)
-- ============================================

CREATE TABLE IF NOT EXISTS agent_api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  label TEXT,
  rate_limit INTEGER DEFAULT 100,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

CREATE INDEX idx_agent_api_keys_user_id ON agent_api_keys(user_id);
CREATE INDEX idx_agent_api_keys_key_hash ON agent_api_keys(key_hash);
CREATE INDEX idx_agent_api_keys_key_prefix ON agent_api_keys(key_prefix);

-- Add agent session tracking to sessions table
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS is_agent_session BOOLEAN DEFAULT false;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS agent_api_key_id UUID REFERENCES agent_api_keys(id);

-- Add payment tracking to learning_plans
ALTER TABLE learning_plans ADD COLUMN IF NOT EXISTS is_agent_session BOOLEAN DEFAULT false;
ALTER TABLE learning_plans ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed'));

-- RLS for Agent API Keys
ALTER TABLE agent_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own agent api keys"
  ON agent_api_keys FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own agent api keys"
  ON agent_api_keys FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own agent api keys"
  ON agent_api_keys FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own agent api keys"
  ON agent_api_keys FOR DELETE USING (auth.uid() = user_id);

-- Allow agent endpoints to read agent_api_keys (no RLS for programmatic access)
DROP POLICY IF EXISTS "Agent endpoints can read agent api keys" ON agent_api_keys;
