-- Opaque evaluation mode for agent workspaces (privacy-preserving PoW verification)
ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS evaluation_mode text NOT NULL DEFAULT 'semantic',
  ADD COLUMN IF NOT EXISTS protocol_config jsonb,
  ADD COLUMN IF NOT EXISTS external_refs jsonb;

ALTER TABLE workspaces
  DROP CONSTRAINT IF EXISTS workspaces_evaluation_mode_check;

ALTER TABLE workspaces
  ADD CONSTRAINT workspaces_evaluation_mode_check
  CHECK (evaluation_mode IN ('semantic', 'opaque'));

COMMENT ON COLUMN workspaces.evaluation_mode IS 'semantic = default LLM-decomposed workspace; opaque = protocol-driven privacy mode';
COMMENT ON COLUMN workspaces.protocol_config IS 'Opaque protocol definition (phases, goal_ref, goal_tokens)';
COMMENT ON COLUMN workspaces.external_refs IS 'Partner-owned opaque references; excluded from LLM inference';