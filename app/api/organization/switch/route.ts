import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { switchActiveOrganization } from "@/lib/organization/membership-store";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const { user } = auth;

    const body = await req.json().catch(() => ({}));
    const organizationId =
      typeof body.organizationId === "string" ? body.organizationId.trim() : "";
    if (!organizationId) return jsonError(400, "organizationId is required");

    const result = await switchActiveOrganization(
      createAdminClient(),
      user.id,
      organizationId,
      { email: user.email },
    );

    return NextResponse.json({
      organizationId: result.organizationId,
      is_org_admin: result.isOrgAdmin,
    });
  } catch (error) {
    const status = (error as { status?: number })?.status;
    console.error("Switch organization error:", error);
    return jsonError(
      status === 403 || status === 404 ? status : 500,
      error instanceof Error ? error.message : "Internal server error",
    );
  }
}
