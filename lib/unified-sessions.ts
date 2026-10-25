/**
 * Unified `sessions` writers. Calibrate, Learn, and Verify share one table.
 * Proof of work is never deleted from here.
 */

import type { SessionKind, SessionResult } from "@/lib/core-data-model";
import { parseSessionKind } from "@/lib/core-data-model";
import type { GuestSessionClient } from "@/lib/guest-session-tables";

export const UNIFIED_SESSIONS_TABLE = "sessions" as const;

export type UnifiedSessionInsert = {
  id?: string;
  kind: SessionKind;
  user_id: string;
  problem?: string;
  status?: string;
  workspace_id?: string | null;
  block_id?: string | null;
  calibrate_flow_id?: string | null;
  verify_flow_id?: string | null;
  guest_user_id?: string | null;
  assigned_user_id?: string | null;
  organization_id?: string | null;
  private_token_hash?: string | null;
  public_token?: string | null;
  access_mode?: string | null;
  identity?: string | null;
  result?: SessionResult | Record<string, unknown> | null;
  field_model?: Record<string, unknown> | null;
  guest_link?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  planning_prompt?: string | null;
};

export function kindFromGuestLogicalTable(table: string): SessionKind {
  if (table === "workspace_verify_sessions") return "verify";
  if (table === "workspace_learn_links") return "learn";
  return "calibrate";
}

export function guestLinkFromRow(row: Record<string, unknown>): Record<string, unknown> {
  const omit = new Set([
    "id",
    "kind",
    "result",
    "field_model",
    "chapter_map",
    "probes",
    "guest_link",
    "workspaces",
  ]);
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (omit.has(key)) continue;
    out[key] = value;
  }
  return out;
}

export function hydrateUnifiedGuestRow(row: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!row) return null;
  const link =
    row.guest_link && typeof row.guest_link === "object" && !Array.isArray(row.guest_link)
      ? (row.guest_link as Record<string, unknown>)
      : {};
  return {
    ...link,
    ...row,
    interaction_kind: row.kind === "verify" ? "verify" : row.kind === "calibrate" ? "calibrate" : link.interaction_kind,
  };
}

export function unifiedSessionInsertPayload(input: UnifiedSessionInsert): Record<string, unknown> {
  const kind = parseSessionKind(input.kind) || "learn";
  const problem =
    typeof input.problem === "string" && input.problem.trim()
      ? input.problem
      : kind === "calibrate"
        ? "Calibrate"
        : kind === "verify"
          ? "Verify"
          : "Learn";
  return {
    ...(input.id ? { id: input.id } : {}),
    kind,
    user_id: input.user_id,
    problem,
    status: input.status || "pending",
    workspace_id: input.workspace_id ?? null,
    block_id: input.block_id ?? null,
    calibrate_flow_id: input.calibrate_flow_id ?? null,
    verify_flow_id: input.verify_flow_id ?? null,
    guest_user_id: input.guest_user_id ?? null,
    assigned_user_id: input.assigned_user_id ?? null,
    organization_id: input.organization_id ?? null,
    private_token_hash: input.private_token_hash ?? null,
    public_token: input.public_token ?? null,
    access_mode: input.access_mode ?? null,
    identity: input.identity ?? null,
    result: input.result ?? null,
    field_model: input.field_model ?? null,
    guest_link: input.guest_link ?? {},
    metadata: input.metadata ?? undefined,
    planning_prompt: input.planning_prompt ?? null,
  };
}

export async function insertUnifiedSession(
  supabase: GuestSessionClient,
  input: UnifiedSessionInsert,
  select = "*",
): Promise<{ data: Record<string, unknown> | null; error: unknown }> {
  const { data, error } = await supabase
    .from(UNIFIED_SESSIONS_TABLE)
    .insert(unifiedSessionInsertPayload(input))
    .select(select)
    .single();
  return { data: (data as Record<string, unknown> | null) ?? null, error };
}

export async function updateUnifiedSession(
  supabase: GuestSessionClient,
  id: string,
  patch: Record<string, unknown>,
  select = "*",
): Promise<{ data: Record<string, unknown> | null; error: unknown }> {
  const { data, error } = await supabase
    .from(UNIFIED_SESSIONS_TABLE)
    .update(patch)
    .eq("id", id)
    .select(select)
    .single();
  return { data: (data as Record<string, unknown> | null) ?? null, error };
}
