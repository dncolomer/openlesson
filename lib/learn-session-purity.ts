import type { SupabaseClient } from "@supabase/supabase-js";
import { queryWorkspaceProofOfWorkRows } from "@/lib/pow-api/workspace-proof-of-work";
import { withImpurePoWData } from "@/lib/tap-session-purity";

/**
 * Flag every PoW row for a Learn session as impure inside `metadata`
 * (no new DB column). Patches by `session_id`.
 */
export async function flagIleSessionProofOfWorkImpure(
  supabase: SupabaseClient,
  workspaceId: string | null | undefined,
  sessionId: string,
): Promise<number> {
  let query = supabase
    .from("proof_of_work")
    .select("id, metadata")
    .eq("session_id", sessionId);
  const scopedWorkspaceId = String(workspaceId || "").trim();
  if (scopedWorkspaceId) query = query.eq("workspace_id", scopedWorkspaceId);

  const { data, error } = await queryWorkspaceProofOfWorkRows<{
    id: string;
    metadata: Record<string, unknown> | null;
  }>(query);

  if (error) throw new Error(error.message);
  if (!data.length) return 0;

  let updated = 0;
  for (const row of data) {
    const nextMetadata = withImpurePoWData({
      ...(row.metadata && typeof row.metadata === "object" ? row.metadata : {}),
    });
    let update = supabase.from("proof_of_work").update({ metadata: nextMetadata }).eq("id", row.id);
    if (scopedWorkspaceId) update = update.eq("workspace_id", scopedWorkspaceId);
    const { error: updateError } = await update;
    if (!updateError) updated += 1;
  }
  return updated;
}
