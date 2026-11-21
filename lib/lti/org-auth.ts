import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { NextResponse } from "next/server";

export type LtiOrgAdmin =
  | {
      ok: true;
      userId: string;
      organizationId: string;
    }
  | { ok: false; response: NextResponse };

export async function requireLtiOrgAdmin(): Promise<LtiOrgAdmin> {
  const auth = await requireAuthenticatedUser();
  if (!auth.ok) return auth;
  const { data: profile } = await createAdminClient()
    .from("profiles")
    .select("organization_id, is_org_admin")
    .eq("id", auth.user.id)
    .maybeSingle();
  const organizationId = String(profile?.organization_id || "").trim();
  if (!organizationId) {
    return { ok: false, response: jsonError(400, "Join an organization to register an LMS") };
  }
  if (!profile?.is_org_admin) {
    return { ok: false, response: jsonError(403, "Organization admin required") };
  }
  return { ok: true, userId: auth.user.id, organizationId };
}
