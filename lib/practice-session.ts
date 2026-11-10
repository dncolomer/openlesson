/**
 * Mint or reuse a per-user Solve flow for a catalog problem,
 * then start a Solve work session.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { SOLVE_FLOWS_TABLE } from "@/lib/core-tables";
import {
  PRACTICE_PROBLEMS_TABLE,
  practiceDurationMs,
  practiceFlowMatchesProblem,
  practiceIdentityForUser,
  practiceSessionHref,
  practiceSessionMetadata,
  presentPracticeHistoryRow,
  presentPracticeInsight,
  presentPracticeProblem,
  summarizePracticeHistory,
  type PracticeHistoryRow,
  type PracticeHistorySummary,
  type PracticeInsight,
  type PracticeProblem,
} from "@/lib/practice-problems";
import { productFlowPagePath } from "@/lib/product-flow";
import {
  createSolvePublicToken,
  type SolveFlow,
} from "@/lib/solve-flow";
import { runSolveCommand, getSolveFlowById } from "@/lib/solve-flow-repository";
import {
  createVerificationPublicToken,
  type VerificationFlow,
} from "@/lib/verification-flow";
import {
  listVerificationFlowsForOwnerUserId,
  runVerificationCommand,
} from "@/lib/verification-flow-repository";
import {
  createCalibrationPublicToken,
  type CalibrationFlow,
} from "@/lib/calibration-flow";
import {
  listCalibrationFlowsForOwnerUserId,
  runCalibrationCommand,
} from "@/lib/calibration-flow-repository";
import { flowCountdownMinutes } from "@/lib/flow-countdown";

export async function loadPublishedPracticeProblem(
  problemId: string,
): Promise<PracticeProblem | null> {
  const id = String(problemId || "").trim();
  if (!id) return null;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from(PRACTICE_PROBLEMS_TABLE)
    .select("*")
    .eq("id", id)
    .eq("published", true)
    .maybeSingle();
  if (error || !data) return null;
  return presentPracticeProblem(data as Record<string, unknown>);
}

export async function listPublishedPracticeProblems(): Promise<PracticeProblem[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from(PRACTICE_PROBLEMS_TABLE)
    .select("*")
    .eq("published", true)
    .order("sort_order", { ascending: true });
  if (error || !Array.isArray(data)) return [];
  return data
    .map((row) => presentPracticeProblem(row as Record<string, unknown>))
    .filter((row): row is PracticeProblem => Boolean(row));
}

export async function findPracticeSolveFlow(input: {
  ownerUserId: string;
  problemId: string;
}): Promise<SolveFlow | null> {
  const ownerUserId = String(input.ownerUserId || "").trim();
  const problemId = String(input.problemId || "").trim();
  if (!ownerUserId || !problemId) return null;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from(SOLVE_FLOWS_TABLE)
    .select("id")
    .eq("owner_user_id", ownerUserId)
    .eq("practice_problem_id", problemId)
    .maybeSingle();
  if (error || !data?.id) return null;
  return getSolveFlowById(String(data.id));
}

export async function ensurePracticeSolveFlow(input: {
  ownerUserId: string;
  problem: PracticeProblem;
}): Promise<SolveFlow> {
  const existing = await findPracticeSolveFlow({
    ownerUserId: input.ownerUserId,
    problemId: input.problem.id,
  });
  if (existing) {
    const topicChanged = existing.topic !== input.problem.prompt || existing.name !== input.problem.title;
    if (!topicChanged) return existing;
    const updated = await runSolveCommand({
      type: "update",
      ownerUserId: input.ownerUserId,
      flowId: existing.id,
      name: input.problem.title,
      topic: input.problem.prompt,
      durationMinutes: flowCountdownMinutes(input.problem.durationMinutes),
    });
    if (updated.ok && updated.flow) return updated.flow;
    return existing;
  }

  try {
    const created = await runSolveCommand({
      type: "create",
      ownerUserId: input.ownerUserId,
      name: input.problem.title,
      topic: input.problem.prompt,
      durationMinutes: flowCountdownMinutes(input.problem.durationMinutes),
      practiceProblemId: input.problem.id,
      publicToken: createSolvePublicToken(),
    });
    if (created.ok && created.flow) return created.flow;
    const raced = await findPracticeSolveFlow({
      ownerUserId: input.ownerUserId,
      problemId: input.problem.id,
    });
    if (raced) return raced;
    throw new Error(created.ok ? "Failed to create practice flow" : created.reason);
  } catch (error) {
    const raced = await findPracticeSolveFlow({
      ownerUserId: input.ownerUserId,
      problemId: input.problem.id,
    });
    if (raced) return raced;
    throw error;
  }
}

export function practiceSessionInsert(input: {
  userId: string;
  flow: SolveFlow;
  problem: PracticeProblem;
}): Record<string, unknown> {
  const identity = practiceIdentityForUser(input.userId);
  const metadata = practiceSessionMetadata({
    problemId: input.problem.id,
    flowId: input.flow.id,
    title: input.problem.title,
    userId: input.userId,
  });
  return {
    kind: "solve",
    problem: input.problem.prompt,
    status: "active",
    user_id: input.userId,
    solve_flow_id: input.flow.id,
    identity,
    result: { kind: "solve", projectedPolicy: null },
    metadata,
  };
}

export function practiceStartPayload(sessionId: string): {
  sessionId: string;
  href: string;
} {
  return {
    sessionId,
    href: practiceSessionHref(sessionId),
  };
}

export async function ensurePracticeVerificationFlow(input: {
  ownerUserId: string;
  problem: PracticeProblem;
}): Promise<VerificationFlow> {
  const listed = await listVerificationFlowsForOwnerUserId(input.ownerUserId);
  const existing = listed.find((flow) => practiceFlowMatchesProblem(flow, input.problem));
  if (existing) return existing;
  const created = await runVerificationCommand({
    type: "create",
    ownerUserId: input.ownerUserId,
    name: input.problem.title,
    topic: input.problem.prompt,
    problem: input.problem.prompt,
    durationMinutes: flowCountdownMinutes(input.problem.durationMinutes),
    publicToken: createVerificationPublicToken(),
  });
  if (created.ok && created.flow) return created.flow;
  throw new Error(created.ok ? "Failed to create verification flow" : created.reason);
}

export async function ensurePracticeCalibrationFlow(input: {
  ownerUserId: string;
  problem: PracticeProblem;
}): Promise<CalibrationFlow> {
  const listed = await listCalibrationFlowsForOwnerUserId(input.ownerUserId);
  const existing = listed.find((flow) => practiceFlowMatchesProblem(flow, input.problem));
  if (existing) return existing;
  const created = await runCalibrationCommand({
    type: "create",
    ownerUserId: input.ownerUserId,
    name: input.problem.title,
    topic: input.problem.prompt,
    problem: input.problem.prompt,
    goal: input.problem.prompt,
    durationMinutes: flowCountdownMinutes(input.problem.durationMinutes),
    publicToken: createCalibrationPublicToken(),
  });
  if (created.ok && created.flow) return created.flow;
  throw new Error(created.ok ? "Failed to create calibration flow" : created.reason);
}

export function practiceCreatedFlowPayload(
  kind: "verification" | "calibration",
  flowId: string,
): { flowId: string; href: string; kind: "verification" | "calibration" } {
  return {
    kind,
    flowId,
    href: productFlowPagePath(kind, flowId),
  };
}

export async function loadPracticeHistory(ownerUserId: string): Promise<{
  rows: PracticeHistoryRow[];
  summary: PracticeHistorySummary;
  insights: PracticeInsight[];
}> {
  const userId = String(ownerUserId || "").trim();
  if (!userId) {
    return { rows: [], summary: summarizePracticeHistory([]), insights: [] };
  }
  const supabase = createAdminClient();
  const { data: sessionRows, error } = await supabase
    .from("sessions")
    .select("id, status, created_at, ended_at, duration_ms, solve_flow_id")
    .eq("user_id", userId)
    .eq("kind", "solve")
    .not("solve_flow_id", "is", null)
    .order("created_at", { ascending: false });
  if (error || !Array.isArray(sessionRows) || sessionRows.length === 0) {
    return { rows: [], summary: summarizePracticeHistory([]), insights: [] };
  }

  const flowIds = [
    ...new Set(
      sessionRows
        .map((row) => String((row as { solve_flow_id?: unknown }).solve_flow_id || "").trim())
        .filter(Boolean),
    ),
  ];
  const { data: flowRows } = await supabase
    .from(SOLVE_FLOWS_TABLE)
    .select("id, practice_problem_id")
    .in("id", flowIds)
    .not("practice_problem_id", "is", null);
  const problemIdByFlow = new Map<string, string>();
  for (const row of flowRows || []) {
    const flowId = String((row as { id?: unknown }).id || "").trim();
    const problemId = String(
      (row as { practice_problem_id?: unknown }).practice_problem_id || "",
    ).trim();
    if (flowId && problemId) problemIdByFlow.set(flowId, problemId);
  }
  const problemIds = [...new Set(problemIdByFlow.values())];
  const { data: problemRows } = problemIds.length
    ? await supabase
        .from(PRACTICE_PROBLEMS_TABLE)
        .select("id, title, category, subcategory")
        .in("id", problemIds)
    : { data: [] as Record<string, unknown>[] };
  const problemById = new Map<string, Record<string, unknown>>();
  for (const row of problemRows || []) {
    const rec = row as Record<string, unknown>;
    const id = String(rec.id || "").trim();
    if (id) problemById.set(id, rec);
  }

  const parsed = sessionRows
    .map((row) => {
      const rec = row as Record<string, unknown>;
      const flowId = String(rec.solve_flow_id || "").trim();
      const problemId = problemIdByFlow.get(flowId) || "";
      const problem = problemById.get(problemId);
      if (!problem) return null;
      return presentPracticeHistoryRow({
        sessionId: rec.id,
        flowId,
        problemId,
        title: problem.title,
        category: problem.category,
        subcategory: problem.subcategory,
        startedAt: rec.created_at,
        endedAt: rec.ended_at,
        durationMs: practiceDurationMs(rec),
        status: rec.status,
      });
    })
    .filter((row): row is PracticeHistoryRow => Boolean(row));

  const sessionIds = parsed.map((row) => row.sessionId);
  const sessionById = new Map(parsed.map((row) => [row.sessionId, row]));
  const insightCounts = new Map<string, number>();
  const insights: PracticeInsight[] = [];
  if (sessionIds.length > 0) {
    const { data: insightRows } = await supabase
      .from("insights")
      .select("id, session_id, title, summary, created_at, session_elapsed_ms, aesthetic_image")
      .eq("user_id", userId)
      .in("session_id", sessionIds)
      .is("archived_at", null)
      .order("created_at", { ascending: false });
    for (const row of insightRows || []) {
      const rec = row as Record<string, unknown>;
      const sessionId = String(rec.session_id || "").trim();
      const session = sessionById.get(sessionId);
      if (!session) continue;
      insightCounts.set(sessionId, (insightCounts.get(sessionId) || 0) + 1);
      const insight = presentPracticeInsight({
        id: rec.id,
        sessionId,
        problemId: session.problemId,
        problemTitle: session.title,
        title: rec.title,
        summary: rec.summary,
        createdAt: rec.created_at,
        sessionElapsedMs: rec.session_elapsed_ms,
        aestheticImage: rec.aesthetic_image,
      });
      if (insight) insights.push(insight);
    }
  }

  const rows = parsed.map((row) => ({
    ...row,
    insightCount: insightCounts.get(row.sessionId) || 0,
  }));
  return { rows, summary: summarizePracticeHistory(rows), insights };
}

export async function listPracticeSolveFlowIds(ownerUserId: string): Promise<string[]> {
  const userId = String(ownerUserId || "").trim();
  if (!userId) return [];
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from(SOLVE_FLOWS_TABLE)
    .select("id")
    .eq("owner_user_id", userId)
    .not("practice_problem_id", "is", null);
  if (error || !Array.isArray(data)) return [];
  return data.map((row) => String(row.id || "").trim()).filter(Boolean);
}
