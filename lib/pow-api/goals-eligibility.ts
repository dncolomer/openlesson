/**
 * Resolve goals fingerprint for LWM Snapshot re-run eligibility (web UI gate).
 * Mirrors runVerticalScore goal resolution so UI and server share the same identity.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fingerprintGoals,
  normalizeGoalText,
  parseGoalSelectionFromBody,
  resolveEvaluatedGoals,
  type EvaluatedGoal,
  type GoalSelectionInput,
} from "./goals";
import { loadGoalCatalogs } from "./goals-store";
import type { AuthContext } from "./types";
import { proofOfWorkQueryForAuth } from "./workspace-proof-of-work";

export async function loadPowRelatedBlockIds(
  supabase: SupabaseClient,
  options: {
    workspaceId: string;
    auth: AuthContext;
    participantUserId?: string | null;
    participantGuestUserId?: string | null;
    blockId?: string | null;
  },
): Promise<string[]> {
  let filter: {
    guestUserId?: string | null;
    restrictToGuest?: boolean;
    restrictToUser?: boolean;
    userId?: string | null;
  };
  if (options.participantGuestUserId || options.participantUserId) {
    filter = {
      guestUserId: options.participantGuestUserId || null,
      restrictToGuest: !!options.participantGuestUserId,
      restrictToUser: !!options.participantUserId && !options.participantGuestUserId,
      userId: options.participantUserId || null,
    };
  } else {
    filter = proofOfWorkQueryForAuth(options.auth);
  }

  let query = supabase
    .from("workspace_proof_of_work")
    .select("block_id")
    .eq("workspace_id", options.workspaceId)
    .not("block_id", "is", null)
    .limit(500);

  if (options.blockId) {
    query = query.eq("block_id", options.blockId);
  }
  if (filter.restrictToGuest && filter.guestUserId) {
    query = query.eq("guest_user_id", filter.guestUserId);
  } else if (filter.restrictToUser && filter.userId) {
    query = query.eq("user_id", filter.userId);
  }

  const { data, error } = await query;
  if (error) {
    console.warn("[goals-eligibility] pow block ids failed:", error.message);
    return options.blockId ? [options.blockId] : [];
  }

  const out: string[] = [];
  const seen = new Set<string>();
  for (const row of data || []) {
    const id = typeof row.block_id === "string" ? row.block_id.trim() : "";
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  if (options.blockId && !seen.has(options.blockId)) out.push(options.blockId);
  return out;
}

/**
 * Resolve evaluated goals + fingerprint for an eligibility check, matching
 * runVerticalScore defaults (including legacy workspace_goal fallback).
 */
export async function resolveGoalsForEligibility(
  supabase: SupabaseClient,
  options: {
    workspaceId: string;
    auth: AuthContext;
    selection?: GoalSelectionInput | null;
    selectionBody?: Record<string, unknown> | null;
    /** Explicit fingerprint from client — used when valid hex. */
    goalsFingerprint?: string | null;
    participantUserId?: string | null;
    participantGuestUserId?: string | null;
    blockId?: string | null;
    storedWorkspaceGoal?: string | null;
  },
): Promise<{
  evaluated_goals: EvaluatedGoal[];
  goals_fingerprint: string | null;
}> {
  const explicit = options.goalsFingerprint?.trim() || null;
  if (explicit && /^[0-9a-f]{8,}$/i.test(explicit)) {
    return { evaluated_goals: [], goals_fingerprint: explicit.toLowerCase() };
  }

  const selection: GoalSelectionInput =
    options.selection ??
    parseGoalSelectionFromBody(options.selectionBody ?? null);

  const catalogs = await loadGoalCatalogs(supabase, options.workspaceId);
  const powRelatedBlockIds = await loadPowRelatedBlockIds(supabase, {
    workspaceId: options.workspaceId,
    auth: options.auth,
    participantUserId: options.participantUserId,
    participantGuestUserId: options.participantGuestUserId,
    blockId: options.blockId,
  });

  let evaluatedGoals = resolveEvaluatedGoals({
    selection,
    workspaceGoals: catalogs.workspaceGoals,
    blockGoals: catalogs.blockGoals,
    powRelatedBlockIds,
  });

  if (evaluatedGoals.length === 0 && selection.mode !== "selected") {
    let legacy = normalizeGoalText(options.storedWorkspaceGoal);
    if (!legacy) {
      const { data } = await supabase
        .from("workspaces")
        .select("workspace_goal")
        .eq("id", options.workspaceId)
        .maybeSingle();
      legacy = normalizeGoalText(
        (data as { workspace_goal?: string | null } | null)?.workspace_goal,
      );
    }
    if (legacy) {
      evaluatedGoals = [
        { id: null, text: legacy, scope: "workspace", block_id: null },
      ];
    }
  }

  return {
    evaluated_goals: evaluatedGoals,
    goals_fingerprint:
      evaluatedGoals.length > 0 ? fingerprintGoals(evaluatedGoals) : null,
  };
}
