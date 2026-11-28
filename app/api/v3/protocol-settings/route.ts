import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, errorResponse } from "@/lib/pow-api/auth";
import { requireAgentRequestOrganization } from "@/lib/organization/request-organization";
import { presentProtocolSettingJson } from "@/lib/organization/protocol-settings";
import { listProtocolSettings } from "@/lib/organization/protocol-settings-store";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const result = await authenticateRequest(req, "protocols:read");
  if (result instanceof NextResponse) return result;
  const { auth } = result;
  const org = await requireAgentRequestOrganization(req, auth);
  if (!org.ok) return org.response;
  try {
    const listed = await listProtocolSettings(createAdminClient(), org.organizationId);
    return NextResponse.json({
      protocol_settings: listed.settings.map(presentProtocolSettingJson),
    });
  } catch (error) {
    return errorResponse(
      500,
      "internal_error",
      error instanceof Error ? error.message : "Failed to list protocol settings",
    );
  }
}
