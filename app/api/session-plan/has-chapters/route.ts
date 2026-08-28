import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { lookupSessionPlanChaptersForRequest } from "@/lib/session-plan-has-chapters-request";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const result = await lookupSessionPlanChaptersForRequest(body);
    if (!result.ok) return result.response;
    return NextResponse.json({ status: result.status, plan: result.plan });
  } catch (error) {
    console.error("[session-plan/has-chapters]", error);
    return jsonError(500, "Failed to check existing chapters");
  }
}
