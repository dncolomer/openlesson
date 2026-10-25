/**
 * Eval / knowledge distance / workspace link map for custom verification models.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  computeKnowledgeDistance,
  scoreAgainstCustomVerificationModel,
  type CustomVerificationScore,
  type CustomVerificationSubjectRef,
  type KnowledgeDistance,
  CustomVerificationModelError,
} from "@/lib/knowledge-config/custom-verification-model";
import { FLOW_EMBEDDING_MODEL_ID } from "@/lib/flow-embedding";
import {
  getCustomVerificationModel,
  loadLatestFlowVectorForSubject,
  rowToSpec,
  vectorForRegionModel,
  type CustomVerificationModelRow,
} from "@/lib/pow-api/custom-verification-model-crud";

export async function evalSubjectAgainstCustomVerificationModel(
  supabase: SupabaseClient,
  options: {
    workspaceId: string;
    modelId: string;
    subject: CustomVerificationSubjectRef;
  },
): Promise<{ score: CustomVerificationScore; model: CustomVerificationModelRow }> {
  const model = await getCustomVerificationModel(supabase, options.workspaceId, options.modelId);
  if (!model) {
    throw new CustomVerificationModelError("custom verification model not found");
  }

  const latest = await loadLatestFlowVectorForSubject(supabase, options.workspaceId, options.subject);
  if (!latest?.vector?.length) {
    throw new CustomVerificationModelError("subject has no flow embedding to evaluate");
  }

  const score = scoreAgainstCustomVerificationModel(
    vectorForRegionModel(latest, model.embedding_model_id),
    rowToSpec(model),
  );
  return { score, model };
}

/**
 * Knowledge distance for a subject vs a saved region.
 * Pure geometry load+compute from the latest flow embedding.
 */
export async function computeKnowledgeDistanceForSubject(
  supabase: SupabaseClient,
  options: {
    workspaceId: string;
    regionId: string;
    subject: CustomVerificationSubjectRef;
  },
): Promise<{
  knowledge_distance: KnowledgeDistance;
  region: CustomVerificationModelRow;
  subject: {
    user_id: string | null;
    guest_user_id: string | null;
    as_of_ms: number | null;
    embedding_model_id: string;
  };
}> {
  const region = await getCustomVerificationModel(supabase, options.workspaceId, options.regionId);
  if (!region) {
    throw new CustomVerificationModelError("knowledge region not found");
  }

  const latest = await loadLatestFlowVectorForSubject(supabase, options.workspaceId, options.subject);
  if (!latest?.vector?.length) {
    throw new CustomVerificationModelError("subject has no flow embedding for Knowledge distance");
  }

  const knowledge_distance = computeKnowledgeDistance(
    vectorForRegionModel(latest, region.embedding_model_id),
    rowToSpec(region),
  );
  return {
    knowledge_distance,
    region,
    subject: {
      user_id: options.subject.user_id ?? null,
      guest_user_id: options.subject.guest_user_id ?? null,
      as_of_ms: latest.as_of_ms ?? null,
      embedding_model_id: latest.embedding_model_id || FLOW_EMBEDDING_MODEL_ID,
    },
  };
}

/**
 * Build id → share URL map for TAP / TAP Learning links in a workspace.
 * Used so region-builder can filter by the same listable URLs operators copy.
 */
export async function buildWorkspaceLinkUrlMap(
  supabase: SupabaseClient,
  workspaceId: string,
  baseUrl: string = process.env.NEXT_PUBLIC_APP_URL || "https://uncertain.systems",
): Promise<Map<string, string>> {
  const { buildGuestLinkUrl } = await import("@/lib/guest-link-access");
  const map = new Map<string, string>();
  const base = (baseUrl || "").replace(/\/$/, "") || "https://uncertain.systems";

  const [calibrateRes, verifyRes, ileRes] = await Promise.all([
    supabase
      .from("workspace_calibrate_sessions")
      .select("id, public_token")
      .eq("workspace_id", workspaceId)
      .limit(500),
    supabase
      .from("workspace_verify_sessions")
      .select("id, public_token")
      .eq("workspace_id", workspaceId)
      .limit(500),
    supabase
      .from("workspace_learn_links")
      .select("id, public_token")
      .eq("workspace_id", workspaceId)
      .limit(500),
  ]);

  for (const row of calibrateRes.data || []) {
    const id = String((row as { id: string }).id);
    const tok = (row as { public_token?: string | null }).public_token;
    if (tok?.trim()) map.set(id, buildGuestLinkUrl(base, "calibrate", tok.trim(), "calibrate"));
  }
  for (const row of verifyRes.data || []) {
    const id = String((row as { id: string }).id);
    const tok = (row as { public_token?: string | null }).public_token;
    if (tok?.trim()) map.set(id, buildGuestLinkUrl(base, "verify", tok.trim()));
  }
  for (const row of ileRes.data || []) {
    const id = String((row as { id: string }).id);
    const tok = (row as { public_token?: string | null }).public_token;
    if (tok?.trim()) map.set(id, buildGuestLinkUrl(base, "ile", tok.trim()));
  }

  return map;
}
