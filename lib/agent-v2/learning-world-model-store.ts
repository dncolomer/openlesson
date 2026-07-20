/**
 * Durable learning world model load / merge / save (workspace × subject).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  emptyLearningWorldModel,
  mergeLearningWorldModelDelta,
  parseLearningWorldModel,
  type LearningWorldModelDelta,
  type LearningWorldModelV0,
} from "@/lib/prompt-kernel/world-model";
import type { KnowledgeConfigSubject } from "@/lib/knowledge-config/types";

export interface SubjectRef {
  user_id?: string | null;
  guest_user_id?: string | null;
}

export function normalizeSubject(subject?: SubjectRef | null): {
  subject_user_id: string | null;
  subject_guest_user_id: string | null;
  subject: KnowledgeConfigSubject | undefined;
} {
  const user_id = subject?.user_id?.trim() || null;
  const guest_user_id = subject?.guest_user_id?.trim() || null;
  // Prefer guest when both set (guest keys).
  if (guest_user_id) {
    return {
      subject_user_id: null,
      subject_guest_user_id: guest_user_id,
      subject: { guest_user_id },
    };
  }
  if (user_id) {
    return {
      subject_user_id: user_id,
      subject_guest_user_id: null,
      subject: { user_id },
    };
  }
  return {
    subject_user_id: null,
    subject_guest_user_id: null,
    subject: undefined,
  };
}

/** Resolve subject from score participant overrides or auth context. */
export function subjectFromAuthAndParticipants(options: {
  authUserId?: string | null;
  authGuestUserId?: string | null;
  participantUserId?: string | null;
  participantGuestUserId?: string | null;
}): SubjectRef {
  if (options.participantGuestUserId) {
    return { guest_user_id: options.participantGuestUserId };
  }
  if (options.participantUserId) {
    return { user_id: options.participantUserId };
  }
  if (options.authGuestUserId) {
    return { guest_user_id: options.authGuestUserId };
  }
  if (options.authUserId) {
    return { user_id: options.authUserId };
  }
  return {};
}

export async function loadLearningWorldModel(
  supabase: SupabaseClient,
  workspaceId: string,
  subject?: SubjectRef | null,
): Promise<{ id: string | null; model: LearningWorldModelV0 }> {
  const { subject_user_id, subject_guest_user_id, subject: subj } = normalizeSubject(subject);

  let query = supabase
    .from("learning_world_models")
    .select("id, model, updated_at")
    .eq("workspace_id", workspaceId);

  if (subject_guest_user_id) {
    query = query.eq("subject_guest_user_id", subject_guest_user_id).is("subject_user_id", null);
  } else if (subject_user_id) {
    query = query.eq("subject_user_id", subject_user_id).is("subject_guest_user_id", null);
  } else {
    query = query.is("subject_user_id", null).is("subject_guest_user_id", null);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    // Table may not exist yet in some envs — fall back to empty.
    console.warn("[learning-world-model-store] load failed:", error.message);
    return { id: null, model: emptyLearningWorldModel(workspaceId, subj) };
  }

  if (!data?.model) {
    return { id: null, model: emptyLearningWorldModel(workspaceId, subj) };
  }

  const parsed = parseLearningWorldModel(data.model);
  if (!parsed) {
    return { id: data.id as string, model: emptyLearningWorldModel(workspaceId, subj) };
  }
  if (subj && !parsed.subject) {
    parsed.subject = subj;
  }
  return { id: data.id as string, model: parsed };
}

export async function saveLearningWorldModel(
  supabase: SupabaseClient,
  workspaceId: string,
  model: LearningWorldModelV0,
  subject?: SubjectRef | null,
): Promise<{ id: string | null; model: LearningWorldModelV0 }> {
  const { subject_user_id, subject_guest_user_id, subject: subj } = normalizeSubject(
    subject ?? model.subject,
  );
  const toStore: LearningWorldModelV0 = {
    ...model,
    workspace_id: workspaceId,
    subject: subj ?? model.subject,
    updated_at: new Date().toISOString(),
  };

  const payload = {
    workspace_id: workspaceId,
    subject_user_id,
    subject_guest_user_id,
    model: toStore,
    updated_at: toStore.updated_at,
  };

  const { data, error } = await supabase
    .from("learning_world_models")
    .upsert(payload, {
      onConflict: "workspace_id,subject_user_id,subject_guest_user_id",
    })
    .select("id, model")
    .maybeSingle();

  if (error) {
    console.warn("[learning-world-model-store] save failed:", error.message);
    // Fallback: try select then insert/update manually for older PG without NULLS NOT DISTINCT unique
    return await saveLearningWorldModelFallback(supabase, workspaceId, toStore, {
      subject_user_id,
      subject_guest_user_id,
    });
  }

  return {
    id: (data?.id as string) ?? null,
    model: parseLearningWorldModel(data?.model) ?? toStore,
  };
}

