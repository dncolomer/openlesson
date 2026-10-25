/**
 * Guest-session storage. Calibrate, Verify, and Learn persist on `sessions`
 * with `kind`. Logical table constants stay for call-site isolation tests.
 */

import {
  guestLinkFromRow,
  hydrateUnifiedGuestRow,
  insertUnifiedSession,
  kindFromGuestLogicalTable,
  UNIFIED_SESSIONS_TABLE,
} from "@/lib/unified-sessions";

export const CALIBRATE_SESSIONS_TABLE = "workspace_calibrate_sessions" as const;
export const VERIFY_SESSIONS_TABLE = "workspace_verify_sessions" as const;
export const LEARN_LINKS_TABLE = "workspace_learn_links" as const;

export type CalibrateVerifyTable =
  | typeof CALIBRATE_SESSIONS_TABLE
  | typeof VERIFY_SESSIONS_TABLE;

export type GuestFlowKind = "calibrate" | "verify" | "learn";

export const GUEST_SESSION_SELECT =
  "id, workspace_id, user_id, guest_user_id, assigned_user_id, organization_id, block_id, status, access_mode, public_token, private_token_hash, kind, identity, result, field_model, guest_link, workspaces(user_id)";

export const GUEST_SESSION_OPEN_SELECT =
  "id, workspace_id, block_id, status, assigned_user_id, guest_user_id, organization_id, user_id, access_mode, public_token, kind, guest_link, workspaces(title, user_id)";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type GuestSessionClient = { from: (table: string) => any };

export function guestSessionTableForFlow(flow: "calibrate" | "verify"): CalibrateVerifyTable {
  return flow === "calibrate" ? CALIBRATE_SESSIONS_TABLE : VERIFY_SESSIONS_TABLE;
}

export function guestFlowFromStoredKind(kind: unknown): "calibrate" | "verify" {
  const raw = String(kind || "").trim().toLowerCase();
  if (raw === "calibrate" || raw === "scout" || raw === "scouting") return "calibrate";
  return "verify";
}

export function sessionShellForVerifyKind(kind: unknown): "dialog" | "solo" {
  const raw = String(kind || "").trim().toLowerCase();
  if (raw === "exercise" || raw === "solo" || raw === "prompt") return "solo";
  return "dialog";
}

function kindForLogicalTable(table: string): "learn" | "calibrate" | "verify" {
  return kindFromGuestLogicalTable(table);
}

async function findOnUnifiedSessions(
  supabase: GuestSessionClient,
  kind: "learn" | "calibrate" | "verify",
  input: {
    tokenHash?: string | null;
    publicToken?: string | null;
    id?: string | null;
    select?: string;
  },
): Promise<Record<string, unknown> | null> {
  const select = input.select || GUEST_SESSION_OPEN_SELECT;
  if (input.id) {
    const { data } = await supabase
      .from(UNIFIED_SESSIONS_TABLE)
      .select(select)
      .eq("id", input.id)
      .eq("kind", kind)
      .maybeSingle();
    if (data) return hydrateUnifiedGuestRow(data as Record<string, unknown>);
  }
  if (input.tokenHash) {
    const { data } = await supabase
      .from(UNIFIED_SESSIONS_TABLE)
      .select(select)
      .eq("private_token_hash", input.tokenHash)
      .eq("kind", kind)
      .maybeSingle();
    if (data) return hydrateUnifiedGuestRow(data as Record<string, unknown>);
  }
  if (input.publicToken) {
    const { data } = await supabase
      .from(UNIFIED_SESSIONS_TABLE)
      .select(select)
      .eq("public_token", input.publicToken)
      .eq("access_mode", "public")
      .eq("kind", kind)
      .maybeSingle();
    if (data) return hydrateUnifiedGuestRow(data as Record<string, unknown>);
  }
  return null;
}

/**
 * Resolve a Calibrate or Verify row. Physical storage is `sessions`.
 * The logical table argument keeps Calibrate and Verify isolated.
 */
export async function findGuestSessionOnTable(
  supabase: GuestSessionClient,
  table: CalibrateVerifyTable,
  input: {
    tokenHash?: string | null;
    publicToken?: string | null;
    id?: string | null;
    select?: string;
  },
): Promise<Record<string, unknown> | null> {
  return findOnUnifiedSessions(supabase, kindForLogicalTable(table), input);
}

