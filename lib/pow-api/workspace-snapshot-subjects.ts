/**
 * Collect distinct learner subjects for a workspace snapshot-all run.
 * Pure helpers are unit-tested; DB listing is server-only.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface SnapshotSubjectRef {
  user_id?: string | null;
  guest_user_id?: string | null;
}

function cleanId(value?: string | null): string | null {
  const t = typeof value === "string" ? value.trim() : "";
  return t ? t : null;
}

export function subjectKey(s: SnapshotSubjectRef): string {
  const g = cleanId(s.guest_user_id);
  const u = cleanId(s.user_id);
  if (g) return `g:${g}`;
  if (u) return `u:${u}`;
  return "";
}

/** Deduplicate subject refs; guest identity wins when both are present. */
export function dedupeSnapshotSubjects(subjects: SnapshotSubjectRef[]): SnapshotSubjectRef[] {
  const seen = new Set<string>();
  const out: SnapshotSubjectRef[] = [];
  for (const raw of subjects) {
    const guest = cleanId(raw.guest_user_id);
    const user = cleanId(raw.user_id);
    if (!guest && !user) continue;
    const ref: SnapshotSubjectRef = guest
      ? { guest_user_id: guest, user_id: null }
      : { user_id: user, guest_user_id: null };
    const key = subjectKey(ref);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(ref);
  }
  return out;
}

/**
 * Merge subjects from proof-of-work rows, session links, and optional owner id.
 */
export function collectWorkspaceSnapshotSubjects(input: {
  ownerUserId?: string | null;
  powRows?: Array<{ user_id?: string | null; guest_user_id?: string | null }>;
  sessionRows?: Array<{ user_id?: string | null }>;
  knowledgeSubjects?: Array<{
    user_id?: string | null;
    guest_user_id?: string | null;
  }>;
}): SnapshotSubjectRef[] {
  const raw: SnapshotSubjectRef[] = [];
  if (input.ownerUserId) {
    raw.push({ user_id: input.ownerUserId });
  }
  for (const row of input.powRows || []) {
    raw.push({ user_id: row.user_id, guest_user_id: row.guest_user_id });
  }
  for (const row of input.sessionRows || []) {
    if (row.user_id) raw.push({ user_id: row.user_id });
  }
  for (const row of input.knowledgeSubjects || []) {
    raw.push({ user_id: row.user_id, guest_user_id: row.guest_user_id });
  }
  return dedupeSnapshotSubjects(raw);
}

/**
 * Load distinct workspace subjects that may receive an LWM Snapshot.
 * Owner always included; also anyone with PoW, block_sessions, or prior knowledge configs.
 */
export async function listWorkspaceSnapshotSubjects(
  supabase: SupabaseClient,
  workspaceId: string,
  ownerUserId?: string | null,
): Promise<SnapshotSubjectRef[]> {
  const [powRes, sessionsRes, kcRes] = await Promise.all([
    supabase
      .from("workspace_proof_of_work")
      .select("user_id, guest_user_id")
      .eq("workspace_id", workspaceId)
      .limit(2000),
    supabase
      .from("block_sessions")
      .select("user_id")
      .eq("workspace_id", workspaceId)
      .limit(2000),
    supabase
      .from("knowledge_config_snapshots")
      .select("subject_user_id, subject_guest_user_id")
      .eq("workspace_id", workspaceId)
      .limit(1000),
  ]);

  if (powRes.error) {
    console.warn("[workspace-snapshot-subjects] pow list:", powRes.error.message);
  }
  if (sessionsRes.error) {
    console.warn("[workspace-snapshot-subjects] sessions list:", sessionsRes.error.message);
  }
  if (kcRes.error) {
    console.warn("[workspace-snapshot-subjects] knowledge list:", kcRes.error.message);
  }

  return collectWorkspaceSnapshotSubjects({
    ownerUserId,
    powRows: powRes.data || [],
    sessionRows: sessionsRes.data || [],
    knowledgeSubjects: (kcRes.data || []).map((r) => ({
      user_id: r.subject_user_id as string | null,
      guest_user_id: r.subject_guest_user_id as string | null,
    })),
  });
}
