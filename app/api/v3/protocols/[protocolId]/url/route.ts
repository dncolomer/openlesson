import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, errorResponse } from "@/lib/pow-api/auth";
import { getAgentProtocolUrl } from "@/lib/pow-api/agent-flow-management";
import { requireAgentRequestOrganization } from "@/lib/organization/request-organization";
import { getAppOrigin } from "@/lib/app-url";

export const runtime = "nodejs";

interface RouteProps {
  params: Promise<{ protocolId: string }>;
}

export async function GET(req: NextRequest, { params }: RouteProps) {
  const result = await authenticateRequest(req, "protocols:read");
  if (result instanceof NextResponse) return result;
  const { auth } = result;
  const org = await requireAgentRequestOrganization(req, auth);
  if (!org.ok) return org.response;
  const { protocolId } = await params;
  const query = Object.fromEntries(req.nextUrl.searchParams.entries());
  const launch = await getAgentProtocolUrl(
    undefined,
    protocolId,
    String(auth.user_id || ""),
    org.organizationId,
    getAppOrigin(req),
    query,
  );
  if (!launch) return errorResponse(404, "not_found", "Protocol not found");
  return NextResponse.json(launch);
}
