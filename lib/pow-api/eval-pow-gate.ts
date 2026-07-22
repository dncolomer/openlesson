/**
 * Gate re-running an LWM Snapshot until new proof of work is available.
 * Single strategy only (LWM Snapshot strategy).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthContext } from "./types";
import {
  LWM_SNAPSHOT_LABEL,
  SNAPSHOT_VERTICAL,
  type ScoreVertical,
} from "./performance-report";
import {
  subjectFromAuthAndParticipants,
  type SubjectRef,
} from "./learning-world-model-store";
import { listEvalRunHistory } from "./eval-run-history-store";
import { proofOfWorkQueryForAuth } from "./workspace-proof-of-work";

export const NO_NEW_POW_CODE = "no_new_pow" as const;

export interface EvalPowGateStatus {
  vertical: ScoreVertical;
  allowed: boolean;
  /** ISO timestamp of the last snapshot for the subject, if any. */
  last_eval_at: string | null;
  /** New PoW artifacts since last_eval_at; null when never snapshotted. */
  new_pow_count: number | null;
  code?: typeof NO_NEW_POW_CODE;
  message?: string;
}

export interface EvalPowGateOptions {
  workspaceId: string;
  /** Ignored for product gating — always uses SNAPSHOT_VERTICAL. Kept for call-site compat. */
  vertical?: ScoreVertical;
  auth: AuthContext;
  participantUserId?: string | null;
  participantGuestUserId?: string | null;
  blockId?: string | null;
}

export function verticalLabel(_vertical?: ScoreVertical): string {
  return LWM_SNAPSHOT_LABEL;
}

/**
 * Pure decision helper for tests and UI previews.
 * First snapshot is always allowed; re-runs require new_pow_count > 0.
 */
export function decideEvalPowGate(input: {
  vertical?: ScoreVertical;
  lastEvalAt: string | null;
  newPowCount: number;
}): EvalPowGateStatus {
  const vertical = SNAPSHOT_VERTICAL;
  const { lastEvalAt, newPowCount } = input;
  if (!lastEvalAt) {
    return {
      vertical,
      allowed: true,
      last_eval_at: null,
      new_pow_count: null,
    };
  }
  if (newPowCount > 0) {
    return {
      vertical,
      allowed: true,
      last_eval_at: lastEvalAt,
      new_pow_count: newPowCount,
    };
  }
  return {
    vertical,
    allowed: false,
    last_eval_at: lastEvalAt,
    new_pow_count: 0,
    code: NO_NEW_POW_CODE,
    message: `No new proof of work since the last ${LWM_SNAPSHOT_LABEL}. Upload more proof of work before generating a new snapshot.`,
  };
}

function resolveEvidenceFilter(
  auth: AuthContext,
  participantUserId?: string | null,
  participantGuestUserId?: string | null,
) {
  if (participantGuestUserId || participantUserId) {
    return {
      guestUserId: participantGuestUserId || null,
      restrictToGuest: !!participantGuestUserId,
      restrictToUser: !!participantUserId && !participantGuestUserId,
      userId: participantUserId || null,
    };
  }
  return proofOfWorkQueryForAuth(auth);
}

/**
 * Count workspace_proof_of_work rows after `sinceIso` with the same subject/auth
 * filters used by performance context scoring.
 */
export async function countProofOfWorkSince(
  supabase: SupabaseClient,
  options: {
    workspaceId: string;
    sinceIso: string;
    auth: AuthContext;
    participantUserId?: string | null;
    participantGuestUserId?: string | null;
    blockId?: string | null;
  },
): Promise<number> {
  const filter = resolveEvidenceFilter(
    options.auth,
    options.participantUserId,
    options.participantGuestUserId,
  );

  let query = supabase
    .from("workspace_proof_of_work")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", options.workspaceId)
    .gt("created_at", options.sinceIso);

  if (options.blockId) {
    query = query.eq("block_id", options.blockId);
  }
  if (filter.restrictToGuest && filter.guestUserId) {
    query = query.eq("guest_user_id", filter.guestUserId);
  } else if (filter.restrictToUser && filter.userId) {
    query = query.eq("user_id", filter.userId);
  }

  const { count, error } = await query;
  if (error) {
    console.warn("[eval-pow-gate] count failed:", error.message);
    // Fail open on count errors so a stats glitch does not hard-block scoring.
    return 1;
  }
  return typeof count === "number" && Number.isFinite(count) ? count : 0;
}

