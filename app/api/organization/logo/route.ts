import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  parseLogoPayload,
  uploadOrganizationLogo,
} from "@/lib/organization/upload-logo";

export const runtime = "nodejs";

// POST /api/organization/logo — org admin uploads / replaces their org logo
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const { user, supabase } = auth;

    const body = await req.json().catch(() => ({}));
    const logo = parseLogoPayload(body);
    if (!logo) {
      return jsonError(400, "logo.data and logo.mimeType are required");
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("organization_id, is_org_admin, is_admin")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.organization_id) {
      return jsonError(404, "Organization not found");
    }

    if (!profile.is_org_admin && !profile.is_admin) {
      return jsonError(403, "Only organization admins can update the logo");
    }

    const adminClient = createAdminClient();
    const result = await uploadOrganizationLogo(
      adminClient,
      profile.organization_id,
      logo
    );

    if (!result.ok) {
      return jsonError(result.status, result.error);
    }

    return NextResponse.json({ logo_url: result.logoUrl });
  } catch (error) {
    console.error("Organization logo upload error:", error);
    return jsonError(500, "Internal server error");
  }
}
