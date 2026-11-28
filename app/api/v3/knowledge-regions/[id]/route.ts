import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, errorResponse } from "@/lib/pow-api/auth";
import {
  deleteAgentKnowledgeRegion,
  getAgentKnowledgeRegion,
  updateAgentKnowledgeRegion,
} from "@/lib/pow-api/agent-knowledge-region-management";
import { requireAgentRequestOrganization } from "@/lib/organization/request-organization";

export const runtime = "nodejs";

interface RouteProps {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteProps) {
  const result = await authenticateRequest(req, "knowledge-regions:read");
  if (result instanceof NextResponse) return result;
  const ownerUserId = String(result.auth.user_id || "").trim();
  if (!ownerUserId) return errorResponse(401, "auth_required", "Not authenticated");
  const org = await requireAgentRequestOrganization(req, result.auth);
  if (!org.ok) return org.response;
  const { id } = await params;
  const loaded = await getAgentKnowledgeRegion(ownerUserId, id, org.organizationId);
  if (!loaded) return errorResponse(404, "not_found", "Knowledge region not found");
  return NextResponse.json(loaded);
}

export async function PATCH(req: NextRequest, { params }: RouteProps) {
  const result = await authenticateRequest(req, "knowledge-regions:write");
  if (result instanceof NextResponse) return result;
  const ownerUserId = String(result.auth.user_id || "").trim();
  if (!ownerUserId) return errorResponse(401, "auth_required", "Not authenticated");
  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return errorResponse(400, "validation_error", "Invalid JSON body");
  }
  const org = await requireAgentRequestOrganization(req, result.auth, body);
  if (!org.ok) return org.response;
  try {
    const knowledge_region = await updateAgentKnowledgeRegion(
      ownerUserId,
      id,
      body,
      org.organizationId,
    );
    return NextResponse.json({ knowledge_region });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update knowledge region";
    const status = /not found/i.test(message) ? 404 : 400;
    return errorResponse(
      status,
      status === 404 ? "not_found" : "validation_error",
      message,
    );
  }
}

export async function DELETE(req: NextRequest, { params }: RouteProps) {
  const result = await authenticateRequest(req, "knowledge-regions:write");
  if (result instanceof NextResponse) return result;
  const ownerUserId = String(result.auth.user_id || "").trim();
  if (!ownerUserId) return errorResponse(401, "auth_required", "Not authenticated");
  const org = await requireAgentRequestOrganization(req, result.auth);
  if (!org.ok) return org.response;
  const { id } = await params;
  try {
    const deleted = await deleteAgentKnowledgeRegion(ownerUserId, id, org.organizationId);
    return NextResponse.json(deleted);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete knowledge region";
    const status = /not found/i.test(message) ? 404 : 400;
    return errorResponse(
      status,
      status === 404 ? "not_found" : "validation_error",
      message,
    );
  }
}
