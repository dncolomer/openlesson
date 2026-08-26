/**
 * Snapshot a TAPBench guest run (64D knowledge-config). Does not build a region.
 * One guest = one run = one snapshot, from PoW stored as that guest_user_id.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthContext } from "@/lib/pow-api/types";
import type { PowFeatureRow } from "@/lib/knowledge-config";
import { sourceLinkIdFromMetadata } from "@/lib/pow-api/tapbench";
import { toolingFromPowMetadata } from "./tooling";
import { snapshotTapbenchPowPayload, type TapbenchWrapResult } from "./wrap";
import { persistTapbenchParticipantEmbedding } from "./store-supabase";
import type { TapbenchIssuedKey } from "./keys";

export async function loadTapbenchSessionPowRows(
  supabase: SupabaseClient,
  workspaceId: string,
  options: { guestUserId?: string | null; keyId?: string | null },
): Promise<PowFeatureRow[]> {
  let query = supabase
    .from("workspace_proof_of_work")
    .select(
      "id, proof_of_work_type, timestamp_ms, tool_name, tool_action, metadata, block_id, guest_user_id",
    )
    .eq("workspace_id", workspaceId)
    .order("timestamp_ms", { ascending: true });
  if (options.guestUserId) {
    query = query.eq("guest_user_id", options.guestUserId);
  }
  const { data, error } = await query;
  if (error || !data) return [];
  const rows: PowFeatureRow[] = [];
  for (const raw of data) {
    const rec = raw as Record<string, unknown>;
    const metadata =
      rec.metadata && typeof rec.metadata === "object" && !Array.isArray(rec.metadata)
        ? (rec.metadata as Record<string, unknown>)
        : {};
    if (options.guestUserId) {
      const metaGuest =
        typeof metadata.guest_user_id === "string"
          ? metadata.guest_user_id
          : typeof metadata.tapbench_guest_id === "string"
            ? metadata.tapbench_guest_id
            : null;
      const rowGuest = typeof rec.guest_user_id === "string" ? rec.guest_user_id : null;
      if (rowGuest !== options.guestUserId && metaGuest !== options.guestUserId) continue;
    } else if (options.keyId && sourceLinkIdFromMetadata(metadata) !== options.keyId) {
      continue;
    }
    rows.push({
      proof_of_work_type: String(rec.proof_of_work_type || "tool"),
      timestamp_ms: typeof rec.timestamp_ms === "number" ? rec.timestamp_ms : Date.now(),
      tool_name: typeof rec.tool_name === "string" ? rec.tool_name : null,
      tool_action: typeof rec.tool_action === "string" ? rec.tool_action : null,
      block_id: typeof rec.block_id === "string" ? rec.block_id : null,
      metadata,
    });
  }
  return rows;
}

export async function snapshotTapbenchSession(options: {
  auth: AuthContext;
  supabase: SupabaseClient;
  workspaceId: string;
  guestUserId: string;
}): Promise<TapbenchWrapResult | null> {
  const workspaceId = options.auth.tapbench_workspace_id;
  const keyId = options.auth.key_id;
  const guestUserId = options.guestUserId.trim();
  if (!workspaceId || workspaceId !== options.workspaceId || !keyId || !guestUserId) {
    return null;
  }

  const powRows = await loadTapbenchSessionPowRows(options.supabase, workspaceId, {
    guestUserId,
  });
  if (!powRows.length) return null;

  const lastMeta = powRows[powRows.length - 1]?.metadata ?? {};
  const key: TapbenchIssuedKey = {
    id: keyId,
    workspace_id: workspaceId,
    user_id: options.auth.user_id,
    key_hash: "",
    key_prefix: "",
    label: null,
    is_active: true,
    created_at: new Date().toISOString(),
    last_used_at: null,
    expires_at: null,
    stopped_at: null,
  };

  try {
    return await snapshotTapbenchPowPayload(
      {
        key,
        workspaceId,
        proofOfWork: {
          type: "tool",
          mime_type: "application/json",
          data: Buffer.from("{}", "utf8").toString("base64"),
          metadata: lastMeta,
        },
        tooling: toolingFromPowMetadata(lastMeta),
        powRows,
      },
      {
        persistEmbedding: (opts) =>
          persistTapbenchParticipantEmbedding(options.supabase, {
            ...opts,
            guestUserId,
            powEventCount: powRows.length,
          }),
      },
    );
  } catch (err) {
    console.warn("[tapbench] snapshot on stop failed:", err);
    return null;
  }
}
