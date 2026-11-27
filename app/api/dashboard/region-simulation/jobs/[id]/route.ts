import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import { resolveDashboardOrganizationId } from "@/lib/organization/dashboard-organization";
import {
  getRegionSimulationJob,
  jobMatchesOrganization,
  jobsPublicPayload,
} from "@/lib/region-simulation-jobs";

export const runtime = "nodejs";

export async function GET(
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
    const job = await getRegionSimulationJob(id);
    if (
      !job ||
      !jobMatchesOrganization(job, {
        userId: auth.user.id,
        organizationId: org.organizationId,
      })
    ) {
      return jsonError(404, "Job not found");
    }
    return NextResponse.json(jobsPublicPayload(job));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load job";
    return jsonError(500, message);
  }
}
