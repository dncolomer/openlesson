/**
 * Owner inspect: reference Unsys seed + the selected run's hidden-state walk.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import { resolveDashboardOrganizationId } from "@/lib/organization/dashboard-organization";
import { loadKnowledgeRegionUncertaintyModel } from "@/lib/knowledge-region-unsys";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const { id } = await context.params;
    const org = await resolveDashboardOrganizationId({
      req,
      userId: auth.user.id,
      email: auth.user.email,
    });
    if (!org.ok) return org.response;
    const candidateId = (req.nextUrl.searchParams.get("candidateId") || "").trim();
    const runId = (req.nextUrl.searchParams.get("runId") || "").trim();
    if (!candidateId) return jsonError(400, "candidateId is required");
    const loaded = await loadKnowledgeRegionUncertaintyModel({
      ownerUserId: auth.user.id,
      knowledgeRegionId: id,
      candidateId,
      runId: runId || null,
      organizationId: org.organizationId,
    });
    if (!loaded.ok) {
      return jsonError(loaded.status, loaded.message);
    }
    return NextResponse.json(loaded.payload);
  } catch (error) {
    return jsonError(
      500,
      error instanceof Error ? error.message : "Could not load uncertainty model",
    );
  }
}
