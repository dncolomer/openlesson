import { createPrivateToken, hashPrivateToken } from "@/lib/private-token";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { callXai, callXaiJSON, systemMessage, userMessage } from "@/lib/xai-client";
import {
  buildTapFacilitatorInstructions,
  buildTapOpeningQuestionTask,
  buildTapPracticeOpeningQuestionTask,
  buildTapStartingTopicsTask,
} from "@/lib/prompt-kernel/surfaces/tap";
import {
  formatPromptWorkspaceContextBlock,
  parseBlockLocalContext,
  type PromptBlockInventoryItem,
} from "@/lib/prompt-workspace-context";
import { normalizeUnusableCells } from "@/lib/map-ground-rules";
import { withConversationLanguageInstruction } from "@/lib/tutoring-languages";

export interface TapStartingTopic {
  id: string;
  title: string;
  subtitle: string;
  openingQuestion: string;
}

const TAP_STARTING_TOPIC_COUNT = 3;

export type TapScoreMode = "curious";

export interface TapScoreBrief {
  plan: {
    id: string;
    title: string;
    root_topic: string;
    description?: string | null;
    notes?: string | null;
    /** When present, preferred over description as the success outcome. */
    workspace_goal?: string | null;
  };
  nodes: Array<{
    id: string;
    title: string;
    description: string | null;
    status: string | null;
    is_start?: boolean | null;
    position_x?: number | null;
    position_y?: number | null;
    span_w?: number | null;
    span_h?: number | null;
    shape_cells?: Array<{ dr: number; dc: number }> | null;
    next_block_ids?: string[] | null;
    lock_until_block_ids?: string[] | null;
    local_context?: ReturnType<typeof parseBlockLocalContext>;
  }>;
  sessions: Array<{
    id: string;
    block_title: string | null;
    problem: string | null;
    status: string | null;
    report: string | null;
  }>;
  focusSession?: {
    id: string;
    block_id: string | null;
    block_title: string | null;
    problem: string | null;
    status: string | null;
    report: string | null;
  } | null;
  /** Workspace file names (always listed when present). */
  files?: Array<{ name: string; mime_type?: string | null }>;
  /** Unusable map ground cells (path-shaping). */
  unusableCells?: Array<{ row: number; col: number }>;
}

export interface TapScoreMarker {
  id: string;
  label: string;
  score: number;
  rationale: string;
}

export interface TapScoreAnalysis {
  score: number;
  /** Product primary named field (equals score). */
  lwm_snapshot_score: number;
  /**
   * History-compatible mirror of score for LWM scores_snapshot wire key.
   * Not a product-facing score type name.
   */
  verification_score?: number;
  workspace_goal: string;
  vertical: "verification";
  markers: TapScoreMarker[];
  gap_analysis: {
    summary: string;
    gaps: Array<{
      title: string;
      proof_of_work: string;
      severity: "low" | "medium" | "high";
      suggested_repair: string;
    }>;
  };
  knowledge_gaps: Array<{
    title: string;
    proof_of_work: string;
    severity: "low" | "medium" | "high";
    suggested_repair: string;
  }>;
  overall_reflection: string;
  strengths: string[];
  growth_areas: string[];
  follow_up_prompts: string[];
  confidence: "emerging" | "developing" | "clear" | "well-connected";
}

export const TAP_SCORE_MARKERS = [
  { id: "conceptual_clarity", label: "Conceptual Clarity" },
  { id: "causal_reasoning", label: "Causal Reasoning" },
  { id: "knowledge_integration", label: "Knowledge Integration" },
  { id: "precision_of_language", label: "Precision of Language" },
  { id: "adaptive_explanation", label: "Adaptive Explanation" },
  { id: "metacognitive_awareness", label: "Metacognitive Awareness" },
] as const;

export { createPrivateToken, hashPrivateToken };

