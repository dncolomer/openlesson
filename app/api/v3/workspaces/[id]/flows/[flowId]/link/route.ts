import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, errorResponse } from "@/lib/pow-api/auth";
import { linkAgentFlowToBlock } from "@/lib/pow-api/agent-flow-management";

export const runtime = "nodejs";

interface RouteProps {
  params: Promise<{ id: string; flowId: string }>;
}

export async function POST(req: NextRequest, { params }: RouteProps) {
  const result = await authenticateRequest(req, "workspaces:write");
  if (result instanceof NextResponse) return result;
  const { auth, supabase } = result;
  const { id: workspaceId, flowId } = await params;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return errorResponse(400, "validation_error", "Invalid JSON body");
  }
  const blockId = String(body.block_id || body.blockId || "").trim();
  try {
    const linked = await linkAgentFlowToBlock(supabase, auth, workspaceId, flowId, blockId);
    return NextResponse.json(linked);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to link flow";
    const notFound =
      message === "Workspace not found." ||
      message === "Flow not found." ||
      message === "Block not found in this workspace.";
    return errorResponse(
      notFound ? 404 : 400,
      notFound ? "not_found" : "validation_error",
      message,
    );
  }
}
