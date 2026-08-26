/**
 * Stop one TAPBench guest run: flush remaining buffer as Submit.
 * Snapshot is a separate action unless snapshot=true.
 * The operator key stays live so more guests can be minted.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthContext } from "@/lib/pow-api/types";
import {
  bufferSubjectId,
  submitBufferedProofOfWork,
} from "@/lib/pow-api/stash-api";
import { snapshotTapbenchSession } from "./after-pow";
import type { TapbenchWrapResult } from "./wrap";
import { stashContextFromTapbenchKey } from "./pow-auth";
import {
  assertTapbenchGuestForKey,
  supabaseTapbenchGuestStore,
  type TapbenchGuestStore,
} from "./guests";

export type StopTapbenchSessionResult = {
  stopped: true;
  workspace_id: string;
  key_id: string;
  guest_user_id: string;
  stopped_at: string;
  flushed: number;
  empty: boolean;
  snapshot: TapbenchWrapResult["snapshot"] | null;
};

export async function stopTapbenchSession(options: {
  auth: AuthContext;
  supabase: SupabaseClient;
  workspaceId: string;
  guestUserId: string;
  snapshot?: boolean;
  guestStore?: TapbenchGuestStore;
  nowMs?: number;
}): Promise<StopTapbenchSessionResult> {
  const workspaceId = options.workspaceId;
  const guestUserId = options.guestUserId.trim();
  if (!guestUserId) {
    throw Object.assign(new Error("guest_user_id is required to stop a TAPBench run"), {
      status: 400,
      code: "validation_error",
    });
  }

  const guestStore = options.guestStore ?? supabaseTapbenchGuestStore(options.supabase);
  const guest = await assertTapbenchGuestForKey(guestStore, options.auth.key_id, guestUserId);

  const auth: AuthContext = {
    ...options.auth,
    user_id: null,
    guest_user_id: guestUserId,
  };
  const tapbench = stashContextFromTapbenchKey(auth, workspaceId);
  if (!tapbench) {
    throw Object.assign(new Error("This TAPBench key is not issued for this Benchmark Task"), {
      status: 403,
      code: "forbidden",
    });
  }

  const { data: workspace } = await options.supabase
    .from("workspaces")
    .select("id, user_id, organization_id")
    .eq("id", workspaceId)
    .maybeSingle();

  if (!workspace) {
    throw Object.assign(new Error("Workspace not found"), {
      status: 404,
      code: "workspace_not_found",
    });
  }

  const subjectId = bufferSubjectId(auth);
  const flush = await submitBufferedProofOfWork({
    workspaceId,
    subjectId,
    auth,
    workspace: {
      id: workspace.id,
      user_id: workspace.user_id || options.auth.user_id || "",
      organization_id: workspace.organization_id ?? options.auth.organization_id,
    },
    supabase: options.supabase,
    tapbench,
  });

  if (!flush.ok) {
    throw Object.assign(new Error(flush.error), {
      status: 502,
      code: "internal_error",
    });
  }

  let snapshot: TapbenchWrapResult["snapshot"] | null = null;
  if (options.snapshot) {
    const wrap = await snapshotTapbenchSession({
      auth,
      supabase: options.supabase,
      workspaceId,
      guestUserId,
    });
    snapshot = wrap?.snapshot ?? null;
  }

  const stoppedAt = new Date(options.nowMs ?? Date.now()).toISOString();
  await guestStore.markStopped(options.auth.key_id, guest.guest_user_id, stoppedAt);

  return {
    stopped: true,
    workspace_id: workspaceId,
    key_id: options.auth.key_id,
    guest_user_id: guestUserId,
    stopped_at: stoppedAt,
    flushed: flush.flushed,
    empty: flush.empty,
    snapshot,
  };
}
