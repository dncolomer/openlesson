// Session plan persistence
import { createClient } from "@/lib/supabase/client";
import {
  type SessionPlan,
  type SessionPlanStep,
  validatePlanSteps,
} from "@/lib/domain/types";

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
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  };
}

export async function createSessionPlan(
  sessionId: string,
  plan: { goal: string; strategy: string; description?: string; steps: SessionPlanStep[] },
   
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

  const { data, error } = await supabase
    .from("session_plans")
    .insert({
      session_id: sessionId,
      user_id: userId,
      goal: plan.goal,
      strategy: plan.strategy,
      description: plan.description || null,
      steps: plan.steps,
      current_step_index: 0,
    })
    .select()
    .single();

  if (error || !data) throw new Error(error?.message || "Failed to create session plan");
  return mapDbSessionPlan(data);
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

export async function updateSessionPlan(
  workspaceId: string,
  updates: {
    goal?: string;
    strategy?: string;
    steps?: SessionPlanStep[];
    currentStepIndex?: number;
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

  const { data, error } = await supabase
    .from("session_plans")
    .update(updateData)
    .eq("id", workspaceId)
    .select()
    .single();

  if (error || !data) throw new Error(error?.message || "Failed to update session plan");
  return mapDbSessionPlan(data);
}

