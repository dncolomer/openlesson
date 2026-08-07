/**
 * Gate re-running an LWM Snapshot until new proof of work is available
 * for the same goal selection. Distinct goal sets are distinct snapshot
 * identities and do not share the no-new-PoW block.
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
  /** ISO timestamp of the last snapshot for the subject (+ goals), if any. */
  last_eval_at: string | null;
  /** New PoW artifacts since last_eval_at; null when never snapshotted for this goal set. */
  new_pow_count: number | null;
  /** Goals fingerprint this gate decision applies to (when provided). */
  goals_fingerprint?: string | null;
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
  /**
   * Fingerprint of the evaluated goal set for this run.
   * When set, only prior snapshots with the same fingerprint gate re-runs.
   * When omitted, falls back to any prior snapshot (legacy single-goal behavior).
   */
  goalsFingerprint?: string | null;
}

export function verticalLabel(_vertical?: ScoreVertical): string {
  return LWM_SNAPSHOT_LABEL;
}

/**
 * Pure decision helper for tests and UI previews.
 * First snapshot for a goal set is always allowed; re-runs require new_pow_count > 0.
 */
export function decideEvalPowGate(input: {
  vertical?: ScoreVertical;
  lastEvalAt: string | null;
  newPowCount: number;
  goalsFingerprint?: string | null;
}): EvalPowGateStatus {
  const vertical = SNAPSHOT_VERTICAL;
  const { lastEvalAt, newPowCount, goalsFingerprint } = input;
  if (!lastEvalAt) {
    return {
      vertical,
      allowed: true,
      last_eval_at: null,
      new_pow_count: null,
      goals_fingerprint: goalsFingerprint ?? null,
    };
  }
  if (newPowCount > 0) {
    return {
      vertical,
      allowed: true,
      last_eval_at: lastEvalAt,
      new_pow_count: newPowCount,
      goals_fingerprint: goalsFingerprint ?? null,
    };
  }
  return {
    vertical,
    allowed: false,
    last_eval_at: lastEvalAt,
    new_pow_count: 0,
    goals_fingerprint: goalsFingerprint ?? null,
    code: NO_NEW_POW_CODE,
    message: `No new proof of work since the last ${LWM_SNAPSHOT_LABEL} for this goal selection. Upload more proof of work or choose different goals before generating a new snapshot.`,
  };
}

/**
 * Pure helper: whether same PoW + same goals is blocked, different goals allowed.
 * Drives unit tests of identity semantics without re-implementing the gate.
 */
export function decideEvalPowGateWithGoals(input: {
  lastEvalAtForGoals: string | null;
  newPowCountSinceLastForGoals: number;
  goalsFingerprint: string;
}): EvalPowGateStatus {
  return decideEvalPowGate({
    lastEvalAt: input.lastEvalAtForGoals,
    newPowCount: input.newPowCountSinceLastForGoals,
    goalsFingerprint: input.goalsFingerprint,
  });
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
 * Latest snapshot ran_at for the subject, optionally matching goals_fingerprint.
 * Treats historical verification (and any prior vertical) as the same snapshot timeline
 * so re-runs still require new PoW after any prior score archive for that goal set.
 */
export async function getLatestEvalRanAt(
  supabase: SupabaseClient,
  options: {
    workspaceId: string;
    subject?: SubjectRef | null;
    vertical?: ScoreVertical;
    goalsFingerprint?: string | null;
  },
): Promise<string | null> {
  // Single strategy: look at all history for subject (limit enough to filter by goals).
  // Do not filter by vertical so legacy aug/opt archives still gate re-snapshots when no goals fp.
  const rows = await listEvalRunHistory(supabase, {
    workspaceId: options.workspaceId,
    subject: options.subject,
    vertical: null,
    limit: options.goalsFingerprint ? 50 : 1,
  });

  if (!options.goalsFingerprint) {
    return rows[0]?.ran_at ?? null;
  }

  const fp = options.goalsFingerprint;
  for (const row of rows) {
    if (row.goals_fingerprint === fp) return row.ran_at;
    // Also match when fingerprint is stored only on report evaluated_goals via recomputation —
    // history row may have goals_fingerprint null for legacy; skip those for multi-goal gate.
  }
  return null;
}

/**
 * Whether an LWM Snapshot may run given prior history and new PoW availability
 * for the same goal selection.
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
    goalsFingerprint: options.goalsFingerprint ?? null,
  });

  if (!lastEvalAt) {
    return decideEvalPowGate({
      vertical: SNAPSHOT_VERTICAL,
      lastEvalAt: null,
      newPowCount: 0,
      goalsFingerprint: options.goalsFingerprint ?? null,
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
    goalsFingerprint: options.goalsFingerprint ?? null,
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
 * Throw if re-running snapshot without new PoW for this goal selection.
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
        `No new proof of work since the last ${LWM_SNAPSHOT_LABEL} for this goal selection.`,
    );
    (err as Error & { code?: string; status?: number }).code = NO_NEW_POW_CODE;
    (err as Error & { code?: string; status?: number }).status = 409;
    throw err;
  }
  return status;
}