/** Open a Calibrate guest session. Does not query Verify rows. */
export async function findCalibrateSessionByToken(
  supabase: GuestSessionClient,
  tokenHash: string,
  publicToken?: string | null,
  select?: string,
): Promise<Record<string, unknown> | null> {
  return findGuestSessionOnTable(supabase, CALIBRATE_SESSIONS_TABLE, {
    tokenHash,
    publicToken,
    select,
  });
}

/** Open a Verify guest session. Does not query Calibrate rows. */
export async function findVerifySessionByToken(
  supabase: GuestSessionClient,
  tokenHash: string,
  publicToken?: string | null,
  select?: string,
): Promise<Record<string, unknown> | null> {
  return findGuestSessionOnTable(supabase, VERIFY_SESSIONS_TABLE, {
    tokenHash,
    publicToken,
    select,
  });
}

export async function findCalibrateOrVerifySessionByToken(
  supabase: GuestSessionClient,
  tokenHash: string,
  publicToken?: string | null,
  select?: string,
): Promise<{ table: CalibrateVerifyTable; session: Record<string, unknown> } | null> {
  const calibrate = await findCalibrateSessionByToken(supabase, tokenHash, publicToken, select);
  if (calibrate) return { table: CALIBRATE_SESSIONS_TABLE, session: calibrate };
  const verify = await findVerifySessionByToken(supabase, tokenHash, publicToken, select);
  if (verify) return { table: VERIFY_SESSIONS_TABLE, session: verify };
  return null;
}

export async function insertGuestSession(
  supabase: GuestSessionClient,
  table: CalibrateVerifyTable,
  row: Record<string, unknown>,
  select = "*",
): Promise<{ data: Record<string, unknown> | null; error: unknown }> {
  const kind = kindForLogicalTable(table);
  const userId = String(row.user_id || "");
  if (!userId) return { data: null, error: { message: "user_id is required" } };
  const result = await insertUnifiedSession(
    supabase,
    {
      id: typeof row.id === "string" ? row.id : undefined,
      kind,
      user_id: userId,
      problem: kind === "calibrate" ? "Calibrate" : "Verify",
      status: typeof row.status === "string" ? row.status : "pending",
      workspace_id: (row.workspace_id as string | null) ?? null,
      block_id: (row.block_id as string | null) ?? null,
      calibrate_flow_id: kind === "calibrate" ? ((row.flow_id as string | null) ?? null) : null,
      verify_flow_id: kind === "verify" ? ((row.flow_id as string | null) ?? null) : null,
      guest_user_id: (row.guest_user_id as string | null) ?? null,
      assigned_user_id: (row.assigned_user_id as string | null) ?? null,
      organization_id: (row.organization_id as string | null) ?? null,
      private_token_hash: (row.private_token_hash as string | null) ?? null,
      public_token: (row.public_token as string | null) ?? null,
      access_mode: (row.access_mode as string | null) ?? null,
      identity: (row.identity as string | null) ?? null,
      guest_link: guestLinkFromRow(row),
    },
    select,
  );
  return {
    data: hydrateUnifiedGuestRow(result.data),
    error: result.error,
  };
}

export async function findCalibrateOrVerifySessionById(
  supabase: GuestSessionClient,
  id: string,
  select?: string,
): Promise<{ table: CalibrateVerifyTable; session: Record<string, unknown> } | null> {
  const calibrate = await findGuestSessionOnTable(supabase, CALIBRATE_SESSIONS_TABLE, { id, select });
  if (calibrate) return { table: CALIBRATE_SESSIONS_TABLE, session: calibrate };
  const verify = await findGuestSessionOnTable(supabase, VERIFY_SESSIONS_TABLE, { id, select });
  if (verify) return { table: VERIFY_SESSIONS_TABLE, session: verify };
  return null;
}

/** Persist kind + shell for a Calibrate or Verify insert. */
export function storedCalibrateVerifyWrite(kind: unknown): {
  table: CalibrateVerifyTable;
  interaction_kind: "calibrate" | "verify";
  session_shell: "dialog" | "solo" | null;
} {
  const flow = guestFlowFromStoredKind(kind);
  if (flow === "calibrate") {
    return {
      table: CALIBRATE_SESSIONS_TABLE,
      interaction_kind: "calibrate",
      session_shell: null,
    };
  }
  return {
    table: VERIFY_SESSIONS_TABLE,
    interaction_kind: "verify",
    session_shell: sessionShellForVerifyKind(kind),
  };
}
