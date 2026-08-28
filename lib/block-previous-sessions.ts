/**
 * Practice drawer: list this block’s past ILE sessions and continue by id.
 * Continue never inserts a new `sessions` row.
 */

export const SEE_PREVIOUS_SESSIONS_LABEL = "See Previous Sessions";
export const START_NEW_SESSION_LABEL = "Start a New Session";
export const PREVIOUS_SESSIONS_DRAWER_ID = "previous_sessions";
export const WORKSPACE_BLOCK_SESSIONS_PATH = "/api/workspace/block-sessions";

/** Load the list whenever this drawer is open (header click or the button). */
export function previousSessionsDrawerShouldLoad(
  openDrawerId: string | null | undefined,
): boolean {
  return openDrawerId === PREVIOUS_SESSIONS_DRAWER_ID;
}

export type BlockPreviousSession = {
  sessionId: string;
  startedAt: string;
  status?: string;
};

export type IleLaunchKind = "new" | "continue";

export const CONTINUE_SESSION_RESUME_PARAM = "resume";

export function continueIleSessionHref(sessionId: string): string {
  const id = String(sessionId || "").trim();
  const params = new URLSearchParams({
    id,
    [CONTINUE_SESSION_RESUME_PARAM]: "1",
  });
  return `/session?${params.toString()}`;
}

export function isIleResumeQuery(value: string | null | undefined): boolean {
  const v = String(value || "").trim();
  return v === "1" || v === "true" || v === "yes";
}

/** New Play inserts; continue navigates to the chosen session id. */
export function ileLaunchInsertsNewSession(kind: IleLaunchKind): boolean {
  return kind === "new";
}

export function normalizeBlockPreviousSessionRow(row: {
  sessionId?: unknown;
  session_id?: unknown;
  startedAt?: unknown;
  created_at?: unknown;
  status?: unknown;
}): BlockPreviousSession | null {
  const sessionId = String(row.sessionId ?? row.session_id ?? "").trim();
  const startedAt = String(row.startedAt ?? row.created_at ?? "").trim();
  if (!sessionId || !startedAt) return null;
  const status = row.status != null ? String(row.status).trim() : "";
  return {
    sessionId,
    startedAt,
    ...(status ? { status } : {}),
  };
}

export function normalizeBlockPreviousSessions(
  rows: unknown,
): BlockPreviousSession[] {
  if (!Array.isArray(rows)) return [];
  const out: BlockPreviousSession[] = [];
  const seen = new Set<string>();
  for (const raw of rows) {
    if (!raw || typeof raw !== "object") continue;
    const entry = normalizeBlockPreviousSessionRow(
      raw as Record<string, unknown>,
    );
    if (!entry || seen.has(entry.sessionId)) continue;
    seen.add(entry.sessionId);
    out.push(entry);
  }
  return out;
}

/**
 * Shipped list entry the block-sessions API uses. Joins `block_sessions` to
 * `sessions` for id + timestamp. Does not insert.
 */
export async function listBlockPreviousSessions(
  supabase: { from: (table: string) => any },
  input: { workspaceId: string; blockId: string },
): Promise<BlockPreviousSession[]> {
  const workspaceId = String(input.workspaceId || "").trim();
  const blockId = String(input.blockId || "").trim();
  if (!workspaceId || !blockId) return [];

  const { data: joins, error: joinError } = await supabase
    .from("block_sessions")
    .select("session_id, created_at")
    .eq("workspace_id", workspaceId)
    .eq("block_id", blockId)
    .order("created_at", { ascending: false });
  if (joinError) {
    const message =
      joinError && typeof joinError === "object" && "message" in joinError
        ? String((joinError as { message?: unknown }).message || "")
        : "Failed to list sessions";
    throw new Error(message || "Failed to list sessions");
  }

  const joinRows = Array.isArray(joins) ? joins : [];
  const ids = [
    ...new Set(
      joinRows
        .map((row) =>
          row && typeof row === "object"
            ? String((row as { session_id?: unknown }).session_id || "").trim()
            : "",
        )
        .filter(Boolean),
    ),
  ];
  if (ids.length === 0) return [];

  const { data: sessionRows, error: sessionError } = await supabase
    .from("sessions")
    .select("id, created_at, status")
    .in("id", ids);
  if (sessionError) {
    return normalizeBlockPreviousSessions(
      joinRows.map((row) => {
        const rec = row as { session_id?: string; created_at?: string };
        return {
          sessionId: rec.session_id,
          startedAt: rec.created_at,
        };
      }),
    );
  }

  const byId = new Map<string, { created_at?: string; status?: string }>();
  if (Array.isArray(sessionRows)) {
    for (const row of sessionRows) {
      if (!row || typeof row !== "object") continue;
      const rec = row as { id?: string; created_at?: string; status?: string };
      const id = String(rec.id || "").trim();
      if (id) byId.set(id, rec);
    }
  }

  return normalizeBlockPreviousSessions(
    joinRows.map((row) => {
      const rec = row as { session_id?: string; created_at?: string };
      const id = String(rec.session_id || "").trim();
      const session = byId.get(id);
      return {
        sessionId: id,
        startedAt: session?.created_at || rec.created_at,
        status: session?.status,
      };
    }),
  );
}

export async function fetchBlockPreviousSessions(
  workspaceId: string,
  blockId: string,
  guestAccessBody: Record<string, unknown> = {},
): Promise<BlockPreviousSession[]> {
  const res = await fetch(WORKSPACE_BLOCK_SESSIONS_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      workspaceId,
      blockId,
      ...guestAccessBody,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    sessions?: unknown;
    error?: unknown;
  };
  if (!res.ok) {
    const err = json.error;
    const message =
      typeof err === "string"
        ? err
        : err && typeof err === "object" && "message" in err
          ? String((err as { message?: unknown }).message || "Failed to list sessions")
          : "Failed to list sessions";
    throw new Error(message);
  }
  return normalizeBlockPreviousSessions(json.sessions);
}
