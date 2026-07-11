-- ============================================
-- OpenLesson Agentic API v2 - Database Migration
-- ============================================

-- 1. Enhance agent_api_keys with scopes and expiration
ALTER TABLE agent_api_keys
ADD COLUMN IF NOT EXISTS scopes TEXT[] DEFAULT ARRAY['*'],
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_agent_api_keys_expires
ON agent_api_keys(expires_at)
WHERE expires_at IS NOT NULL;

-- 2. Cryptographic proofs table
CREATE TABLE IF NOT EXISTS agent_proofs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN (
    'plan_created', 'plan_adapted',
    'session_started', 'session_paused', 'session_resumed',
    'session_ended', 'analysis_heartbeat', 'assistant_query',
    'session_batch'
  )),
  fingerprint TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,

  -- Related entities
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  plan_id UUID REFERENCES learning_plans(id) ON DELETE SET NULL,

  -- Chain linking
  previous_proof_id UUID REFERENCES agent_proofs(id),

  -- Content hashes
  input_hash TEXT,
  output_hash TEXT,
  data_hash TEXT NOT NULL,

  -- Full proof data for verification
  data JSONB,

  -- Anchoring
  anchored BOOLEAN DEFAULT false,
  anchor_tx_signature TEXT,
  anchor_slot BIGINT,
  anchor_timestamp TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_proofs_user ON agent_proofs(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_proofs_session ON agent_proofs(session_id);
CREATE INDEX IF NOT EXISTS idx_agent_proofs_plan ON agent_proofs(plan_id);
CREATE INDEX IF NOT EXISTS idx_agent_proofs_type ON agent_proofs(type);
CREATE INDEX IF NOT EXISTS idx_agent_proofs_fingerprint ON agent_proofs(fingerprint);
CREATE INDEX IF NOT EXISTS idx_agent_proofs_anchored ON agent_proofs(anchored) WHERE NOT anchored;

-- 3. Proof batches table (Merkle trees for session heartbeats)
CREATE TABLE IF NOT EXISTS agent_proof_batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  merkle_root TEXT NOT NULL,
  proof_ids UUID[] NOT NULL,
  proof_count INTEGER NOT NULL,

  -- Anchoring
  anchored BOOLEAN DEFAULT false,
  anchor_tx_signature TEXT,
  anchor_slot BIGINT,
  anchor_timestamp TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_proof_batches_session ON agent_proof_batches(session_id);
CREATE INDEX IF NOT EXISTS idx_agent_proof_batches_user ON agent_proof_batches(user_id);

-- 4. User Solana wallets (custodial)
CREATE TABLE IF NOT EXISTS user_solana_wallets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,

  pubkey TEXT NOT NULL UNIQUE,
  encrypted_private_key TEXT NOT NULL,
  key_version INTEGER DEFAULT 1,

  total_anchored_proofs INTEGER DEFAULT 0,
  total_anchored_batches INTEGER DEFAULT 0,
  last_anchor_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_solana_wallets_pubkey ON user_solana_wallets(pubkey);
CREATE INDEX IF NOT EXISTS idx_user_solana_wallets_user ON user_solana_wallets(user_id);

-- 5. Teaching assistant conversations
CREATE TABLE IF NOT EXISTS agent_assistant_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  messages JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_assistant_conversations_session
ON agent_assistant_conversations(session_id);

-- 6. Row Level Security

-- Proofs
ALTER TABLE agent_proofs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own proofs"
  ON agent_proofs FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service can insert proofs"
  ON agent_proofs FOR INSERT WITH CHECK (true);

CREATE POLICY "Service can update proofs"
  ON agent_proofs FOR UPDATE USING (true);

-- Proof Batches
ALTER TABLE agent_proof_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own batches"
  ON agent_proof_batches FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service can insert batches"
  ON agent_proof_batches FOR INSERT WITH CHECK (true);

CREATE POLICY "Service can update batches"
  ON agent_proof_batches FOR UPDATE USING (true);

-- Wallets
ALTER TABLE user_solana_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own wallet"
  ON user_solana_wallets FOR SELECT USING (auth.uid() = user_id);

-- Conversations
ALTER TABLE agent_assistant_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own conversations"
  ON agent_assistant_conversations FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service can insert conversations"
  ON agent_assistant_conversations FOR INSERT WITH CHECK (true);

CREATE POLICY "Service can update conversations"
  ON agent_assistant_conversations FOR UPDATE USING (true);
