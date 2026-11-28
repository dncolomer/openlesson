import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, errorResponse } from "@/lib/pow-api/auth";
import { loadKnowledgeRegionCandidate } from "@/lib/knowledge-region-candidate";
import { requireAgentRequestOrganization } from "@/lib/organization/request-organization";

export const runtime = "nodejs";

interface RouteProps {
  params: Promise<{ id: string; candidateId: string }>;
}

export async function GET(req: NextRequest, { params }: RouteProps) {
  const result = await authenticateRequest(req, "knowledge-regions:read");
  if (result instanceof NextResponse) return result;
  const { auth } = result;
  const ownerUserId = String(auth.user_id || "").trim();
  if (!ownerUserId) return errorResponse(401, "auth_required", "Not authenticated");
  const org = await requireAgentRequestOrganization(req, auth);
  if (!org.ok) return org.response;
  const { id, candidateId } = await params;
  const space = req.nextUrl.searchParams.get("space");
  const loaded = await loadKnowledgeRegionCandidate({
    ownerUserId,
    knowledgeRegionId: id,
    candidateId,
    space,
    organizationId: org.organizationId,
  });
  if (!loaded.ok) {
    return errorResponse(loaded.status, loaded.code, loaded.message);
  }
  return NextResponse.json(loaded.payload);
}
