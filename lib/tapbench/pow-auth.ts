/**
 * TAPBench keys as Proof-of-Work API Bearer tokens (task-scoped, no Teams gate).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthContext, ApiKeyScope } from "@/lib/pow-api/types";
import { hasScope } from "@/lib/pow-api/scopes";
import type { StashTapbenchContext } from "@/lib/pow-api/stash-api";
import { TAPBENCH_KEY_PREFIX } from "./constants";
import {
  authenticateTapbenchKey,
  memoryTapbenchKeyStore,
  type TapbenchIssuedKey,
  type TapbenchKeyStore,
} from "./keys";
import { supabaseTapbenchKeyStore } from "./store-supabase";

export const TAPBENCH_POW_SCOPES: ApiKeyScope[] = ["workspaces:read", "workspaces:write"];

export function isTapbenchKeyMaterial(raw: string): boolean {
  return raw.trim().startsWith(TAPBENCH_KEY_PREFIX);
}

export function authContextFromTapbenchKey(key: TapbenchIssuedKey): AuthContext {
  return {
    user_id: key.user_id,
    guest_user_id: null,
    organization_id: null,
    is_org_admin: false,
    key_id: key.id,
    scopes: TAPBENCH_POW_SCOPES,
    auth_method: "tapbench_key",
    tapbench_workspace_id: key.workspace_id,
  };
}

export async function authenticateTapbenchPowKey(
  apiKey: string,
  requiredScope: ApiKeyScope,
  supabase: SupabaseClient,
  store?: TapbenchKeyStore,
): Promise<{ ok: true; auth: AuthContext } | { ok: false; status: number; code: string; message: string }> {
  const stores: TapbenchKeyStore[] = store
    ? [store]
    : [supabaseTapbenchKeyStore(supabase), memoryTapbenchKeyStore];

  let lastFail: { code: string; message: string } | null = null;
  let key: TapbenchIssuedKey | null = null;
  for (const candidate of stores) {
    const result = await authenticateTapbenchKey(apiKey, candidate);
    if (result.ok) {
      key = result.key;
      break;
    }
    lastFail = { code: result.code, message: result.message };
  }
  if (!key) {
    const code = lastFail?.code || "unauthorized";
    const status =
      code === "session_stopped" ? 409 : code === "forbidden" ? 403 : 401;
    return {
      ok: false,
      status,
      code,
      message: lastFail?.message || "Invalid TAPBench key",
    };
  }
  const auth = authContextFromTapbenchKey(key);
  if (!hasScope(auth.scopes, requiredScope)) {
    return {
      ok: false,
      status: 403,
      code: "forbidden",
      message: `This TAPBench key does not have the required scope: ${requiredScope}`,
    };
  }
  return { ok: true, auth };
}

/** Stash/Submit treats a TAPBench key like a live TAP session (no clock). */
export function stashContextFromTapbenchKey(
  auth: AuthContext,
  workspaceId: string,
): StashTapbenchContext | null {
  if (auth.auth_method !== "tapbench_key" || !auth.tapbench_workspace_id) return null;
  if (auth.tapbench_workspace_id !== workspaceId) return null;
  const yearMs = 365 * 24 * 60 * 60 * 1000;
  return {
    linkId: auth.key_id,
    exercise: "",
    expires_at: new Date(Date.now() + yearMs).toISOString(),
    remaining_ms: yearMs,
    duration_seconds: 0,
    session_token: "",
    block_id: null,
    workspace_id: auth.tapbench_workspace_id,
    guest_user_id: auth.guest_user_id ?? null,
  };
}
