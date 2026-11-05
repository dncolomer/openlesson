import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, errorResponse } from "@/lib/pow-api/auth";
import {
  deleteAgentFlow,
  getAgentFlow,
  updateAgentFlow,
} from "@/lib/pow-api/agent-flow-management";

export const runtime = "nodejs";

interface RouteProps {
  params: Promise<{ flowId: string }>;
}

export async function GET(req: NextRequest, { params }: RouteProps) {
  const result = await authenticateRequest(req, "workspaces:read");
  if (result instanceof NextResponse) return result;
  const { auth } = result;
  const { flowId } = await params;
  const flow = await getAgentFlow(undefined, flowId, String(auth.user_id || ""));
  if (!flow) return errorResponse(404, "not_found", "Flow not found");
  return NextResponse.json({ flow });
}

export async function PATCH(req: NextRequest, { params }: RouteProps) {
  const result = await authenticateRequest(req, "workspaces:write");
  if (result instanceof NextResponse) return result;
  const { auth } = result;
  const { flowId } = await params;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return errorResponse(400, "validation_error", "Invalid JSON body");
  }
  try {
    const flow = await updateAgentFlow(auth, undefined, flowId, body);
    return NextResponse.json({ flow });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update flow";
    const status = message === "Flow not found." ? 404 : 400;
    return errorResponse(
      status,
      status === 404 ? "not_found" : "validation_error",
      message,
    );
  }
}

export async function DELETE(req: NextRequest, { params }: RouteProps) {
  const result = await authenticateRequest(req, "workspaces:write");
  if (result instanceof NextResponse) return result;
  const { auth } = result;
  const { flowId } = await params;
  try {
    const deleted = await deleteAgentFlow(auth, flowId);
    return NextResponse.json(deleted);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete flow";
    const status = message === "Flow not found." ? 404 : 400;
    return errorResponse(
      status,
      status === 404 ? "not_found" : "validation_error",
      message,
    );
  }
}
