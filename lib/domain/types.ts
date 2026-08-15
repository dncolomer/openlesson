// Domain types and pure helpers (no I/O).
// Import from here when you need types without pulling persistence modules.


export type ToolName = "chat" | "chapters" | "canvas" | "notebook" | "thought-history" | "grokipedia" | "dantes" | "exercise" | "reading" | "help" | "data-input" | "logs" | "goals" | "probe" | "session_plan" | "thought-trace";

export type ToolAction =
  | "open"
  | "close"
  | "send_message"
  | "canvas_draw"
  | "canvas_save"
  | "notebook_edit"
  | "notebook_save"
  | "prep_material_load"
  | "help_view"
  | "generate"
  | "archive"
  | "advance"
  | "revert"
  // Probe / Tutor panel interactions
  | "open_resources"
  | "open_practice"
  | "ask_assistant"
  | "toggle_focus"
  | "nav_prev"
  | "nav_next"
  | "nav_jump"
  // Session plan panel interactions
  | "step_expand"
  | "step_collapse"
  | "rollback"
  | "force_advance"
  | "cancel_advance"
  | "chapter_focus"
  | "chapter_load"
  | "chapter_reload"
  | "chapter_add"
  | "chapter_suggest"
  | "chapter_edit"
  | "chapter_position"
  | "chapter_done"
  | "chapter_exercise_upgrade"
  // Readiness-gate outcomes (manual-advance mode). These capture
  // "student thinks they're done vs LLM thinks they're done" disagreements
  // so we can later learn where the student's self-assessment matches
  // (or diverges from) the model's evaluation.
  | "advance_blocked_by_llm"
  | "advance_eval_failed"
  // Self-driving controls: skip, regenerate, reset probes
  | "skip"
  | "regenerate"
  | "reset_probes"
  | "reset"
  // Manual "Submit to Helios" — user explicitly asks the tutor to look at
  // the current notebook/canvas state. Triggers an analysis heartbeat out
  // of band from the 10s timer.
  | "submit_to_helios"
  // Project Mode: notebook/canvas submit lands on the Solution stack (no Helios).
  | "submit_to_solution"
  | "stuck_card"
  // Selective thought interface (System 1 / System 2 traces)
  | "crystallize"
  | "pause_finalize"
  | "thought_send"
  | "thought_resend"
  | "thought_edit"
  | "thought_skip"
  | "thought_select"
  | "thought_deselect";

export type RequestType = "question" | "task" | "suggestion" | "checkpoint" | "feedback";

export interface Probe {
  id: string;
  timestamp: number; // ms since session start
  gapScore: number;
  signals: string[];
  text: string;
  expandedText?: string;
  starred?: boolean;
  isRevealed?: boolean; // user has clicked to reveal this question
  requestType?: RequestType; // type of request (question, task, suggestion, checkpoint, feedback)
  planStepId?: string; // links to SessionPlanStep.id for step context
  archived?: boolean; // probe has been resolved/archived
  focused?: boolean; // user is focusing on this probe for analysis context
  suggestedTools?: ToolName[]; // ILE tools that would help with this probe (ephemeral, not persisted)
}

// Session Plan types for the Session Planner feature
export interface SessionPlanStep {
  id: string;
  description: string;
  status: "pending" | "in_progress" | "completed" | "skipped";
  type: RequestType;
  order: number;
  /** Grid column in the chapter map (same convention as workspace blocks). */
  position_x?: number;
  /** Grid row in the chapter map (same convention as workspace blocks). */
  position_y?: number;
}