export function buildTapScoreSessionUrl(baseUrl: string, privateToken: string) {
  return `${baseUrl.replace(/\/$/, "")}/tap/session/${privateToken}`;
}

export function listenerStyle(_mode: TapScoreMode) {
  return "a neutral knowledge-verification facilitator who elicits both spontaneous (System 1 / stashed-or-unsent) and deliberate (System 2 / send-edit-skip-resend) knowledge traces through natural domain questions so later analysis can see what the learner can explain, connect, apply, and repair — without stage directions or platform talk in learner-visible turns";
}

export async function getTapScoreBrief(workspaceId: string, focusNodeIds: string[] = [], focusSessionId?: string | null) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return getTapScoreBriefForUser(workspaceId, user.id, focusNodeIds, false, focusSessionId);
}

export async function getTapScoreBriefForUser(workspaceId: string, userId: string, focusNodeIds: string[] = [], requireOwnership = true, focusSessionId?: string | null) {
  const supabase = createAdminClient();

  const { data: plan, error: planError } = await supabase
    .from("workspaces")
    .select(
      "id, user_id, organization_id, title, root_topic, description, notes, workspace_goal, is_public, is_group, unusable_cells",
    )
    .eq("id", workspaceId)
    .single();

  if (planError || !plan) throw new Error("Workspace not found");
  if (requireOwnership && plan.user_id !== userId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", userId)
      .single();
    if (!plan.organization_id || profile?.organization_id !== plan.organization_id) {
      throw new Error("Not authorized");
    }
  }
  if (!requireOwnership && !plan.is_public && plan.user_id !== userId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", userId)
      .single();
    if (!plan.organization_id || profile?.organization_id !== plan.organization_id) {
      throw new Error("Not authorized");
    }
  }

  let nodesQuery = supabase
    .from("blocks")
    .select(
      "id, title, description, status, is_start, position_x, position_y, span_w, span_h, shape_cells, next_block_ids, lock_until_block_ids, local_context",
    )
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });

  if (focusNodeIds.length > 0) {
    nodesQuery = nodesQuery.in("id", focusNodeIds);
  }

  const { data: nodes } = await nodesQuery;
  const blockIds = (nodes || []).map((node) => node.id);

  const { data: blockSessions } = blockIds.length > 0
    ? await supabase
      .from("block_sessions")
      .select("session_id, block_id, blocks(title)")
      .eq("workspace_id", workspaceId)
      .eq("user_id", userId)
      .in("block_id", blockIds)
    : { data: [] };

  const sessionIds = Array.from(new Set((blockSessions || []).map((row: any) => row.session_id).filter(Boolean)));
  const { data: sessions } = sessionIds.length > 0
    ? await supabase
      .from("sessions")
      .select("id, problem, status, report")
      .in("id", sessionIds)
      .eq("user_id", userId)
    : { data: [] };

  const blockTitleBySessionId = new Map(
    (blockSessions || []).map((row: any) => [row.session_id, row.blocks?.title || null])
  );

  const focusSessionLink = focusSessionId
    ? (blockSessions || []).find((row: any) => row.session_id === focusSessionId) || null
    : null;
  const { data: focusSession } = focusSessionId
    ? await supabase
      .from("sessions")
      .select("id, problem, status, report")
      .eq("id", focusSessionId)
      .eq("user_id", userId)
      .single()
    : { data: null };

  if (focusSessionId && !focusSession) throw new Error("Session not found");

  const { data: workspaceFiles } = await supabase
    .from("workspace_files")
    .select("file_name, mime_type")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(24);

  return {
    userId,
    brief: {
      plan: {
        id: plan.id,
        title: plan.title || plan.root_topic,
        root_topic: plan.root_topic,
        description: plan.description,
        notes: plan.notes,
        workspace_goal:
          (plan as { workspace_goal?: string | null }).workspace_goal ?? null,
      },
      nodes: (nodes || []).map((node) => ({
        id: node.id,
        title: node.title,
        description: node.description,
        status: node.status,
        is_start: (node as { is_start?: boolean }).is_start ?? null,
        position_x: (node as { position_x?: number | null }).position_x ?? null,
        position_y: (node as { position_y?: number | null }).position_y ?? null,
        span_w: (node as { span_w?: number | null }).span_w ?? null,
        span_h: (node as { span_h?: number | null }).span_h ?? null,
        shape_cells: (node as { shape_cells?: Array<{ dr: number; dc: number }> | null })
          .shape_cells ?? null,
        next_block_ids: (node as { next_block_ids?: string[] | null }).next_block_ids ?? null,
        lock_until_block_ids:
          (node as { lock_until_block_ids?: string[] | null }).lock_until_block_ids ?? null,
        local_context: parseBlockLocalContext(
          (node as { local_context?: unknown }).local_context,
        ),
      })),
      sessions: (sessions || []).map((session) => ({
        id: session.id,
        block_title: blockTitleBySessionId.get(session.id) || null,
        problem: session.problem,
        status: session.status,
        report: session.report,
      })),
      focusSession: focusSession ? {
        id: focusSession.id,
        block_id: focusSessionLink?.block_id || null,
        block_title: blockTitleBySessionId.get(focusSession.id) || null,
        problem: focusSession.problem,
        status: focusSession.status,
        report: focusSession.report,
      } : null,
      files: (workspaceFiles || [])
        .map((f) => ({
          name: String((f as { file_name?: string }).file_name || "").trim(),
          mime_type: (f as { mime_type?: string | null }).mime_type ?? null,
        }))
        .filter((f) => f.name),
      unusableCells: normalizeUnusableCells(
        (plan as { unusable_cells?: unknown }).unusable_cells,
      ),
    } satisfies TapScoreBrief,
  };
}

