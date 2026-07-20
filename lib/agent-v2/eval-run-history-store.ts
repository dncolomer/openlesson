/**
 * Append-only eval run history (full scorecard archive per vertical eval).
 * Distinct from learning_world_models (latest) and knowledge_config_snapshots (geometry).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ScoreVertical, VerticalScoreReport } from "./performance-report";
import {
  normalizeSubject,
  type SubjectRef,
} from "./learning-world-model-store";

export type EvalRunHistorySource = "score" | "web" | "api" | "test";

export interface EvalRunHistoryRow {
  id: string;
  workspace_id: string;
  subject_user_id: string | null;
  subject_guest_user_id: string | null;
  vertical: ScoreVertical;
  score: number;
  ghc_score: number | null;
  ghc_confidence: string | null;
  report: VerticalScoreReport;
  workspace_goal: string | null;
  block_id: string | null;
  source: string;
  ran_at: string;
  created_at: string;
}

export interface InsertEvalRunHistoryOptions {
  workspaceId: string;
  subject?: SubjectRef | null;
  vertical: ScoreVertical;
  report: VerticalScoreReport;
  blockId?: string | null;
  source?: EvalRunHistorySource | string;
  ranAt?: string | Date;
}

export interface ListEvalRunHistoryOptions {
  workspaceId: string;
  /** Single subject filter (user or guest). Ignored when userIds / guestUserIds are set. */
  subject?: SubjectRef | null;
  /** Multi-user (group cohort) filter — OR of these user subjects. */
  userIds?: string[] | null;
  /** Multi-guest subject filter. */
  guestUserIds?: string[] | null;
  vertical?: ScoreVertical | null;
  from?: string | Date | null;
  to?: string | Date | null;
  limit?: number;
  offset?: number;
}

function toIso(value?: string | Date | null): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export async function insertEvalRunHistory(
  supabase: SupabaseClient,
  options: InsertEvalRunHistoryOptions,
): Promise<{ id: string | null; row: EvalRunHistoryRow | null; error?: string }> {
  const { subject_user_id, subject_guest_user_id } = normalizeSubject(options.subject);
  const report = options.report;
  const ranAt = toIso(options.ranAt) ?? new Date().toISOString();
  const score = clampScore(report.score ?? 0);
  const ghc =
    report.ghc_score != null && Number.isFinite(report.ghc_score)
      ? clampScore(report.ghc_score)
      : null;

  const payload = {
    workspace_id: options.workspaceId,
    subject_user_id,
    subject_guest_user_id,
    vertical: options.vertical,
    score,
    ghc_score: ghc,
    ghc_confidence: report.ghc_confidence ?? null,
    report,
    workspace_goal: report.workspace_goal ?? null,
    block_id: options.blockId ?? null,
    source: options.source ?? "score",
    ran_at: ranAt,
  };

  const { data, error } = await supabase
    .from("eval_run_history")
    .insert(payload)
    .select(
      "id, workspace_id, subject_user_id, subject_guest_user_id, vertical, score, ghc_score, ghc_confidence, report, workspace_goal, block_id, source, ran_at, created_at",
    )
    .maybeSingle();

  if (error) {
    console.warn("[eval-run-history] insert failed:", error.message);
    return { id: null, row: null, error: error.message };
  }
  if (!data) {
    return { id: null, row: null, error: "Insert returned no row" };
  }

  return {
    id: data.id as string,
    row: mapRow(data),
  };
}

function mapRow(data: Record<string, unknown>): EvalRunHistoryRow {
  return {
    id: data.id as string,
    workspace_id: data.workspace_id as string,
    subject_user_id: (data.subject_user_id as string | null) ?? null,
    subject_guest_user_id: (data.subject_guest_user_id as string | null) ?? null,
    vertical: data.vertical as ScoreVertical,
    score: Number(data.score),
    ghc_score: data.ghc_score == null ? null : Number(data.ghc_score),
    ghc_confidence: (data.ghc_confidence as string | null) ?? null,
    report: data.report as VerticalScoreReport,
    workspace_goal: (data.workspace_goal as string | null) ?? null,
    block_id: (data.block_id as string | null) ?? null,
    source: (data.source as string) || "score",
    ran_at: data.ran_at as string,
    created_at: data.created_at as string,
  };
}

