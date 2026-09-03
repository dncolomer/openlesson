// Session plan persistence
import { createClient } from "@/lib/supabase/client";
import {
  type SessionPlan,
  type SessionPlanStep,
  validatePlanSteps,
} from "@/lib/domain/types";
import { normalizeUnusableCells } from "@/lib/map-ground-rules";

// ---- Session Plans (Session Planner feature) ----

 
function mapDbSessionPlan(p: any): SessionPlan {
  return {
    id: p.id,
    sessionId: p.session_id,
    userId: p.user_id,
    goal: p.goal,
    strategy: p.strategy || "",
    description: p.description ?? undefined,
    steps: (p.steps || []) as SessionPlanStep[],
    currentStepIndex: p.current_step_index || 0,
    unusable_cells: normalizeUnusableCells(p.unusable_cells),
    createdAt: p.created_at,
    updatedAt: p.updated_at,
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
   
  supabaseClient?: any,
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

  // Upsert on session_id: ILE/confirm can race (double-click, Strict Mode, or
  // force:true while an empty shell already exists) and hit
  // session_plans_session_id_key on a plain insert.
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

  const { data, error } = await supabase
    .from("session_plans")
    .upsert(row, { onConflict: "session_id" })
    .select()
    .single();

  if (!error && data) return mapDbSessionPlan(data);

  // Fallback: unique race / older clients — update existing row by session_id.
  const isDuplicate =
    error?.code === "23505" ||
    (typeof error?.message === "string" &&
      error.message.includes("session_plans_session_id_key"));
  if (isDuplicate || error) {
    const { data: updated, error: updateError } = await supabase
      .from("session_plans")
      .update({
        user_id: userId,
        goal: plan.goal,
        strategy: plan.strategy,
        description: plan.description || null,
        steps: plan.steps,
        current_step_index: 0,
        unusable_cells: normalizeUnusableCells(plan.unusable_cells),
        updated_at: new Date().toISOString(),
      })
      .eq("session_id", sessionId)
      .select()
      .single();
    if (!updateError && updated) return mapDbSessionPlan(updated);
    throw new Error(
      updateError?.message || error?.message || "Failed to create session plan",
    );
  }

  throw new Error(error?.message || "Failed to create session plan");
}

export async function getSessionPlan(
  sessionId: string,
   
  supabaseClient?: any
): Promise<SessionPlan | null> {
  const supabase = supabaseClient || createClient();

  const { data, error } = await supabase
    .from("session_plans")
    .select("*")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (error || !data) return null;
  return mapDbSessionPlan(data);
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
  const rec = row as { id?: unknown; steps?: unknown; step_count?: unknown };
  if (Array.isArray(rec.steps)) return rec.steps.length > 0;
  if (typeof rec.step_count === "number") return rec.step_count > 0;
  return typeof rec.id === "string" && rec.id.length > 0;
}

/**
 * Cheap query: does this session already have chapters?
 * Selects only `id` and excludes empty `steps` shells. Does not transfer
 * the full plan / steps JSON.
 */
export function sessionPlanHasChaptersQuery(supabaseClient: any, sessionId: string) {
  return supabaseClient
    .from("session_plans")
    .select(SESSION_PLAN_HAS_CHAPTERS_SELECT)
    .eq("session_id", sessionId)
    .not("steps", "eq", SESSION_PLAN_EMPTY_STEPS_JSON);
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
  supabaseClient: any,
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
  supabaseClient?: any,
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
  supabaseClient?: any,
): Promise<void> {
  const id = String(sessionId || "").trim();
  if (!id) return;
  const supabase = supabaseClient || createClient();
  const { error } = await supabase
    .from("session_plans")
    .delete()
    .eq("session_id", id);
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
   
  supabaseClient?: any
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

  const { data, error } = await supabase
    .from("session_plans")
    .update(updateData)
    .eq("id", workspaceId)
    .select()
    .single();

  if (error || !data) throw new Error(error?.message || "Failed to update session plan");
  return mapDbSessionPlan(data);
}

