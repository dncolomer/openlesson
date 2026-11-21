import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import { getAppOrigin } from "@/lib/app-url";
import { createAdminClient } from "@/lib/supabase/admin";
import { authorizeOrgBackendEdit } from "@/lib/organization/org-backends";
import { createWorkOsSsoOnboarding } from "@/lib/workos/client";
import { workOsClientConfigFromEnv } from "@/lib/workos/config";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;

    const { data: profile, error: profileError } = await auth.supabase
      .from("profiles")
      .select("organization_id, is_org_admin")
      .eq("id", auth.user.id)
      .single();
    if (profileError || !profile) return jsonError(404, "Organization not found");
    const guard = authorizeOrgBackendEdit(profile);
    if (!guard.ok) return jsonError(guard.status, guard.error);

    const config = workOsClientConfigFromEnv(process.env, getAppOrigin(req));
    if ("error" in config) return jsonError(503, config.error);

    const admin = createAdminClient();
    const { data: org, error: orgError } = await admin
      .from("organizations")
      .select("id, name, workos_organization_id")
      .eq("id", guard.organizationId)
      .single();
    if (orgError || !org) return jsonError(404, "Organization not found");

    const domain = String(auth.user.email || "")
      .split("@")[1]
      ?.trim()
      .toLowerCase();
    const onboarding = await createWorkOsSsoOnboarding({
      config,
      name: String(org.name || "Organization"),
      domain: domain && !/gmail\.com|outlook\.com|hotmail\.com|yahoo\.com/.test(domain) ? domain : null,
      existingOrganizationId: org.workos_organization_id,
      returnUrl: `${getAppOrigin(req)}/dashboard?tab=organization`,
    });

    if (!org.workos_organization_id) {
      await admin
        .from("organizations")
        .update({ workos_organization_id: onboarding.organizationId })
        .eq("id", org.id);
    }

    return NextResponse.json({
      organizationId: onboarding.organizationId,
      setupUrl: onboarding.setupUrl,
      connectionId: onboarding.connectionId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not start SSO setup";
    console.error("[workos/sso]", message);
    return jsonError(500, message);
  }
}