export function buildTapScoreInstructions(brief: TapScoreBrief, mode: TapScoreMode, minutes: number) {
  const nodeSummary = brief.nodes
    .map((node, index) => `${index + 1}. ${node.title}${node.status ? ` (${node.status})` : ""}: ${node.description || "No description"}`)
    .join("\n");

  const sessionSummary = brief.sessions
    .map((session, index) => `${index + 1}. ${session.block_title || session.problem || "Session"}: ${session.report ? session.report.slice(0, 1200) : "No report yet"}`)
    .join("\n\n");

  const focusedBlock = brief.nodes.length === 1 ? brief.nodes[0] : null;
  const assessmentTarget = focusedBlock
    ? `the performance block "${focusedBlock.title}"`
    : `the full workspace "${brief.plan.title}"`;
  const focusSessionSummary = brief.focusSession
    ? `Related workspace session:\nTitle: ${brief.focusSession.block_title || brief.focusSession.problem || "Session"}\nStatus: ${brief.focusSession.status || "unknown"}\nProblem: ${brief.focusSession.problem || "None"}\nReport: ${brief.focusSession.report || "No report yet"}`
    : focusedBlock
      ? "No related completed session. Evaluate the selected performance block directly."
      : "No focused block. Evaluate learning across the whole workspace.";

  const inventoryBlocks: PromptBlockInventoryItem[] = (brief.nodes || []).map((node) => ({
    id: node.id,
    title: node.title,
    description: node.description,
    status: node.status,
    is_start: node.is_start,
    position_x: node.position_x,
    position_y: node.position_y,
    span_w: node.span_w,
    span_h: node.span_h,
    shape_cells: node.shape_cells,
    next_block_ids: node.next_block_ids,
    lock_until_block_ids: node.lock_until_block_ids,
    local_context: node.local_context,
  }));

  const sharedContext = formatPromptWorkspaceContextBlock({
    workspaceTitle: brief.plan.title,
    rootTopic: brief.plan.root_topic,
    workspaceGoal: brief.plan.workspace_goal || brief.plan.description,
    workspaceDescription: brief.plan.description,
    notes: brief.plan.notes,
    blockTitle: focusedBlock?.title,
    blockDescription: focusedBlock?.description,
    focusedBlockId: focusedBlock?.id,
    files: (brief.files || []).map((f) => ({ name: f.name, mime_type: f.mime_type })),
    blocks: inventoryBlocks,
    blockLocalContext: focusedBlock?.local_context ?? null,
    unusableCells: brief.unusableCells,
  });

  const workspaceBlock = `${sharedContext}

Workspace sessions/nodes:
${nodeSummary || "No nodes found."}

User session context:
${sessionSummary || "No completed session reports found yet."}

${focusSessionSummary}

Learner-visible prompts must stay on this domain context. Never invent unrelated topics. Never use "out loud" stage directions.`;

  return buildTapFacilitatorInstructions({
    assessmentTarget,
    listenerStyle: listenerStyle(mode),
    markers: TAP_SCORE_MARKERS.map((marker) => marker.label).join(", "),
    minutes,
    workspaceBlock,
  });
}

