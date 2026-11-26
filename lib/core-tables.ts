/**
 * Canonical public table names for the core data model.
 * Historical SQL files keep the old names. Live writers use these.
 */

export const PROOF_OF_WORK_TABLE = "proof_of_work" as const;
export const SESSION_EMBEDDINGS_TABLE = "session_embeddings" as const;
export const VERIFY_FLOWS_TABLE = "verify_flows" as const;
export const PROTOCOLS_TABLE = VERIFY_FLOWS_TABLE;
export const FLOW_LINKS_TABLE = "flow_links" as const;
export const KNOWLEDGE_REGIONS_TABLE = "knowledge_regions" as const;
export const SESSIONS_TABLE = "sessions" as const;
export const WORKSPACES_TABLE = "workspaces" as const;
export const BLOCKS_TABLE = "blocks" as const;
export const EMBEDDING_MODELS_TABLE = "embedding_models" as const;
export const CREDIT_LEDGER_TABLE = "credit_ledger" as const;
