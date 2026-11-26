import { after, NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import {
  getRegionSimulationJob,
  jobsPublicPayload,
  REGION_SIM_TICK_MAX_DURATION,
  tickRegionSimulationJob,
} from "@/lib/region-simulation-jobs";

export const runtime = "nodejs";
export const maxDuration = REGION_SIM_TICK_MAX_DURATION;

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const { id } = await context.params;
    const existing = await getRegionSimulationJob(id, auth.user.id);
    if (!existing) return jsonError(404, "Job not found");
    const ticked = await tickRegionSimulationJob(id);
    if (ticked.shouldContinue) after(() => tickRegionSimulationJob(id));
    const followUpId = ticked.followUpJobId;
    if (followUpId) after(() => tickRegionSimulationJob(followUpId));
    return NextResponse.json(jobsPublicPayload(ticked.job));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to tick job";
    return jsonError(500, message);
  }
}
