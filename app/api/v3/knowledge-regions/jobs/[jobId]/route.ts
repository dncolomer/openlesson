import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, errorResponse } from "@/lib/pow-api/auth";
import { getAgentKnowledgeRegionJob } from "@/lib/pow-api/agent-knowledge-region-management";
import { requireAgentRequestOrganization } from "@/lib/organization/request-organization";

export const runtime = "nodejs";

interface RouteProps {
  params: Promise<{ jobId: string }>;
}

export async function GET(req: NextRequest, { params }: RouteProps) {
  const result = await authenticateRequest(req, "knowledge-regions:read");
  if (result instanceof NextResponse) return result;
  const ownerUserId = String(result.auth.user_id || "").trim();
  if (!ownerUserId) return errorResponse(401, "auth_required", "Not authenticated");
  const org = await requireAgentRequestOrganization(req, result.auth);
  if (!org.ok) return org.response;
  const { jobId } = await params;
  const job = await getAgentKnowledgeRegionJob(ownerUserId, jobId, org.organizationId);
  if (!job) return errorResponse(404, "not_found", "Job not found");
  return NextResponse.json(job);
}
