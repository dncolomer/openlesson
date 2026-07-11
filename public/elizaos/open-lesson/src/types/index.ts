// ── Plan types ──────────────────────────────────────────────────────────────

export interface Block {
  id: string;
  title: string;
  description: string;
  is_start: boolean;
  next_block_ids: string[];
  status: string;
}

export interface CreatePlanResponse {
  workspace_id: string;
  topic: string;
  duration_days: number;
  nodes: Block[];
}

export interface AdaptPlanResponse {
  workspace_id: string;
  instruction: string;
  nodes: Block[];
}

export interface CreatePlanFromVideoResponse {
  workspace_id: string;
  youtube_url: string;
  topic: string;
  duration_days: number;
  nodes: Block[];
}

// ── Session types ───────────────────────────────────────────────────────────

export interface StartSessionResponse {
  session_id: string;
  topic: string;
  workspace_id?: string;
  block_id?: string;
  status: string;
}

export interface PauseSessionResponse {
  session_id: string;
  status: string;
  message: string;
}

export interface ResumeSessionResponse {
  session_id: string;
  status: string;
  message: string;
}

export interface EndSessionResponse {
  session_id: string;
  status: string;
  message: string;
}

// ── Analysis / heartbeat types ──────────────────────────────────────────────

export interface HeartbeatInput {
  type: "audio" | "text" | "image";
  content: string;
  format?: string;
}

export interface Probe {
  question: string;
  reasoning: string;
}

export interface AnalyzeHeartbeatResponse {
  session_id: string;
  gap_score: number;
  signals: string[];
  probes: Probe[];
  transcript?: string;
  requires_follow_up: boolean;
}

// ── Ask assistant types ─────────────────────────────────────────────────────

export interface AskAssistantResponse {
  session_id: string;
  answer: string;
}

// ── Proof types ─────────────────────────────────────────────────────────────

export interface Proof {
  hash: string;
  timestamp: string;
  session_id: string;
}

// ── Analytics types ─────────────────────────────────────────────────────────

export interface SessionStat {
  session_id: string;
  topic: string;
  status: string;
  started_at: string;
  ended_at?: string;
  heartbeat_count: number;
  average_gap_score: number;
}

export interface AnalyticsResponse {
  total_sessions: number;
  total_plans: number;
  average_gap_score: number;
  sessions: SessionStat[];
}
