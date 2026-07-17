import { NextRequest, NextResponse } from "next/server";
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
      return NextResponse.json(
        { error: "logo.data and logo.mimeType are required" },
        { status: 400 }
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("organization_id, is_org_admin, is_admin")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.organization_id) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    if (!profile.is_org_admin && !profile.is_admin) {
      return NextResponse.json(
        { error: "Only organization admins can update the logo" },
        { status: 403 }
      );
    }

    const adminClient = createAdminClient();
    const result = await uploadOrganizationLogo(
      adminClient,
      profile.organization_id,
      logo
    );

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ logo_url: result.logoUrl });
  } catch (error) {
    console.error("Organization logo upload error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
