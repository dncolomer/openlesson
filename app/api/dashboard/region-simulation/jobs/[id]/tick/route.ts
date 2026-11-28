import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import { resolveDashboardOrganizationId } from "@/lib/organization/dashboard-organization";
import {
  getRegionSimulationJob,
  jobMatchesOrganization,
  jobsPublicPayload,
  tickRegionSimulationJob,
} from "@/lib/region-simulation-jobs";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const org = await resolveDashboardOrganizationId({
      req,
      userId: auth.user.id,
      email: auth.user.email,
    });
    if (!org.ok) return org.response;
    const { id } = await context.params;
    const existing = await getRegionSimulationJob(id);
    if (
      !existing ||
      !jobMatchesOrganization(existing, {
        userId: auth.user.id,
        organizationId: org.organizationId,
      })
    ) {
      return jsonError(404, "Job not found");
    }
    const ticked = await tickRegionSimulationJob(id);
    return NextResponse.json(jobsPublicPayload(ticked.job));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to tick job";
    return jsonError(500, message);
  }
}