/**
 * Offline-only fallback when xAI opening generation fails.
 * Intentionally generic — no block-title / attachments / A-B-C shells.
 * Prefer raw model text from {@link generateTapOpeningQuestion} whenever available.
 */
export function buildTapOpeningQuestionFallback(_brief: TapScoreBrief) {
  void _brief;
  return "What concrete claim will you demonstrate, and what single intermediate result proves it?";
}

function slugifyTopicId(value: string, index: number) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || `topic-${index + 1}`;
}

function normalizeTapStartingTopics(raw: unknown): TapStartingTopic[] | null {
  if (!Array.isArray(raw)) return null;
  const topics = raw
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const title = String(record.title || "").trim();
      const subtitle = String(record.subtitle || "").trim();
      const openingQuestion = String(record.openingQuestion || "").trim();
      if (!title || !openingQuestion) return null;
      const id = String(record.id || "").trim() || slugifyTopicId(title, index);
      return {
        id,
        title,
        subtitle: subtitle || `Demonstrate your understanding of ${title}.`,
        openingQuestion,
      } satisfies TapStartingTopic;
    })
    .filter((topic): topic is TapStartingTopic => topic !== null)
    .slice(0, TAP_STARTING_TOPIC_COUNT);

  return topics.length === TAP_STARTING_TOPIC_COUNT ? topics : null;
}

/**
 * Offline-only topic cards when xAI topic generation fails.
 * Opening questions are generic (no title-shell / attachments / A-B-C patterns).
 * Prefer {@link generateTapStartingTopics} model output whenever available.
 */
export function buildTapStartingTopicsFallback(brief: TapScoreBrief): TapStartingTopic[] {
  const focusedBlock = brief.nodes.length === 1 ? brief.nodes[0] : null;
  const openings = [
    "What concrete claim will you demonstrate, and what intermediate result proves it?",
    "Name one mistake that would yield a wrong conclusion here, and the first signal that catches it.",
    "Finish one worked check — what single piece of evidence shows you are correct?",
  ] as const;

  if (focusedBlock) {
    return [
      {
        id: "core-idea",
        title: "Core idea",
        subtitle: "State the central claim you will demonstrate.",
        openingQuestion: openings[0],
      },
      {
        id: "why-it-matters",
        title: "Why it matters",
        subtitle: "Connect the claim to a real decision.",
        openingQuestion: openings[1],
      },
      {
        id: "transfer",
        title: "Apply and transfer",
        subtitle: "Use it in a worked instance.",
        openingQuestion: openings[2],
      },
    ];
  }

  const nodeTopics = brief.nodes.slice(0, TAP_STARTING_TOPIC_COUNT).map((node, index) => ({
    id: slugifyTopicId(node.title, index),
    title: "Topic",
    subtitle: "Demonstrate understanding with a checkable result.",
    openingQuestion: openings[index % openings.length]!,
  }));

  if (nodeTopics.length === TAP_STARTING_TOPIC_COUNT) {
    return nodeTopics;
  }

  const fillers: TapStartingTopic[] = [0, 1, 2].map((index) => ({
    id: ["big-picture", "causal-links", "blind-spots"][index],
    title: ["Big picture", "Causal connections", "Gaps and blind spots"][index],
    subtitle: [
      "What matters most.",
      "How ideas depend on each other.",
      "What still feels fragile.",
    ][index],
    openingQuestion: openings[index]!,
  }));

  return [...nodeTopics, ...fillers].slice(0, TAP_STARTING_TOPIC_COUNT);
}

