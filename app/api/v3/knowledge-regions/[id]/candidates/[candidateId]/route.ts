import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, errorResponse } from "@/lib/pow-api/auth";
import { loadKnowledgeRegionCandidate } from "@/lib/knowledge-region-candidate";

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
  const space = req.nextUrl.searchParams.get("space");
  const loaded = await loadKnowledgeRegionCandidate({
    ownerUserId,
    knowledgeRegionId: id,
    candidateId,
    space,
  });
  if (!loaded.ok) {
    return errorResponse(loaded.status, loaded.code, loaded.message);
  }
  return NextResponse.json(loaded.payload);
}
