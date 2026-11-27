import { after, NextRequest, NextResponse } from "next/server";
import { authenticateRequest, errorResponse } from "@/lib/pow-api/auth";
import {
  createAgentKnowledgeRegion,
  listAgentKnowledgeRegions,
  type AgentSimulationSchedule,
} from "@/lib/pow-api/agent-knowledge-region-management";
import { requireAgentRequestOrganization } from "@/lib/organization/request-organization";
import { tickRegionSimulationJob } from "@/lib/region-simulation-jobs";

export const runtime = "nodejs";
export const maxDuration = 60;

function scheduleTicks(schedule: AgentSimulationSchedule) {
  if (schedule.shouldContinue) after(() => tickRegionSimulationJob(schedule.jobId));
  const followUpJobId = schedule.followUpJobId;
  if (followUpJobId) after(() => tickRegionSimulationJob(followUpJobId));
}

export async function GET(req: NextRequest) {
  const result = await authenticateRequest(req, "workspaces:read");
  if (result instanceof NextResponse) return result;
  const ownerUserId = String(result.auth.user_id || "").trim();
  if (!ownerUserId) return errorResponse(401, "auth_required", "Not authenticated");
  const org = await requireAgentRequestOrganization(req, result.auth);
  if (!org.ok) return org.response;
  const knowledge_regions = await listAgentKnowledgeRegions(
    ownerUserId,
    org.organizationId,
  );
  return NextResponse.json({ knowledge_regions });
}

export async function POST(req: NextRequest) {
  const result = await authenticateRequest(req, "workspaces:write");
  if (result instanceof NextResponse) return result;
  const ownerUserId = String(result.auth.user_id || "").trim();
  if (!ownerUserId) return errorResponse(401, "auth_required", "Not authenticated");
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return errorResponse(400, "validation_error", "Invalid JSON body");
  }
  const org = await requireAgentRequestOrganization(req, result.auth, body);
  if (!org.ok) return org.response;
  try {
    const created = await createAgentKnowledgeRegion(
      ownerUserId,
      body,
      org.organizationId,
    );
    if (created.kind === "job") {
      scheduleTicks(created.schedule);
      return NextResponse.json(created.job, { status: 202 });
    }
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create knowledge region";
    const status = /not found/i.test(message) ? 404 : 400;
    return errorResponse(
      status,
      status === 404 ? "not_found" : "validation_error",
      message,
    );
  }
}
