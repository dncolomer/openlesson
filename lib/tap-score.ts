import { createPrivateToken, hashPrivateToken } from "@/lib/private-token";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { callXai, callXaiJSON, systemMessage, userMessage } from "@/lib/xai-client";
import {
  buildTapFacilitatorInstructions,
  buildTapOpeningQuestionTask,
  buildTapStartingTopicsTask,
} from "@/lib/prompt-kernel/surfaces/tap";

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
}

export interface TapScoreMarker {
  id: string;
  label: string;
  score: number;
  rationale: string;
}

export interface TapScoreAnalysis {
  score: number;
  verification_score: number;
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
  return "a neutral TAP facilitator who elicits System 1 and System 2 think-aloud traces so later analysis can see what the learner can explain, connect, apply, and repair";
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
    .select("id, user_id, organization_id, title, root_topic, description, notes, is_public, is_group")
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
  if (!requireOwnership && !plan.is_public && !plan.is_group && plan.user_id !== userId) {
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

  return {
    userId,
    brief: {
      plan: {
        id: plan.id,
        title: plan.title || plan.root_topic,
        root_topic: plan.root_topic,
        description: plan.description,
        notes: plan.notes,
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

  const workspaceBlock = `Workspace:
Title: ${brief.plan.title}
Topic: ${brief.plan.root_topic}
Description: ${brief.plan.description || "None"}
Notes: ${brief.plan.notes || "None"}

Workspace sessions/nodes:
${nodeSummary || "No nodes found."}

User session context:
${sessionSummary || "No completed session reports found yet."}

${focusSessionSummary}`;

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
  if (focusedBlock) {
    return `Teach me what you learned about "${focusedBlock.title}". What is the core idea, and how would you explain it to someone encountering it for the first time?`;
  }
  return `Teach me what you learned in "${brief.plan.title}". What stands out as most important, and why?`;
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

  if (focusedBlock) {
    return [
      {
        id: "core-idea",
        title: `Core idea of ${focusedBlock.title}`,
        subtitle: "Explain the central concept in your own words.",
        openingQuestion: `What is the core idea behind "${focusedBlock.title}", and how would you explain it to someone encountering it for the first time?`,
      },
      {
        id: "why-it-matters",
        title: "Why it matters",
        subtitle: "Connect the concept to a real problem or decision.",
        openingQuestion: `Why does "${focusedBlock.title}" matter in practice, and where would misunderstanding it cause trouble?`,
      },
      {
        id: "transfer",
        title: "Apply and transfer",
        subtitle: "Show how you would use this beyond the original example.",
        openingQuestion: `How would you apply what you learned about "${focusedBlock.title}" in a new context? Walk me through an example.`,
      },
    ];
  }

  const nodeTopics = brief.nodes.slice(0, TAP_STARTING_TOPIC_COUNT).map((node, index) => ({
    id: slugifyTopicId(node.title, index),
    title: node.title,
    subtitle: node.description?.trim() || `Demonstrate what you learned about ${node.title}.`,
    openingQuestion: `Teach me what you learned about "${node.title}". What is the key idea, and how confident are you that you could explain it clearly?`,
  }));

  if (nodeTopics.length === TAP_STARTING_TOPIC_COUNT) {
    return nodeTopics;
  }

  const fillers: TapStartingTopic[] = [
    {
      id: "big-picture",
      title: `${planTitle}: big picture`,
      subtitle: "Start with what matters most across the workspace.",
      openingQuestion: `What is the most important thing you learned in "${planTitle}", and why does it stand out?`,
    },
    {
      id: "causal-links",
      title: "Causal connections",
      subtitle: "Show how ideas depend on or explain each other.",
      openingQuestion: `In "${planTitle}", what causes what? Pick one relationship you understand and explain the mechanism behind it.`,
    },
    {
      id: "blind-spots",
      title: "Gaps and blind spots",
      subtitle: "Surface what still feels fuzzy or fragile.",
      openingQuestion: `Where is your understanding of "${planTitle}" still weakest, and how would you test whether you've actually learned it?`,
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
      userMessage(`Generate ${TAP_STARTING_TOPIC_COUNT} starting topics for think-aloud demonstration about: ${target}`),
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

export async function generateTapOpeningQuestion(brief: TapScoreBrief, minutes: number) {
  const context = buildTapScoreInstructions(brief, "curious", minutes);
  const focusedBlock = brief.nodes.length === 1 ? brief.nodes[0] : null;
  const target = focusedBlock?.title || brief.plan.title;

  const response = await callXai(
    [
      systemMessage(`${context}\n\n${buildTapOpeningQuestionTask()}`),
      userMessage(`Generate the opening think-aloud prompt for demonstrating learning about: ${target}`),
    ],
    { maxTokens: 120, temperature: 0.55, fetchTimeout: 30000 },
  );

  if (response.success && response.data?.trim()) {
    return response.data.trim();
  }

  return buildTapOpeningQuestionFallback(brief);
}
