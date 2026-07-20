/**
 * Gate re-running a vertical eval until new proof of work is available.
 * Per vertical: verification / augmentation / optimization are independent.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthContext } from "./types";
import type { ScoreVertical } from "./performance-report";
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
  /** ISO timestamp of the last eval of this type for the subject, if any. */
  last_eval_at: string | null;
  /** New PoW artifacts since last_eval_at; null when never evaluated. */
  new_pow_count: number | null;
  code?: typeof NO_NEW_POW_CODE;
  message?: string;
}

export interface EvalPowGateOptions {
  workspaceId: string;
  vertical: ScoreVertical;
  auth: AuthContext;
  participantUserId?: string | null;
  participantGuestUserId?: string | null;
  blockId?: string | null;
}

export function verticalLabel(vertical: ScoreVertical): string {
  switch (vertical) {
    case "augmentation":
      return "augmentation";
    case "optimization":
      return "optimization";
    default:
      return "verification";
  }
}

/**
 * Pure decision helper for tests and UI previews.
 * First eval of a type is always allowed; re-runs require new_pow_count > 0.
 */
export function decideEvalPowGate(input: {
  vertical: ScoreVertical;
  lastEvalAt: string | null;
  newPowCount: number;
}): EvalPowGateStatus {
  const { vertical, lastEvalAt, newPowCount } = input;
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
  const label = verticalLabel(vertical);
  return {
    vertical,
    allowed: false,
    last_eval_at: lastEvalAt,
    new_pow_count: 0,
    code: NO_NEW_POW_CODE,
    message: `No new proof of work since the last ${label} eval. Upload more proof of work before re-running this eval type.`,
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

export async function getLatestEvalRanAt(
  supabase: SupabaseClient,
  options: {
    workspaceId: string;
    subject?: SubjectRef | null;
    vertical: ScoreVertical;
  },
): Promise<string | null> {
  const rows = await listEvalRunHistory(supabase, {
    workspaceId: options.workspaceId,
    subject: options.subject,
    vertical: options.vertical,
    limit: 1,
  });
  return rows[0]?.ran_at ?? null;
}

/**
 * Whether a vertical eval may run given prior history and new PoW availability.
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
    vertical: options.vertical,
  });

  if (!lastEvalAt) {
    return decideEvalPowGate({
      vertical: options.vertical,
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
    vertical: options.vertical,
    lastEvalAt,
    newPowCount,
  });
}

/**
 * Status for all three verticals (workspace Eval tab / eligibility APIs).
 */
export async function getAllEvalPowGateStatuses(
  supabase: SupabaseClient,
  options: Omit<EvalPowGateOptions, "vertical">,
): Promise<Record<ScoreVertical, EvalPowGateStatus>> {
  const verticals: ScoreVertical[] = ["verification", "augmentation", "optimization"];
  const entries = await Promise.all(
    verticals.map(async (vertical) => {
      const status = await getEvalPowGateStatus(supabase, { ...options, vertical });
      return [vertical, status] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<ScoreVertical, EvalPowGateStatus>;
}

/**
 * Throw if re-running the same vertical without new PoW.
 * Call after empty-evidence checks and before expensive score generation.
 */
export async function assertEvalAllowedWithNewPow(
  supabase: SupabaseClient,
  options: EvalPowGateOptions,
): Promise<EvalPowGateStatus> {
  const status = await getEvalPowGateStatus(supabase, options);
  if (!status.allowed) {
    const err = new Error(
      status.message ||
        `No new proof of work since the last ${verticalLabel(options.vertical)} eval.`,
    );
    (err as Error & { code?: string; status?: number }).code = NO_NEW_POW_CODE;
    (err as Error & { code?: string; status?: number }).status = 409;
    throw err;
  }
  return status;
}
