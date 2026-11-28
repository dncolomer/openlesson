// Session plan persistence
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import {
  type SessionPlan,
  type SessionPlanStep,
  validatePlanSteps,
} from "@/lib/domain/types";
import { normalizeUnusableCells } from "@/lib/map-ground-rules";

// ---- Session Plans (Session Planner feature) ----

function mapDbSessionPlan(p: Record<string, unknown>): SessionPlan {
  return {
    id: String(p.id ?? ""),
    sessionId: String(p.session_id ?? ""),
    userId: String(p.user_id ?? ""),
    goal: String(p.goal ?? ""),
    strategy: String(p.strategy ?? ""),
    description: p.description != null ? String(p.description) : undefined,
    steps: (Array.isArray(p.steps) ? p.steps : []) as SessionPlanStep[],
    currentStepIndex: Number(p.current_step_index ?? 0),
    unusable_cells: normalizeUnusableCells(p.unusable_cells),
    createdAt: String(p.created_at ?? ""),
    updatedAt: String(p.updated_at ?? ""),
  };
}

export async function createSessionPlan(
  sessionId: string,
  plan: {
    goal: string;
    strategy: string;
    description?: string;
    steps: SessionPlanStep[];
    unusable_cells?: Array<{ row: number; col: number }> | null;
  },
  supabaseClient?: SupabaseClient,
  options?: { userId?: string }
): Promise<SessionPlan> {
  // Validate steps before allowing any DB write
  validatePlanSteps(plan.steps);

  const supabase = supabaseClient || createClient();
  let userId = options?.userId;
  if (!userId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");
    userId = user.id;
  }

  // Persist the chapter map on the session row (no session_plans table).
  const row = {
    session_id: sessionId,
    user_id: userId,
    goal: plan.goal,
    strategy: plan.strategy,
    description: plan.description || null,
    steps: plan.steps,
    current_step_index: 0,
    unusable_cells: normalizeUnusableCells(plan.unusable_cells),
    updated_at: new Date().toISOString(),
  };

  const chapterMap = {
    id: sessionId,
    ...row,
  };
  const { data: sessionRow, error } = await supabase
    .from("sessions")
    .update({ chapter_map: chapterMap })
    .eq("id", sessionId)
    .select("id, user_id, chapter_map")
    .single();
  const data = sessionRow
    ? { ...(sessionRow.chapter_map as Record<string, unknown>), session_id: sessionRow.id, user_id: sessionRow.user_id }
    : null;

  if (!error && data) return mapDbSessionPlan(data);
  throw new Error(error?.message || "Failed to create session plan");
}

export async function getSessionPlan(
  sessionId: string,
  supabaseClient?: SupabaseClient
): Promise<SessionPlan | null> {
  const supabase = supabaseClient || createClient();

  const { data, error } = await supabase
    .from("sessions")
    .select("id, user_id, chapter_map")
    .eq("id", sessionId)
    .maybeSingle();

  if (error || !data?.chapter_map) return null;
  return mapDbSessionPlan({
    ...(data.chapter_map as Record<string, unknown>),
    session_id: data.id,
    user_id: data.user_id,
  });
}

/** Existence-check projection: never `*` and never the `steps` JSON array. */
export const SESSION_PLAN_HAS_CHAPTERS_SELECT = "id";

/** Empty JSONB array — used to exclude shell plans that have no chapters. */
export const SESSION_PLAN_EMPTY_STEPS_JSON = "[]";

/**
 * Interpret a cheap existence row. Empty `steps` shells are "no chapters"
 * even if a row was returned. A projected `{ id }` after the empty-array
 * filter means the plan has at least one step.
 */
export function sessionPlanHasChaptersFromRow(row: unknown): boolean {
  if (!row || typeof row !== "object") return false;
  const rec = row as { id?: unknown; steps?: unknown; step_count?: unknown; chapter_map?: unknown };
  const map =
    rec.chapter_map && typeof rec.chapter_map === "object"
      ? (rec.chapter_map as { steps?: unknown; step_count?: unknown })
      : rec;
  if (Array.isArray(map.steps)) return map.steps.length > 0;
  if (typeof map.step_count === "number") return map.step_count > 0;
  if (rec.chapter_map && typeof rec.chapter_map === "object") return true;
  return typeof rec.id === "string" && rec.id.length > 0;
}

export type SessionPlanChaptersQueryBuilder = {
  select: (columns: string) => {
    eq: (column: string, value: string) => {
      not: (column: string, operator: string, value: unknown) => {
        maybeSingle: () => PromiseLike<{ data: unknown; error: unknown }>;
      };
    };
  };
};

