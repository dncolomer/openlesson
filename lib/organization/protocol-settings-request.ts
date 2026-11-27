import type { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import { resolveDashboardOrganizationId } from "@/lib/organization/dashboard-organization";
import { userIsOrgAdminForOrganization } from "@/lib/organization/membership-store";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function resolveProtocolSettingsRequest(input: {
  req: NextRequest;
  body?: Record<string, unknown> | null;
  adminOnly?: boolean;
}): Promise<
  | { ok: false; response: NextResponse }
  | {
      ok: true;
      userId: string;
      organizationId: string;
      isOrgAdmin: boolean;
      admin: SupabaseClient;
    }
> {
  const auth = await requireAuthenticatedUser();
  if (!auth.ok) return auth;
  const org = await resolveDashboardOrganizationId({
    req: input.req,
    userId: auth.user.id,
    email: auth.user.email,
    body: input.body,
  });
  if (!org.ok) return org;
  const organizationId = org.organizationId;
  if (!organizationId) {
    return { ok: false, response: jsonError(404, "Organization not found") };
  }
  const admin = createAdminClient();
  const isOrgAdmin = await userIsOrgAdminForOrganization(admin, {
    userId: auth.user.id,
    organizationId,
    email: auth.user.email,
  });
  if (input.adminOnly && !isOrgAdmin) {
    return {
      ok: false,
      response: jsonError(403, "Only organization admins can update protocol settings"),
    };
  }
  return {
    ok: true,
    userId: auth.user.id,
    organizationId,
    isOrgAdmin,
    admin,
  };
}