export interface SessionPlan {
  id: string;
  sessionId: string;
  userId: string;
  goal: string;
  strategy: string;
  description?: string; // Brief summary for display purposes
  steps: SessionPlanStep[];
  currentStepIndex: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Validates that plan steps are safe to persist to the database.
 * Throws an error if steps are empty or any step has an empty description.
 * This is the last line of defense — no invalid steps should ever reach the DB.
 */
export function validatePlanSteps(steps: SessionPlanStep[]): void {
  if (!steps || !Array.isArray(steps)) {
    throw new Error("Cannot persist plan with invalid steps array");
  }
  if (steps.length === 0) return;
  const emptyDescriptions = steps.filter(s => !s.description || !s.description.trim());
  if (emptyDescriptions.length > 0) {
    throw new Error(
      `Cannot persist plan: ${emptyDescriptions.length}/${steps.length} steps have empty descriptions`
    );
  }
}

export type SessionStatus = "active" | "paused" | "completed";
export type ObserverMode = "off" | "passive" | "active";
export type Frequency = "rare" | "balanced" | "frequent";

export interface Session {
  id: string;
  problem: string;
  startedAt: string; // ISO string
  endedAt?: string;
  durationMs: number;
  status: SessionStatus;
  probes: Probe[];
  objectives: string[];
  hasAudio: boolean;
  audioPath?: string;
  report?: string;
  reportGeneratedAt?: string;
  transcript?: string;
  workspaceTitle?: string;
  planningPrompt?: string; // Custom instructions for plan generation
  metadata: {
    observerMode?: ObserverMode;
    frequency?: Frequency;
    eegSummary?: Record<string, number> | null;
    whiteboardData?: string | null;
    notebookData?: string | null;
    tutoringLanguage?: string;
    autoAdvance?: boolean;
    workspace_id?: string;
    /** ILE chapter / workspace block linked to this session (PoW context). */
    block_id?: string;
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

export function addProbeToSession(
  session: Session,
  probe: Probe
): Session {
  return {
    ...session,
    probes: [...session.probes, probe],
  };
}

export function endSession(
  session: Session,
  durationMs: number,
  status: SessionStatus = "completed"
): Session {
  return {
    ...session,
    endedAt: new Date().toISOString(),
    durationMs,
    status,
  };
}

export function getIlePostSessionPath(session: Pick<Session, "metadata">): string {
  const workspaceId = session.metadata?.workspace_id;
  if (typeof workspaceId === "string" && workspaceId) {
    return `/workspace/${workspaceId}`;
  }
  return "/dashboard";
}

export function getSessionStats(session: Session) {
  const probeCount = session.probes.length;
  const avgGapScore =
    probeCount > 0
      ? session.probes.reduce((sum, p) => sum + p.gapScore, 0) / probeCount
      : 0;

  const durationMinutes = Math.round(session.durationMs / 60000);
  const probesPerMinute = durationMinutes > 0 ? probeCount / durationMinutes : 0;

  const peakProbe = session.probes.reduce(
    (max, p) => (p.gapScore > max.gapScore ? p : max),
    { gapScore: 0 } as Probe
  );

  return {
    probeCount,
    avgGapScore: Math.round(avgGapScore * 100) / 100,
    durationMinutes,
    probesPerMinute: Math.round(probesPerMinute * 10) / 10,
    peakGapScore: peakProbe.gapScore,
    peakGapTime: peakProbe.timestamp,
  };
}

export interface FacialDataPoint {
  timestamp: number;
  facePresent: boolean;
  
  // Raw low-level indicators
  eyeOpennessLeft: number;
  eyeOpennessRight: number;
  gazeOffsetX: number;
  gazeOffsetY: number;
  mouthOpenness: number;
  mouthCornerLeft: number;
  mouthCornerRight: number;
  eyebrowLeftInner: number;
  eyebrowLeftOuter: number;
  eyebrowRightInner: number;
  eyebrowRightOuter: number;
  noseTipY: number;
  faceWidth: number;
  faceHeight: number;
  pupilLeftX: number;
  pupilLeftY: number;
  pupilRightX: number;
  pupilRightY: number;
  lipCornerLeftX: number;
  lipCornerLeftY: number;
  lipCornerRightX: number;
  lipCornerRightY: number;
  upperLipY: number;
  lowerLipY: number;
  
  // Head pose
  headPitch: number;
  headYaw: number;
  headRoll: number;
  
  // Derived states
  gazeDirection: "at_camera" | "away" | "unknown";
  headPose: { pitch: number; yaw: number; roll: number };
  mouthState: "open" | "closed";
  faceDistance: "optimal" | "too_close" | "too_far";
  
  // Inferred high-level indicators
  emotion: "neutral" | "happy" | "confused" | "frustrated" | "surprised" | "bored" | "thinking";
  attentionLevel: "high" | "medium" | "low";
  confusionScore: number;
  frustrationScore: number;
  engagementScore: number;
  processingScore: number;
  smileScore: number;
}

export interface LogToolUsageResult {
  /** True only if BOTH the storage upload and the DB insert succeeded. */
  success: boolean;
  /** True if the Storage upload itself succeeded (independent of DB insert). */
  uploadOk: boolean;
  /** True if the `session_tool` row insert succeeded. */
  insertOk: boolean;
  /** Primary error message, if any. */
  error?: string;
}

export interface SessionScreenshot {
  id: string;
  sessionId: string;
  userId: string;
  timestamp: number;
  /** xAI file ID for the screenshot blob */
  xaiFileId: string;
  createdAt: string;
}

export interface RecentAudioChunk {
  id: string;
  sessionId: string;
  timestamp: number;
  storagePath: string;
  chunkIndex: number;
}

export interface RecentTranscript {
  id: string;
  sessionId: string;
  /** xAI file ID — actual text content lives on xAI Files */
  xaiFileId: string;
  wordCount: number;
  timestamp: number;
}

export interface RecentToolEvent {
  id: string;
  sessionId: string;
  timestamp: number;
  toolName: string;
  toolAction: string;
  xaiFileId: string;
}

export interface RecentFacialData {
  id: string;
  sessionId: string;
  timestamp: number;
  xaiFileId: string;
}

export interface RecentEEGData {
  id: string;
  sessionId: string;
  timestamp: number;
  xaiFileId: string;
  chunkIndex: number;
  bandPowers?: { delta: number; theta: number; alpha: number; beta: number; gamma: number } | null;
}

export interface UserCalibration {
  sessionCount: number;
  avgGapScore: number;
  trend: "improving" | "declining" | "stable";
  recentTopics: string[];
  commonGaps: string[];
}

export type WorkspaceLifecycleStatus =
  | "active"
  | "completed"
  | "paused"
  | "archived"
  | string;

export interface Workspace {
  id: string;
  title: string;
  root_topic: string;
  status: WorkspaceLifecycleStatus;
  created_at?: string;
  user_id?: string;
  description?: string;
  is_public?: boolean;
  is_group?: boolean;
  organization_id?: string | null;
  author_id?: string;
  remix_count?: number;
  original_workspace_id?: string;
  source_type?: "topic" | "youtube";
  source_url?: string;
  source_summary?: string;
  notes?: string;
  workspace_goal?: string | null;
  cover_image_url?: string;
  is_all_you_can_learn?: boolean;
  aycl_category?: string | null;
  aycl_summary?: string | null;
  aycl_author_name?: string | null;
  aycl_author_avatar_url?: string | null;
  aycl_learner_price_cents?: number | null;
  aycl_full_price_cents?: number | null;
  unusable_cells?: Array<{ row: number; col: number }> | null;
  workspace_dags?: unknown[] | null;
}

export interface Block {
  id: string;
  workspace_id?: string;
  title: string;
  description: string;
  is_start: boolean;
  next_block_ids: string[];
  status: string;
  planning_prompt?: string;
  session_id?: string;
  position_x?: number | null;
  position_y?: number | null;
  span_w?: number | null;
  span_h?: number | null;
  shape_cells?: Array<{ dr: number; dc: number }> | null;
  lock_until_block_ids?: string[] | null;
  local_context?: {
    notes?: string | null;
    local_files?: Array<{ name: string; excerpt?: string | null }> | null;
    global_file_refs?: string[] | null;
    external_resource_ids?: string[] | null;
  } | null;
  practice_options?: unknown;
  creator_effects?: unknown;
}

export interface DeduplicatedSaveResult {
  saved: boolean;
  skipped: boolean;
  hash?: string;
}
