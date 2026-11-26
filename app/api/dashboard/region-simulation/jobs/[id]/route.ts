import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import { getRegionSimulationJob, jobsPublicPayload } from "@/lib/region-simulation-jobs";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const { id } = await context.params;
    const job = await getRegionSimulationJob(id, auth.user.id);
    if (!job) return jsonError(404, "Job not found");
    return NextResponse.json(jobsPublicPayload(job));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load job";
    return jsonError(500, message);
  }
}
