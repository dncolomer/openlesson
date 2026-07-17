import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/require-admin";
import {
  parseLogoPayload,
  uploadOrganizationLogo,
} from "@/lib/organization/upload-logo";

export const runtime = "nodejs";

// POST /api/admin/organizations/[orgId]/logo — platform admin uploads org logo
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient } = auth;

    const body = await req.json().catch(() => ({}));
    const logo = parseLogoPayload(body);
    if (!logo) {
      return NextResponse.json(
        { error: "logo.data and logo.mimeType are required" },
        { status: 400 }
      );
    }

    const { data: organization, error: orgError } = await adminClient
      .from("organizations")
      .select("id")
      .eq("id", orgId)
      .single();

    if (orgError || !organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const result = await uploadOrganizationLogo(adminClient, orgId, logo);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ logo_url: result.logoUrl });
  } catch (error) {
    console.error("Admin organization logo upload error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