export async function generateTapStartingTopics(
  brief: TapScoreBrief,
  minutes: number,
  options?: { conversationLanguage?: string | null },
): Promise<TapStartingTopic[]> {
  const context = buildTapScoreInstructions(brief, "curious", minutes);
  const focusedBlock = brief.nodes.length === 1 ? brief.nodes[0] : null;
  const target = focusedBlock?.title || brief.plan.title;
  const system = withConversationLanguageInstruction(
    `${context}\n\n${buildTapStartingTopicsTask(TAP_STARTING_TOPIC_COUNT)}`,
    options?.conversationLanguage,
  );

  const response = await callXaiJSON<{ topics?: TapStartingTopic[] }>(
    [
      systemMessage(system),
      userMessage(`Generate ${TAP_STARTING_TOPIC_COUNT} starting topics for knowledge-verification demonstration about: ${target}`),
    ],
    { maxTokens: 900, temperature: 0.45, fetchTimeout: 45000 },
  );

  if (response.success && response.data) {
    const parsed =
      normalizeTapStartingTopics(response.data.topics) ??
      normalizeTapStartingTopics((response.data as { topics?: unknown }).topics);
    if (parsed) return parsed;
  }

  throw new Error("Failed to generate practice content");
}

/** Offline practice warm-up when xAI fails — no block-title shell. */
export function buildTapPracticeOpeningQuestionFallback(_brief: TapScoreBrief): string {
  void _brief;
  return "In simple terms, what is the basic idea here — one checkable sentence?";
}

/**
 * Offline drill exercise when xAI fails.
 * Generic checkable prompt — no title “on this setup”, attachments dump, or A/B/C shell.
 * Prefer raw model exercises from generate paths whenever available.
 */
export function buildTapExerciseFallbackFromBrief(_brief: TapScoreBrief): string {
  void _brief;
  return "Exercise: Work one fully specified problem from this domain. Show intermediate steps and box a single final answer.";
}

export async function generateTapOpeningQuestion(
  brief: TapScoreBrief,
  minutes: number,
  options?: { practice?: boolean; conversationLanguage?: string | null },
) {
  const practice = options?.practice === true;
  const context = buildTapScoreInstructions(brief, "curious", minutes);
  const focusedBlock = brief.nodes.length === 1 ? brief.nodes[0] : null;
  const target = focusedBlock?.title || brief.plan.title;
  const task = practice ? buildTapPracticeOpeningQuestionTask() : buildTapOpeningQuestionTask();
  const userAsk = practice
    ? `Generate an easy practice warm-up opening about (stay on topic, keep difficulty simple): ${target}`
    : `Generate the opening knowledge-verification prompt for demonstrating learning about: ${target}`;
  const system = withConversationLanguageInstruction(
    `${context}\n\n${task}`,
    options?.conversationLanguage,
  );

  const response = await callXai(
    [systemMessage(system), userMessage(userAsk)],
    { maxTokens: 120, temperature: practice ? 0.4 : 0.55, fetchTimeout: 30000 },
  );

  if (response.success && response.data?.trim()) {
    return response.data.trim();
  }

  throw new Error("Failed to generate practice content");
}
