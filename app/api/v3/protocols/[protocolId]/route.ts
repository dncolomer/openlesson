import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, errorResponse } from "@/lib/pow-api/auth";
import {
  deleteAgentProtocol,
  getAgentProtocol,
  updateAgentProtocol,
} from "@/lib/pow-api/agent-flow-management";
import { requireAgentRequestOrganization } from "@/lib/organization/request-organization";

export const runtime = "nodejs";

interface RouteProps {
  params: Promise<{ protocolId: string }>;
}

export async function GET(req: NextRequest, { params }: RouteProps) {
  const result = await authenticateRequest(req, "protocols:read");
  if (result instanceof NextResponse) return result;
  const { auth } = result;
  const org = await requireAgentRequestOrganization(req, auth);
  if (!org.ok) return org.response;
  const { protocolId } = await params;
  const protocol = await getAgentProtocol(
    undefined,
    protocolId,
    String(auth.user_id || ""),
    org.organizationId,
  );
  if (!protocol) return errorResponse(404, "not_found", "Protocol not found");
  return NextResponse.json({ protocol });
}

export async function PATCH(req: NextRequest, { params }: RouteProps) {
  const result = await authenticateRequest(req, "protocols:write");
  if (result instanceof NextResponse) return result;
  const { auth } = result;
  const { protocolId } = await params;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return errorResponse(400, "validation_error", "Invalid JSON body");
  }
  const org = await requireAgentRequestOrganization(req, auth, body);
  if (!org.ok) return org.response;
  try {
    const protocol = await updateAgentProtocol(
      auth,
      undefined,
      protocolId,
      body,
      org.organizationId,
    );
    return NextResponse.json({ protocol });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update protocol";
    const status = message === "Protocol not found." ? 404 : 400;
    return errorResponse(
      status,
      status === 404 ? "not_found" : "validation_error",
      message,
    );
  }
}

export async function DELETE(req: NextRequest, { params }: RouteProps) {
  const result = await authenticateRequest(req, "protocols:write");
  if (result instanceof NextResponse) return result;
  const { auth } = result;
  const org = await requireAgentRequestOrganization(req, auth);
  if (!org.ok) return org.response;
  const { protocolId } = await params;
  try {
    const deleted = await deleteAgentProtocol(auth, protocolId, org.organizationId);
    return NextResponse.json(deleted);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete protocol";
    const status = message === "Protocol not found." ? 404 : 400;
    return errorResponse(
      status,
      status === 404 ? "not_found" : "validation_error",
      message,
    );
  }
}
