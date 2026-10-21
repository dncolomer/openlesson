/**
 * Guest-session storage after the product-language cutover.
 * Calibrate, Verify, and Learn persist in three tables.
 */

export const CALIBRATE_SESSIONS_TABLE = "workspace_calibrate_sessions" as const;
export const VERIFY_SESSIONS_TABLE = "workspace_verify_sessions" as const;
export const LEARN_LINKS_TABLE = "workspace_learn_links" as const;

export type CalibrateVerifyTable =
  | typeof CALIBRATE_SESSIONS_TABLE
  | typeof VERIFY_SESSIONS_TABLE;

export type GuestFlowKind = "calibrate" | "verify" | "learn";

export const GUEST_SESSION_SELECT =
  "id, workspace_id, user_id, guest_user_id, assigned_user_id, organization_id, block_id, session_id, status, started_at, requested_duration_seconds, focus_block_ids, post_session, redirect_url, completion_webhook_url, access_mode, public_token, entry_query_params, interaction_kind, session_shell, show_end_session, workspaces!inner(user_id)";

export const GUEST_SESSION_OPEN_SELECT =
  "id, workspace_id, block_id, session_id, status, requested_duration_seconds, mode, voice_id, analysis, overall_score, marker_scores, assigned_user_id, guest_user_id, organization_id, user_id, post_session, redirect_url, show_end_session, interaction_kind, session_shell, entry_query_params, workspaces(title, user_id)";

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

/**
 * Resolve a Calibrate or Verify row on **one** table.
 * Tests drive this helper with a fake client to prove table isolation.
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
  const select = input.select || GUEST_SESSION_OPEN_SELECT;
  if (input.id) {
    const { data } = await supabase.from(table).select(select).eq("id", input.id).maybeSingle();
    if (data) return data as Record<string, unknown>;
  }
  if (input.tokenHash) {
    const { data } = await supabase
      .from(table)
      .select(select)
      .eq("private_token_hash", input.tokenHash)
      .maybeSingle();
    if (data) return data as Record<string, unknown>;
  }
  if (input.publicToken) {
    const { data } = await supabase
      .from(table)
      .select(select)
      .eq("public_token", input.publicToken)
      .eq("access_mode", "public")
      .maybeSingle();
    if (data) return data as Record<string, unknown>;
  }
  return null;
}

/** Open a Calibrate guest session. Does not query the Verify table. */
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

/** Open a Verify guest session. Does not query the Calibrate table. */
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
  const { data, error } = await supabase.from(table).insert(row).select(select).single();
  return { data: (data as Record<string, unknown> | null) ?? null, error };
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
