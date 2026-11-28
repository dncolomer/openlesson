import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, errorResponse } from "@/lib/pow-api/auth";
import { presentPublicFlowArtifact } from "@/lib/flow-artifacts";
import { uploadAgentFlowFile } from "@/lib/pow-api/agent-flow-management";
import { requireAgentRequestOrganization } from "@/lib/organization/request-organization";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const result = await authenticateRequest(req, "protocols:write");
  if (result instanceof NextResponse) return result;
  const { auth } = result;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return errorResponse(400, "validation_error", "Invalid JSON body");
  }
  const org = await requireAgentRequestOrganization(req, auth, body);
  if (!org.ok) return org.response;
  try {
    const artifact = await uploadAgentFlowFile(auth, body);
    return NextResponse.json(
      {
        artifact: presentPublicFlowArtifact(artifact),
        file_id: artifact.xaiFileId,
        name: artifact.name,
        mime_type: artifact.mimeType ?? null,
      },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to upload file";
    const status =
      message === "fileName and data are required" ||
      message === "That file type is not supported." ||
      message === "File is too large (10 MB)."
        ? 400
        : 502;
    return errorResponse(
      status,
      status === 400 ? "validation_error" : "internal_error",
      message,
    );
  }
}