export type SessionPlanChaptersClient = {
  from: (table: string) => SessionPlanChaptersQueryBuilder;
};

/**
 * Cheap query: does this session already have chapters?
 * Selects only `id` and excludes empty `steps` shells. Does not transfer
 * the full plan / steps JSON.
 */
export function sessionPlanHasChaptersQuery(
  supabaseClient: SupabaseClient | SessionPlanChaptersClient,
  sessionId: string,
) {
  return (supabaseClient as SessionPlanChaptersClient)
    .from("sessions")
    .select("id, chapter_map")
    .eq("id", sessionId)
    .not("chapter_map", "is", null);
}

/** Cheap existence outcome. Query `error` is `failed`, never “no chapters”. */
export type SessionPlanChaptersStatus = "exists" | "empty" | "failed";

/**
 * Interpret a cheap existence query. Successful no-row and empty-`steps`
 * shells are `empty`. Transport / PostgREST `error` is `failed`.
 */
export function sessionPlanChaptersStatusFromResult(result: {
  data: unknown;
  error: unknown;
}): SessionPlanChaptersStatus {
  if (result.error) return "failed";
  if (!result.data) return "empty";
  return sessionPlanHasChaptersFromRow(result.data) ? "exists" : "empty";
}

/**
 * Cheap existence lookup. `supabaseClient` is required so callers (API
 * `guardSessionRoute`) cannot silently fall back to the browser anon client.
 */
export async function sessionPlanChaptersStatus(
  sessionId: string,
  supabaseClient: SupabaseClient | SessionPlanChaptersClient | null | undefined,
): Promise<SessionPlanChaptersStatus> {
  if (!supabaseClient) return "failed";
  try {
    const { data, error } = await sessionPlanHasChaptersQuery(
      supabaseClient,
      sessionId,
    ).maybeSingle();
    return sessionPlanChaptersStatusFromResult({ data, error });
  } catch {
    return "failed";
  }
}

export async function sessionPlanHasChapters(
  sessionId: string,
  supabaseClient?: SupabaseClient | SessionPlanChaptersClient,
): Promise<boolean> {
  const status = await sessionPlanChaptersStatus(
    sessionId,
    supabaseClient || createClient(),
  );
  return status === "exists";
}

/** Drop the chapter map for a session. Does not touch Proof of Work. */
export async function deleteSessionPlanBySessionId(
  sessionId: string,
  supabaseClient?: SupabaseClient,
): Promise<void> {
  const id = String(sessionId || "").trim();
  if (!id) return;
  const supabase = supabaseClient || createClient();
  const { error } = await supabase
    .from("sessions")
    .update({ chapter_map: null })
    .eq("id", id);
  if (error) throw new Error(error.message || "Failed to delete session plan");
}

export async function updateSessionPlan(
  workspaceId: string,
  updates: {
    goal?: string;
    strategy?: string;
    steps?: SessionPlanStep[];
    currentStepIndex?: number;
    unusable_cells?: Array<{ row: number; col: number }> | null;
  },
  supabaseClient?: SupabaseClient
): Promise<SessionPlan> {
  const supabase = supabaseClient || createClient();

  // Validate steps before allowing any DB write
  if (updates.steps !== undefined) {
    validatePlanSteps(updates.steps);
  }

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (updates.goal !== undefined) updateData.goal = updates.goal;
  if (updates.strategy !== undefined) updateData.strategy = updates.strategy;
  if (updates.steps !== undefined) updateData.steps = updates.steps;
  if (updates.currentStepIndex !== undefined) updateData.current_step_index = updates.currentStepIndex;
  if (updates.unusable_cells !== undefined) {
    updateData.unusable_cells = normalizeUnusableCells(updates.unusable_cells);
  }

  const { data: sessionRow, error } = await supabase
    .from("sessions")
    .select("id, user_id, chapter_map")
    .eq("id", workspaceId)
    .maybeSingle();
  if (error || !sessionRow?.chapter_map) {
    throw new Error(error?.message || "Failed to update session plan");
  }
  const next = { ...(sessionRow.chapter_map as Record<string, unknown>), ...updateData };
  const { data: updated, error: updateError } = await supabase
    .from("sessions")
    .update({ chapter_map: next })
    .eq("id", workspaceId)
    .select("id, user_id, chapter_map")
    .single();
  const data = updated
    ? { ...(updated.chapter_map as Record<string, unknown>), session_id: updated.id, user_id: updated.user_id }
    : null;

  if (updateError || !data) throw new Error(updateError?.message || "Failed to update session plan");
  return mapDbSessionPlan(data);
}

