import { createClient } from "@/lib/supabase/server";

export type TeachBackMode = "curious" | "skeptical" | "practical" | "fast";

export interface TeachBackBrief {
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
    node_title: string | null;
    problem: string | null;
    status: string | null;
    report: string | null;
  }>;
}

export function listenerStyle(mode: TeachBackMode) {
  switch (mode) {
    case "skeptical":
      return "a skeptical friend who challenges vague claims and asks why the explanation follows";
    case "practical":
      return "a practical learner who keeps asking for examples, use cases, and consequences";
    case "fast":
      return "a fast learner who quickly asks deeper connection questions once the basics are clear";
    case "curious":
    default:
      return "a curious beginner who asks simple clarifying questions when terms or assumptions are skipped";
  }
}

export async function getTeachBackBrief(planId: string, focusNodeIds: string[] = []) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: plan, error: planError } = await supabase
    .from("learning_plans")
    .select("id, user_id, title, root_topic, description, notes, is_public, is_group")
    .eq("id", planId)
    .single();

  if (planError || !plan) throw new Error("Workspace not found");
  if (!plan.is_public && !plan.is_group && plan.user_id !== user.id) {
    throw new Error("Not authorized");
  }

  let nodesQuery = supabase
    .from("plan_nodes")
    .select("id, title, description, status")
    .eq("plan_id", planId)
    .order("created_at", { ascending: true });

  if (focusNodeIds.length > 0) {
    nodesQuery = nodesQuery.in("id", focusNodeIds);
  }

  const { data: nodes } = await nodesQuery;
  const nodeIds = (nodes || []).map((node) => node.id);

  const { data: planNodeSessions } = nodeIds.length > 0
    ? await supabase
      .from("plan_node_sessions")
      .select("session_id, plan_node_id, plan_nodes:title")
      .eq("plan_id", planId)
      .eq("user_id", user.id)
      .in("plan_node_id", nodeIds)
    : { data: [] };

  const sessionIds = Array.from(new Set((planNodeSessions || []).map((row: any) => row.session_id).filter(Boolean)));
  const { data: sessions } = sessionIds.length > 0
    ? await supabase
      .from("sessions")
      .select("id, problem, status, report")
      .in("id", sessionIds)
      .eq("user_id", user.id)
    : { data: [] };

  const nodeTitleBySessionId = new Map(
    (planNodeSessions || []).map((row: any) => [row.session_id, row.plan_nodes?.title || null])
  );

  return {
    userId: user.id,
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
        node_title: nodeTitleBySessionId.get(session.id) || null,
        problem: session.problem,
        status: session.status,
        report: session.report,
      })),
    } satisfies TeachBackBrief,
  };
}

export function buildTeachBackInstructions(brief: TeachBackBrief, mode: TeachBackMode, minutes: number) {
  const nodeSummary = brief.nodes
    .map((node, index) => `${index + 1}. ${node.title}${node.status ? ` (${node.status})` : ""}: ${node.description || "No description"}`)
    .join("\n");

  const sessionSummary = brief.sessions
    .map((session, index) => `${index + 1}. ${session.node_title || session.problem || "Session"}: ${session.report ? session.report.slice(0, 1200) : "No report yet"}`)
    .join("\n\n");

  return `You are the Teach Back listener for OpenLesson.

The user is teaching you their workspace. You are not an examiner, interviewer, or tutor. You are ${listenerStyle(mode)}.

Your job is to help the user clarify their understanding by making them teach the material out loud.

Rules:
- Ask one short spoken question at a time.
- Do not lecture unless the user explicitly asks for help.
- Act like you do not know the subject yet, but use the hidden workspace context to notice gaps.
- Ask for definitions when the user uses terms too quickly.
- Ask for concrete examples when explanations are abstract.
- Ask how ideas connect across workspace sessions.
- Gently paraphrase your understanding and ask if you got it right.
- Avoid grades, scores, and exam language.
- Never say "correct" or "incorrect". Use phrases like "I think I follow" or "Can you sharpen that part?".
- Keep responses concise and conversational.
- When the user is silent or vague, ask a clarifying question instead of filling in the answer.
- The session is timeboxed to ${minutes} minutes.

Start by saying: "I'm new to this. Can you teach me what this workspace is about?"

Workspace:
Title: ${brief.plan.title}
Topic: ${brief.plan.root_topic}
Description: ${brief.plan.description || "None"}
Notes: ${brief.plan.notes || "None"}

Workspace sessions/nodes:
${nodeSummary || "No nodes found."}

User session context:
${sessionSummary || "No completed session reports found yet."}`;
}
