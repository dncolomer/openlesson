import crypto from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

export async function createAnonymousTapGuest(
  supabase: SupabaseClient,
  input: {
    workspaceId: string;
    organizationId: string | null;
    createdByUserId: string;
    createdByApiKeyId?: string | null;
  }
): Promise<{ id: string }> {
  if (!isUuid(input.workspaceId)) {
    throw new Error("workspaceId is required");
  }
  if (!isUuid(input.createdByUserId)) {
    throw new Error("createdByUserId is required");
  }

  const guestToken = crypto.randomUUID();
  const email = `anonymous+${guestToken}@tap-link.uncertain-systems`;

  const { data, error } = await supabase
    .from("organization_guest_users")
    .insert({
      organization_id: input.organizationId,
      workspace_id: input.workspaceId,
      email,
      created_by_user_id: input.createdByUserId,
      created_by_api_key_id: input.createdByApiKeyId || null,
      metadata: { type: "anonymous_tap_link" },
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Failed to create anonymous TAP participant");
  }

  return { id: data.id };
}