/**
 * Latest snapshot ran_at for the subject.
 * Treats historical verification (and any prior vertical) as the same snapshot timeline
 * so re-runs still require new PoW after any prior score archive.
 */
export async function getLatestEvalRanAt(
  supabase: SupabaseClient,
  options: {
    workspaceId: string;
    subject?: SubjectRef | null;
    vertical?: ScoreVertical;
  },
): Promise<string | null> {
  // Single strategy: look at all history for subject (limit 1 by ran_at desc).
  // Do not filter by vertical so legacy aug/opt archives still gate re-snapshots.
  const rows = await listEvalRunHistory(supabase, {
    workspaceId: options.workspaceId,
    subject: options.subject,
    vertical: null,
    limit: 1,
  });
  return rows[0]?.ran_at ?? null;
}

/**
 * Whether an LWM Snapshot may run given prior history and new PoW availability.
 */
export async function getEvalPowGateStatus(
  supabase: SupabaseClient,
  options: EvalPowGateOptions,
): Promise<EvalPowGateStatus> {
  const subject = subjectFromAuthAndParticipants({
    authUserId: options.auth.user_id,
    authGuestUserId: options.auth.guest_user_id,
    participantUserId: options.participantUserId,
    participantGuestUserId: options.participantGuestUserId,
  });

  const lastEvalAt = await getLatestEvalRanAt(supabase, {
    workspaceId: options.workspaceId,
    subject,
    vertical: SNAPSHOT_VERTICAL,
  });

  if (!lastEvalAt) {
    return decideEvalPowGate({
      vertical: SNAPSHOT_VERTICAL,
      lastEvalAt: null,
      newPowCount: 0,
    });
  }

  const newPowCount = await countProofOfWorkSince(supabase, {
    workspaceId: options.workspaceId,
    sinceIso: lastEvalAt,
    auth: options.auth,
    participantUserId: options.participantUserId,
    participantGuestUserId: options.participantGuestUserId,
    blockId: options.blockId,
  });

  return decideEvalPowGate({
    vertical: SNAPSHOT_VERTICAL,
    lastEvalAt,
    newPowCount,
  });
}

/** @deprecated Prefer getEvalPowGateStatus — single strategy only. */
export async function getAllEvalPowGateStatuses(
  supabase: SupabaseClient,
  options: Omit<EvalPowGateOptions, "vertical">,
): Promise<Record<ScoreVertical, EvalPowGateStatus>> {
  const status = await getEvalPowGateStatus(supabase, {
    ...options,
    vertical: SNAPSHOT_VERTICAL,
  });
  // Only snapshot is product-runnable; expose under verification key for call-site compat.
  return {
    verification: status,
    augmentation: {
      ...status,
      vertical: "augmentation",
      allowed: false,
      message: "Augmentation is no longer a peer score type. Use LWM Snapshot.",
      code: NO_NEW_POW_CODE,
    },
    optimization: {
      ...status,
      vertical: "optimization",
      allowed: false,
      message: "Optimization is no longer a peer score type. Use LWM Snapshot.",
      code: NO_NEW_POW_CODE,
    },
  };
}

/**
 * Throw if re-running snapshot without new PoW.
 * Call after empty-evidence checks and before expensive score generation.
 */
export async function assertEvalAllowedWithNewPow(
  supabase: SupabaseClient,
  options: EvalPowGateOptions,
): Promise<EvalPowGateStatus> {
  const status = await getEvalPowGateStatus(supabase, {
    ...options,
    vertical: SNAPSHOT_VERTICAL,
  });
  if (!status.allowed) {
    const err = new Error(
      status.message ||
        `No new proof of work since the last ${LWM_SNAPSHOT_LABEL}.`,
    );
    (err as Error & { code?: string; status?: number }).code = NO_NEW_POW_CODE;
    (err as Error & { code?: string; status?: number }).status = 409;
    throw err;
  }
  return status;
}
