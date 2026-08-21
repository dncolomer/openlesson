/**
 * AYCL buy/redeem forks are assigned to a generated auth guest, never the
 * catalog author — so they do not appear on the owner's dashboard list.
 */

import crypto from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function ayclForkGuestEmail(guestToken: string): string {
  const token = String(guestToken || "").trim();
  return `aycl-fork+${token}@aycl-guest.uncertain-systems`;
}

/**
 * Workspace `user_id` for a new AYCL private copy.
 * Must be the generated guest, and must not equal the catalog owner.
 */
export function ayclForkAssignedUserId(input: {
  catalogOwnerUserId: string;
  guestUserId: string;
}): string {
  const guest = String(input.guestUserId || "").trim();
  const owner = String(input.catalogOwnerUserId || "").trim();
  if (!guest || !UUID_RE.test(guest)) {
    throw new Error("AYCL fork requires a generated guest user");
  }
  if (!owner || !UUID_RE.test(owner)) {
    throw new Error("AYCL fork requires the catalog owner id");
  }
  if (guest === owner) {
    throw new Error("AYCL fork guest must not be the catalog owner");
  }
  return guest;
}

export function ayclForkWorkspaceParams(input: {
  sourceWorkspaceId: string;
  catalogOwnerUserId: string;
  guestUserId: string;
  title?: string;
}): {
  sourceWorkspaceId: string;
  ownerUserId: string;
  title?: string;
  originalWorkspaceId: string;
  isAyclFork: true;
} {
  return {
    sourceWorkspaceId: input.sourceWorkspaceId,
    ownerUserId: ayclForkAssignedUserId({
      catalogOwnerUserId: input.catalogOwnerUserId,
      guestUserId: input.guestUserId,
    }),
    title: input.title,
    originalWorkspaceId: input.sourceWorkspaceId,
    isAyclFork: true,
  };
}

/** Mint a real auth.users row so workspaces.user_id FK is legal. Never signs them in. */
export async function createAyclForkGuestUser(
  admin: SupabaseClient,
): Promise<{ id: string; email: string }> {
  const guestToken = crypto.randomUUID();
  const email = ayclForkGuestEmail(guestToken);
  const password = crypto.randomBytes(32).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { type: "aycl_fork_guest" },
  });
  if (error || !data.user?.id) {
    throw new Error(error?.message || "Failed to create AYCL fork guest user");
  }
  return { id: data.user.id, email };
}
