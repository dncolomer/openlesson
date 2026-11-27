/**
 * Generate or deepen an Unsys seed during slow flow create.
 * Dashboard wizard has no workspace yet; owner auth is enough.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import { runProductFlowUnsysGenerate } from "@/lib/flow-unsys-generate";
import { resolveDashboardOrganizationId } from "@/lib/organization/dashboard-organization";
import { FLOW_UNSYS_SEED_PATH } from "@/lib/flow-unsys-seed";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const auth = await requireAuthenticatedUser();
  if (!auth.ok) return auth.response;
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const org = await resolveDashboardOrganizationId({
      req,
      userId: auth.user.id,
      email: auth.user.email,
      body,
    });
    if (!org.ok) return org.response;
    const result = await runProductFlowUnsysGenerate(body);
    if (!result.ok) {
      const status = result.error === "A problem is required." ? 400 : 502;
      return jsonError(status, result.error);
    }
    return NextResponse.json({
      path: FLOW_UNSYS_SEED_PATH,
      model: result.model,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The unsys field could not be generated.";
    return jsonError(500, message);
  }
}
