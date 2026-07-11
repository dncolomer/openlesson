import crypto from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { callXai, systemMessage, userMessage } from "@/lib/xai-client";

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
  overall_score: number;
  conversion_score: number;
  conversion_goal: string;
  markers: TapScoreMarker[];
  gap_analysis: {
    summary: string;
    gaps: Array<{
      title: string;
      proof_of_work: string;
      severity: "low" | "medium" | "high";
      suggested_repair: string;
    }>;
    next_practice: string[];
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

export function createPrivateToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export function buildTapScoreSessionUrl(baseUrl: string, privateToken: string) {
  return `${baseUrl.replace(/\/$/, "")}/tap/session/${privateToken}`;
}

export function hashPrivateToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function listenerStyle(_mode: TapScoreMode) {
  return "a neutral learning evaluator who asks clear questions that reveal what the learner can explain, connect, apply, and repair";
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

  return `You are the Think Aloud Protocol (TAP) session facilitator for OpenLesson.

The learner is demonstrating what they learned about ${assessmentTarget}. Your role is to collect enough proof of work to score the demonstration and identify actionable learning gaps. Route remediation into Integrated Learning Environment (ILE) practice where appropriate. You are ${listenerStyle(mode)}.

Your job is to run a Socratic learning demonstration. Elicit a clear, natural explanation and expose gaps: missing definitions, weak causal links, misconceptions, shallow examples, unsupported jumps, and fragile transfer across contexts. Do not announce scores during the live session. Ask questions that reveal understanding across these learning markers: ${TAP_SCORE_MARKERS.map((marker) => marker.label).join(", ")}.

Rules:
- Ask one short spoken question at a time.
- Do not lecture unless the user explicitly asks for help.
- Prefer questions over statements.
- Build each follow-up from the learner's own words.
- Ask the learner to justify, compare, predict, give examples, or repair their explanation.
- If the learner is wrong, ask a question that helps them notice the contradiction before correcting them.
- Act like you do not know the subject yet, but use the hidden workspace context to notice gaps.
- Ask for definitions when the user uses terms too quickly.
- Ask for concrete examples when explanations are abstract.
- Ask how ideas connect across the selected block or, if no block is selected, across the whole workspace.
- Ask targeted questions that can confirm or falsify likely knowledge gaps.
- Gently paraphrase your understanding and ask if you got it right.
- Keep responses concise and conversational.
- When the user is silent or vague, ask a clarifying question instead of filling in the answer.
- The session is timeboxed to ${minutes} minutes.

Start by saying: "Teach me what you learned here. I will ask follow-up questions to understand where your learning is solid and where gaps remain."

Workspace:
Title: ${brief.plan.title}
Topic: ${brief.plan.root_topic}
Description: ${brief.plan.description || "None"}
Notes: ${brief.plan.notes || "None"}

Workspace sessions/nodes:
${nodeSummary || "No nodes found."}

User session context:
${sessionSummary || "No completed session reports found yet."}

${focusSessionSummary}`;
}

export function buildTapOpeningQuestionFallback(brief: TapScoreBrief) {
  const focusedBlock = brief.nodes.length === 1 ? brief.nodes[0] : null;
  if (focusedBlock) {
    return `Teach me what you learned about "${focusedBlock.title}". What is the core idea, and how would you explain it to someone encountering it for the first time?`;
  }
  return `Teach me what you learned in "${brief.plan.title}". What stands out as most important, and why?`;
}

export async function generateTapOpeningQuestion(brief: TapScoreBrief, minutes: number) {
  const context = buildTapScoreInstructions(brief, "curious", minutes);
  const focusedBlock = brief.nodes.length === 1 ? brief.nodes[0] : null;
  const target = focusedBlock?.title || brief.plan.title;

  const response = await callXai(
    [
      systemMessage(
        `${context}\n\nGenerate exactly ONE opening Socratic question to start the Think Aloud demonstration. The question must be specific to the workspace/block context above. Invite the learner to demonstrate what they learned — not a generic icebreaker or meta question about their approach. One sentence only. No preamble, no quotes, just the question.`,
      ),
      userMessage(`Generate the opening question for demonstrating learning about: ${target}`),
    ],
    { maxTokens: 120, temperature: 0.55, fetchTimeout: 30000 },
  );

  if (response.success && response.data?.trim()) {
    return response.data.trim();
  }

  return buildTapOpeningQuestionFallback(brief);
}
