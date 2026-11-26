import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { canListAllOrganizations } from "@/lib/organization/membership";
import { listOrganizationMemberships } from "@/lib/organization/membership-store";

export const runtime = "nodejs";

export async function GET() {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const { user } = auth;

    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("organization_id, is_admin")
      .eq("id", user.id)
      .maybeSingle();

    const organizations = await listOrganizationMemberships(admin, user.id, {
      email: user.email,
    });

    return NextResponse.json({
      organizations,
      activeOrganizationId: profile?.organization_id ?? null,
      canListAll: canListAllOrganizations({
        isAdmin: profile?.is_admin === true,
        email: user.email,
      }),
    });
  } catch (error) {
    console.error("List organization memberships error:", error);
    return jsonError(
      500,
      error instanceof Error ? error.message : "Internal server error",
    );
  }
}
