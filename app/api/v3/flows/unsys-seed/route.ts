import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, errorResponse } from "@/lib/pow-api/auth";
import { generateAgentFlowUnsysSeed } from "@/lib/pow-api/agent-flow-management";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const result = await authenticateRequest(req, "workspaces:write");
  if (result instanceof NextResponse) return result;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return errorResponse(400, "validation_error", "Invalid JSON body");
  }
  try {
    const generated = await generateAgentFlowUnsysSeed(body);
    return NextResponse.json(generated);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "The unsys field could not be generated.";
    const status = message === "A problem is required." ? 400 : 502;
    return errorResponse(
      status,
      status === 400 ? "validation_error" : "internal_error",
      message,
    );
  }
}
