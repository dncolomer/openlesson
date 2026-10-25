/**
 * Copy-Learning-to-Verification is gone. Verification flows are created via
 * POST /api/dashboard/flows — this path must not insert knowledge_region rows.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { AGENT_WORKSPACE_CREATE_REFUSED_MESSAGE } from "@/lib/workspace-kind";

export const COPY_LEARNING_TO_VERIFICATION_GONE_MESSAGE =
  AGENT_WORKSPACE_CREATE_REFUSED_MESSAGE;

export function workspaceAllowsCopyToVerification(_kind?: unknown): boolean {
  return false;
}

export async function copyLearningWorkspaceToVerification(
  _supabase: SupabaseClient,
  _options: { sourceWorkspaceId: string; ownerUserId: string; title: string },
): Promise<{ workspaceId: string }> {
  throw new Error(COPY_LEARNING_TO_VERIFICATION_GONE_MESSAGE);
}