async function saveLearningWorldModelFallback(
  supabase: SupabaseClient,
  workspaceId: string,
  model: LearningWorldModelV0,
  keys: { subject_user_id: string | null; subject_guest_user_id: string | null },
): Promise<{ id: string | null; model: LearningWorldModelV0 }> {
  const existing = await loadLearningWorldModel(supabase, workspaceId, {
    user_id: keys.subject_user_id,
    guest_user_id: keys.subject_guest_user_id,
  });

  if (existing.id) {
    const { data, error } = await supabase
      .from("learning_world_models")
      .update({ model, updated_at: model.updated_at })
      .eq("id", existing.id)
      .select("id")
      .maybeSingle();
    if (error) {
      console.warn("[learning-world-model-store] update failed:", error.message);
      return { id: existing.id, model };
    }
    return { id: (data?.id as string) ?? existing.id, model };
  }

  const { data, error } = await supabase
    .from("learning_world_models")
    .insert({
      workspace_id: workspaceId,
      subject_user_id: keys.subject_user_id,
      subject_guest_user_id: keys.subject_guest_user_id,
      model,
      updated_at: model.updated_at,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    console.warn("[learning-world-model-store] insert failed:", error.message);
    return { id: null, model };
  }
  return { id: (data?.id as string) ?? null, model };
}

export async function applyLearningWorldModelDelta(
  supabase: SupabaseClient,
  workspaceId: string,
  delta: LearningWorldModelDelta | null | undefined,
  subject?: SubjectRef | null,
): Promise<{ id: string | null; model: LearningWorldModelV0 }> {
  const loaded = await loadLearningWorldModel(supabase, workspaceId, subject);
  const merged = mergeLearningWorldModelDelta(loaded.model, delta);
  return saveLearningWorldModel(supabase, workspaceId, merged, subject);
}

/**
 * Load LWMs for an explicit multi-subject cohort (user group).
 * Returns one model per subject that has a row (missing subjects omitted).
 */
export async function loadLearningWorldModelsForSubjects(
  supabase: SupabaseClient,
  workspaceId: string,
  subjects: SubjectRef[],
): Promise<LearningWorldModelV0[]> {
  if (subjects.length === 0) return [];
  if (subjects.length === 1) {
    const one = await loadLearningWorldModel(supabase, workspaceId, subjects[0]);
    return [one.model];
  }

  const userIds = subjects.map((s) => s.user_id?.trim()).filter(Boolean) as string[];
  const guestIds = subjects.map((s) => s.guest_user_id?.trim()).filter(Boolean) as string[];
  if (userIds.length === 0 && guestIds.length === 0) return [];

  const orParts: string[] = [];
  if (userIds.length > 0) orParts.push(`subject_user_id.in.(${userIds.join(",")})`);
  if (guestIds.length > 0) orParts.push(`subject_guest_user_id.in.(${guestIds.join(",")})`);

  const { data, error } = await supabase
    .from("learning_world_models")
    .select("id, model, updated_at")
    .eq("workspace_id", workspaceId)
    .or(orParts.join(","));

  if (error) {
    console.warn("[learning-world-model-store] multi load failed:", error.message);
    return [];
  }

  const out: LearningWorldModelV0[] = [];
  for (const row of data || []) {
    const parsed = parseLearningWorldModel(row.model);
    if (parsed) out.push(parsed);
  }
  return out;
}

/** Load all LWMs for a workspace (scope=all). Caps to 200 rows. */
export async function loadAllLearningWorldModels(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<LearningWorldModelV0[]> {
  const { data, error } = await supabase
    .from("learning_world_models")
    .select("id, model, updated_at")
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false })
    .limit(200);

  if (error) {
    console.warn("[learning-world-model-store] load all failed:", error.message);
    return [];
  }

  const out: LearningWorldModelV0[] = [];
  for (const row of data || []) {
    const parsed = parseLearningWorldModel(row.model);
    if (parsed) out.push(parsed);
  }
  return out;
}
