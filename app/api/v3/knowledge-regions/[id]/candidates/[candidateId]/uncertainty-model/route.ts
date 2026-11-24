import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, errorResponse } from "@/lib/pow-api/auth";
import { loadKnowledgeRegionUncertaintyModel } from "@/lib/knowledge-region-unsys";

export const runtime = "nodejs";

interface RouteProps {
  params: Promise<{ id: string; candidateId: string }>;
}

export async function GET(req: NextRequest, { params }: RouteProps) {
  const result = await authenticateRequest(req, "workspaces:read");
  if (result instanceof NextResponse) return result;
  const { auth } = result;
  const ownerUserId = String(auth.user_id || "").trim();
  if (!ownerUserId) return errorResponse(401, "auth_required", "Not authenticated");
  const { id, candidateId } = await params;
  const runId = req.nextUrl.searchParams.get("run_id") || req.nextUrl.searchParams.get("runId");
  const loaded = await loadKnowledgeRegionUncertaintyModel({
    ownerUserId,
    knowledgeRegionId: id,
    candidateId,
    runId,
  });
  if (!loaded.ok) {
    return errorResponse(loaded.status, loaded.code, loaded.message);
  }
  return NextResponse.json(loaded.payload);
}
