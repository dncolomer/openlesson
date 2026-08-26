/**
 * TAPBench operator key → many guest subjects (runs).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import type { AuthContext } from "@/lib/pow-api/types";
import { createAnonymousTapGuest } from "@/lib/pow-api/anonymous-tap-guest";

export type TapbenchKeyGuest = {
  id: string;
  key_id: string;
  guest_user_id: string;
  workspace_id: string;
  label: string | null;
  created_at: string;
  stopped_at: string | null;
};

export interface TapbenchGuestStore {
  insert(row: TapbenchKeyGuest): Promise<TapbenchKeyGuest>;
  listByKey(keyId: string): Promise<TapbenchKeyGuest[]>;
  getByGuest(keyId: string, guestUserId: string): Promise<TapbenchKeyGuest | null>;
  markStopped(keyId: string, guestUserId: string, atIso: string): Promise<void>;
}

const memoryByKey = new Map<string, TapbenchKeyGuest[]>();

export function resetTapbenchGuestStoreForTests(): void {
  memoryByKey.clear();
}

export const memoryTapbenchGuestStore: TapbenchGuestStore = {
  async insert(row) {
    const list = memoryByKey.get(row.key_id) ?? [];
    const copy = { ...row };
    list.push(copy);
    memoryByKey.set(row.key_id, list);
    return { ...copy };
  },
  async listByKey(keyId) {
    return (memoryByKey.get(keyId) ?? []).map((g) => ({ ...g }));
  },
  async getByGuest(keyId, guestUserId) {
    const hit = (memoryByKey.get(keyId) ?? []).find((g) => g.guest_user_id === guestUserId);
    return hit ? { ...hit } : null;
  },
  async markStopped(keyId, guestUserId, atIso) {
    const list = memoryByKey.get(keyId) ?? [];
    memoryByKey.set(
      keyId,
      list.map((g) => (g.guest_user_id === guestUserId ? { ...g, stopped_at: atIso } : g)),
    );
  },
};

function parseGuest(raw: Record<string, unknown>): TapbenchKeyGuest {
  return {
    id: String(raw.id),
    key_id: String(raw.key_id),
    guest_user_id: String(raw.guest_user_id),
    workspace_id: String(raw.workspace_id),
    label: (raw.label as string | null) ?? null,
    created_at: String(raw.created_at || ""),
    stopped_at: (raw.stopped_at as string | null) ?? null,
  };
}

export function supabaseTapbenchGuestStore(supabase: SupabaseClient): TapbenchGuestStore {
  return {
    async insert(row) {
      const { data, error } = await supabase
        .from("tapbench_key_guests")
        .insert({
          id: row.id,
          key_id: row.key_id,
          guest_user_id: row.guest_user_id,
          workspace_id: row.workspace_id,
          label: row.label,
          created_at: row.created_at,
          stopped_at: row.stopped_at,
        })
        .select("id, key_id, guest_user_id, workspace_id, label, created_at, stopped_at")
        .single();
      if (error || !data) {
        throw new Error(error?.message || "Failed to store TAPBench guest");
      }
      return parseGuest(data as Record<string, unknown>);
    },
    async listByKey(keyId) {
      const { data, error } = await supabase
        .from("tapbench_key_guests")
        .select("id, key_id, guest_user_id, workspace_id, label, created_at, stopped_at")
        .eq("key_id", keyId)
        .order("created_at", { ascending: true });
      if (error || !data) return [];
      return data.map((row) => parseGuest(row as Record<string, unknown>));
    },
    async getByGuest(keyId, guestUserId) {
      const { data, error } = await supabase
        .from("tapbench_key_guests")
        .select("id, key_id, guest_user_id, workspace_id, label, created_at, stopped_at")
        .eq("key_id", keyId)
        .eq("guest_user_id", guestUserId)
        .maybeSingle();
      if (error || !data) return null;
      return parseGuest(data as Record<string, unknown>);
    },
    async markStopped(keyId, guestUserId, atIso) {
      await supabase
        .from("tapbench_key_guests")
        .update({ stopped_at: atIso })
        .eq("key_id", keyId)
        .eq("guest_user_id", guestUserId);
    },
  };
}

export function tapbenchGuestIdFromRequest(
  req: NextRequest,
  body?: Record<string, unknown> | null,
): string | null {
  const header =
    req.headers.get("X-Tapbench-Guest") ||
    req.headers.get("x-tapbench-guest") ||
    "";
  if (header.trim()) return header.trim();
  const q = req.nextUrl?.searchParams?.get("guest_user_id")?.trim();
  if (q) return q;
  if (body && typeof body.guest_user_id === "string" && body.guest_user_id.trim()) {
    return body.guest_user_id.trim();
  }
  return null;
}

export async function assertTapbenchGuestForKey(
  store: TapbenchGuestStore,
  keyId: string,
  guestUserId: string,
): Promise<TapbenchKeyGuest> {
  const row = await store.getByGuest(keyId, guestUserId);
  if (!row) {
    throw Object.assign(new Error("Unknown TAPBench guest for this key"), {
      status: 404,
      code: "guest_not_found",
    });
  }
  return row;
}

const MAX_MINT = 25;

export async function mintTapbenchGuests(options: {
  supabase: SupabaseClient;
  auth: AuthContext;
  workspaceId: string;
  count?: number;
  label?: string | null;
  store?: TapbenchGuestStore;
  nowMs?: number;
}): Promise<TapbenchKeyGuest[]> {
  const count = Math.min(MAX_MINT, Math.max(1, Math.trunc(options.count ?? 1)));
  const { data: workspace } = await options.supabase
    .from("workspaces")
    .select("id, user_id, organization_id")
    .eq("id", options.workspaceId)
    .maybeSingle();
  if (!workspace) {
    throw Object.assign(new Error("Workspace not found"), {
      status: 404,
      code: "workspace_not_found",
    });
  }
  const createdByUserId = options.auth.user_id || workspace.user_id;
  if (!createdByUserId) {
    throw Object.assign(new Error("Workspace owner is missing"), {
      status: 500,
      code: "internal_error",
    });
  }

  const store = options.store ?? supabaseTapbenchGuestStore(options.supabase);
  const now = new Date(options.nowMs ?? Date.now()).toISOString();
  const minted: TapbenchKeyGuest[] = [];
  for (let i = 0; i < count; i += 1) {
    const guest = await createAnonymousTapGuest(options.supabase, {
      workspaceId: options.workspaceId,
      organizationId: workspace.organization_id ?? options.auth.organization_id,
      createdByUserId,
      createdByApiKeyId: null,
      guestType: "anonymous_tapbench_link",
    });
    const label =
      options.label?.trim() ||
      (count > 1 ? `run ${i + 1}` : "run");
    const row = await store.insert({
      id: guest.id,
      key_id: options.auth.key_id,
      guest_user_id: guest.id,
      workspace_id: options.workspaceId,
      label,
      created_at: now,
      stopped_at: null,
    });
    minted.push(row);
  }
  return minted;
}
