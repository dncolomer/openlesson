import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, errorResponse } from "@/lib/pow-api/auth";
import { listAgentKnowledgeRegionOptions } from "@/lib/pow-api/agent-knowledge-region-management";
import { requireAgentRequestOrganization } from "@/lib/organization/request-organization";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const result = await authenticateRequest(req, "knowledge-regions:read");
  if (result instanceof NextResponse) return result;
  const ownerUserId = String(result.auth.user_id || "").trim();
  if (!ownerUserId) return errorResponse(401, "auth_required", "Not authenticated");
  const org = await requireAgentRequestOrganization(req, result.auth);
  if (!org.ok) return org.response;
  try {
    const options = await listAgentKnowledgeRegionOptions(
      ownerUserId,
      org.organizationId,
    );
    return NextResponse.json(options);
  } catch (error) {
    return errorResponse(
      400,
      "validation_error",
      error instanceof Error ? error.message : "Failed to load knowledge region options",
    );
  }
}
