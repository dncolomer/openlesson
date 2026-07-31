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
import { formatPromptWorkspaceContextBlock } from "@/lib/prompt-workspace-context";

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
      "id, user_id, organization_id, title, root_topic, description, notes, workspace_goal, is_public, is_group",
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
    .select("id, title, description, status")
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

  const sharedContext = formatPromptWorkspaceContextBlock({
    workspaceTitle: brief.plan.title,
    rootTopic: brief.plan.root_topic,
    workspaceGoal: brief.plan.workspace_goal || brief.plan.description,
    workspaceDescription: brief.plan.description,
    notes: brief.plan.notes,
    blockTitle: focusedBlock?.title,
    blockDescription: focusedBlock?.description,
    files: (brief.files || []).map((f) => ({ name: f.name, mime_type: f.mime_type })),
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

export function buildTapOpeningQuestionFallback(brief: TapScoreBrief) {
  const focusedBlock = brief.nodes.length === 1 ? brief.nodes[0] : null;
  const substance = (
    focusedBlock?.description ||
    brief.plan.workspace_goal ||
    brief.plan.description ||
    ""
  )
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 220);
  if (focusedBlock) {
    if (substance) {
      return `What is the core idea of "${focusedBlock.title}" (${substance.slice(0, 120)}), and how would you explain what would break if you got it wrong?`;
    }
    return `What is the core idea of "${focusedBlock.title}", and how would you explain it to someone encountering it for the first time?`;
  }
  const title = brief.plan.title || brief.plan.root_topic || "this workspace";
  if (substance) {
    return `What is the most important idea you learned in "${title}" (${substance.slice(0, 120)}), and how would you explain why it matters in practice?`;
  }
  return `What stands out as most important in "${title}", and how would you explain that you understand it?`;
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

export function buildTapStartingTopicsFallback(brief: TapScoreBrief): TapStartingTopic[] {
  const focusedBlock = brief.nodes.length === 1 ? brief.nodes[0] : null;
  const planTitle = brief.plan.title || brief.plan.root_topic;
  const descCue = (focusedBlock?.description || brief.plan.description || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  const fileCue =
    brief.files && brief.files.length > 0
      ? ` (materials: ${brief.files
          .slice(0, 2)
          .map((f) => f.name)
          .join(", ")})`
      : "";

  if (focusedBlock) {
    const substance = descCue || focusedBlock.title;
    return [
      {
        id: "core-idea",
        title: `Core idea of ${focusedBlock.title}`.slice(0, 48),
        subtitle: "Define the central mechanism.",
        openingQuestion: `What is the core idea of "${focusedBlock.title}"${descCue ? ` — given: ${descCue}` : ""}, and how would you define it precisely?`,
      },
      {
        id: "why-it-matters",
        title: "Why it matters",
        subtitle: "Connect concept to a real decision.",
        openingQuestion: `Why does "${focusedBlock.title}" matter in practice${fileCue}, and where would misunderstanding "${substance.slice(0, 60)}" cause trouble?`,
      },
      {
        id: "transfer",
        title: "Apply and transfer",
        subtitle: "Use it in a new scenario.",
        openingQuestion: `How would you apply "${focusedBlock.title}" in a new scenario? Walk through one concrete example${fileCue}.`,
      },
    ];
  }

  const nodeTopics = brief.nodes.slice(0, TAP_STARTING_TOPIC_COUNT).map((node, index) => ({
    id: slugifyTopicId(node.title, index),
    title: node.title,
    subtitle: node.description?.trim().slice(0, 80) || `Key ideas in ${node.title}.`,
    openingQuestion: node.description?.trim()
      ? `For "${node.title}": ${node.description.trim().slice(0, 140)} — what is the key idea you must not get wrong?`
      : `What is the key idea of "${node.title}", and how would you demonstrate that you understand it?`,
  }));

  if (nodeTopics.length === TAP_STARTING_TOPIC_COUNT) {
    return nodeTopics;
  }

  const fillers: TapStartingTopic[] = [
    {
      id: "big-picture",
      title: `${planTitle}: big picture`.slice(0, 48),
      subtitle: "What matters most across the workspace.",
      openingQuestion: `What is the most important idea in "${planTitle}"${descCue ? ` (${descCue})` : ""}, and why does it stand out?`,
    },
    {
      id: "causal-links",
      title: "Causal connections",
      subtitle: "How ideas depend on each other.",
      openingQuestion: `In "${planTitle}", what causes what? Pick one relationship and explain the mechanism.`,
    },
    {
      id: "blind-spots",
      title: "Gaps and blind spots",
      subtitle: "What still feels fragile.",
      openingQuestion: `Where is your understanding of "${planTitle}" still weakest, and how would you test that you've actually learned it?`,
    },
  ];

  return [...nodeTopics, ...fillers].slice(0, TAP_STARTING_TOPIC_COUNT);
}

export async function generateTapStartingTopics(brief: TapScoreBrief, minutes: number): Promise<TapStartingTopic[]> {
  const context = buildTapScoreInstructions(brief, "curious", minutes);
  const focusedBlock = brief.nodes.length === 1 ? brief.nodes[0] : null;
  const target = focusedBlock?.title || brief.plan.title;

  const response = await callXaiJSON<{ topics?: TapStartingTopic[] }>(
    [
      systemMessage(`${context}\n\n${buildTapStartingTopicsTask(TAP_STARTING_TOPIC_COUNT)}`),
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

  return buildTapStartingTopicsFallback(brief);
}

export function buildTapPracticeOpeningQuestionFallback(brief: TapScoreBrief): string {
  const focusedBlock = brief.nodes.length === 1 ? brief.nodes[0] : null;
  const target = focusedBlock?.title || brief.plan.title || brief.plan.root_topic || "this topic";
  const hint = (focusedBlock?.description || brief.plan.description || "").replace(/\s+/g, " ").trim().slice(0, 100);
  if (hint) {
    return `In simple terms, what is the basic idea behind "${target}" (${hint})?`;
  }
  return `In simple terms, what is "${target}" — just the basic idea in a sentence or two?`;
}

export async function generateTapOpeningQuestion(
  brief: TapScoreBrief,
  minutes: number,
  options?: { practice?: boolean },
) {
  const practice = options?.practice === true;
  const context = buildTapScoreInstructions(brief, "curious", minutes);
  const focusedBlock = brief.nodes.length === 1 ? brief.nodes[0] : null;
  const target = focusedBlock?.title || brief.plan.title;
  const task = practice ? buildTapPracticeOpeningQuestionTask() : buildTapOpeningQuestionTask();
  const userAsk = practice
    ? `Generate an easy practice warm-up opening about (stay on topic, keep difficulty simple): ${target}`
    : `Generate the opening knowledge-verification prompt for demonstrating learning about: ${target}`;

  const response = await callXai(
    [systemMessage(`${context}\n\n${task}`), userMessage(userAsk)],
    { maxTokens: 120, temperature: practice ? 0.4 : 0.55, fetchTimeout: 30000 },
  );

  if (response.success && response.data?.trim()) {
    return response.data.trim();
  }

  return practice ? buildTapPracticeOpeningQuestionFallback(brief) : buildTapOpeningQuestionFallback(brief);
}
