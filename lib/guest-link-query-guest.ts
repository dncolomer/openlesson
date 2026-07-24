/**
 * Resolve guest identity for a TAP/ILE link open based on URL query params.
 *
 * - No params → use the link's provisioned guest_user_id (base guest).
 * - With params → same (link, param fingerprint) always maps to the same guest;
 *   different param name/value sets map to different guests. Param order ignored.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fingerprintEntryQueryParams,
  type EntryQueryParams,
  type GuestLinkKind,
} from "@/lib/guest-link-access";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

export type ResolveLinkQueryGuestInput = {
  linkKind: GuestLinkKind;
  linkId: string;
  workspaceId: string;
  organizationId: string | null;
  ownerUserId: string;
  /** Guest provisioned on the link at create time (used when params are empty). */
  baseGuestUserId: string | null;
  params: EntryQueryParams;
  createdByApiKeyId?: string | null;
};

export type ResolveLinkQueryGuestResult = {
  guestUserId: string | null;
  paramsFingerprint: string;
  /** True when a param-keyed guest was found or created (not the base link guest). */
  isParamScoped: boolean;
};

/**
 * Deterministic synthetic email for a (link, fingerprint) guest subject.
 * Unique per workspace via org_guest_users_workspace_email_unique.
 */
export function linkQueryGuestEmail(
  linkKind: GuestLinkKind,
  linkId: string,
  fingerprint: string,
): string {
  const domain =
    linkKind === "ile" ? "ile-link.uncertain-systems" : "tap-link.uncertain-systems";
  // Keep under practical email length limits; fingerprint is 64 hex chars.
  return `linkq+${linkKind}.${linkId}.${fingerprint}@${domain}`;
}

export async function resolveGuestForLinkQueryParams(
  supabase: SupabaseClient,
  input: ResolveLinkQueryGuestInput,
): Promise<ResolveLinkQueryGuestResult> {
  const fingerprint = fingerprintEntryQueryParams(input.params);
  if (!fingerprint) {
    return {
      guestUserId: input.baseGuestUserId,
      paramsFingerprint: "",
      isParamScoped: false,
    };
  }

  if (!isUuid(input.linkId) || !isUuid(input.workspaceId) || !isUuid(input.ownerUserId)) {
    return {
      guestUserId: input.baseGuestUserId,
      paramsFingerprint: fingerprint,
      isParamScoped: false,
    };
  }

  const email = linkQueryGuestEmail(input.linkKind, input.linkId, fingerprint);
  const guestType =
    input.linkKind === "ile" ? "anonymous_ile_link_query" : "anonymous_tap_link_query";

  const { data: existing } = await supabase
    .from("organization_guest_users")
    .select("id, status")
    .eq("workspace_id", input.workspaceId)
    .eq("email", email)
    .maybeSingle();

  if (existing?.id && existing.status === "active") {
    return {
      guestUserId: existing.id,
      paramsFingerprint: fingerprint,
      isParamScoped: true,
    };
  }

  const { data: created, error } = await supabase
    .from("organization_guest_users")
    .insert({
      organization_id: input.organizationId,
      workspace_id: input.workspaceId,
      email,
      created_by_user_id: input.ownerUserId,
      created_by_api_key_id: input.createdByApiKeyId || null,
      metadata: {
        type: guestType,
        link_kind: input.linkKind,
        link_id: input.linkId,
        params_fingerprint: fingerprint,
        entry_query_params: input.params,
      },
    })
    .select("id")
    .single();

  if (error || !created) {
    // Race: another open created the same email — re-fetch.
    const { data: raced } = await supabase
      .from("organization_guest_users")
      .select("id")
      .eq("workspace_id", input.workspaceId)
      .eq("email", email)
      .maybeSingle();
    if (raced?.id) {
      return {
        guestUserId: raced.id,
        paramsFingerprint: fingerprint,
        isParamScoped: true,
      };
    }
    console.error("[guest-link-query-guest] create failed:", error);
    return {
      guestUserId: input.baseGuestUserId,
      paramsFingerprint: fingerprint,
      isParamScoped: false,
    };
  }

  return {
    guestUserId: created.id,
    paramsFingerprint: fingerprint,
    isParamScoped: true,
  };
}