/**
 * List history rows for a workspace with optional subject / multi-user filters.
 * Ordered by ran_at descending (newest first).
 */
export async function listEvalRunHistory(
  supabase: SupabaseClient,
  options: ListEvalRunHistoryOptions,
): Promise<EvalRunHistoryRow[]> {
  const limit = Math.min(500, Math.max(1, options.limit ?? 50));
  const offset = Math.max(0, options.offset ?? 0);

  let query = supabase
    .from("eval_run_history")
    .select(
      "id, workspace_id, subject_user_id, subject_guest_user_id, vertical, score, ghc_score, ghc_confidence, report, workspace_goal, block_id, source, ran_at, created_at",
    )
    .eq("workspace_id", options.workspaceId)
    .order("ran_at", { ascending: false })
    .range(offset, offset + limit - 1);

  const userIds = (options.userIds || []).map((id) => id.trim()).filter(Boolean);
  const guestUserIds = (options.guestUserIds || []).map((id) => id.trim()).filter(Boolean);

  if (userIds.length > 0 || guestUserIds.length > 0) {
    // Multi-subject cohort: (subject_user_id IN (...)) OR (subject_guest_user_id IN (...))
    const orParts: string[] = [];
    if (userIds.length > 0) {
      orParts.push(`subject_user_id.in.(${userIds.join(",")})`);
    }
    if (guestUserIds.length > 0) {
      orParts.push(`subject_guest_user_id.in.(${guestUserIds.join(",")})`);
    }
    query = query.or(orParts.join(","));
  } else if (options.subject) {
    const { subject_user_id, subject_guest_user_id } = normalizeSubject(options.subject);
    if (subject_guest_user_id) {
      query = query.eq("subject_guest_user_id", subject_guest_user_id).is("subject_user_id", null);
    } else if (subject_user_id) {
      query = query.eq("subject_user_id", subject_user_id).is("subject_guest_user_id", null);
    } else {
      query = query.is("subject_user_id", null).is("subject_guest_user_id", null);
    }
  }

  if (options.vertical) {
    query = query.eq("vertical", options.vertical);
  }
  const fromIso = toIso(options.from ?? null);
  const toIsoBound = toIso(options.to ?? null);
  if (fromIso) query = query.gte("ran_at", fromIso);
  if (toIsoBound) query = query.lte("ran_at", toIsoBound);

  const { data, error } = await query;
  if (error) {
    console.warn("[eval-run-history] list failed:", error.message);
    return [];
  }

  return (data || []).map((row) => mapRow(row as Record<string, unknown>));
}

/**
 * Resolve which subjects a caller may list for history.
 * Non-admins are forced to their own subject; org admins / owners may pass multi-user filters.
 */
export function resolveHistorySubjectScope(options: {
  authUserId?: string | null;
  authGuestUserId?: string | null;
  isOrgAdmin?: boolean;
  isWorkspaceOwner?: boolean;
  requestedUserIds?: string[] | null;
  requestedGuestUserIds?: string[] | null;
  requestedSubject?: SubjectRef | null;
}): {
  subject?: SubjectRef | null;
  userIds?: string[] | null;
  guestUserIds?: string[] | null;
  restricted: boolean;
} {
  const canInspectOthers = Boolean(options.isOrgAdmin || options.isWorkspaceOwner);

  if (!canInspectOthers) {
    if (options.authGuestUserId) {
      return { subject: { guest_user_id: options.authGuestUserId }, restricted: true };
    }
    if (options.authUserId) {
      return { subject: { user_id: options.authUserId }, restricted: true };
    }
    return { subject: {}, restricted: true };
  }

  const userIds = (options.requestedUserIds || []).map((id) => id.trim()).filter(Boolean);
  const guestUserIds = (options.requestedGuestUserIds || [])
    .map((id) => id.trim())
    .filter(Boolean);

  if (userIds.length > 0 || guestUserIds.length > 0) {
    return { userIds, guestUserIds, restricted: false };
  }

  if (options.requestedSubject) {
    return { subject: options.requestedSubject, restricted: false };
  }

  // No subject filter → full workspace history for authorized inspectors.
  return { restricted: false };
}
