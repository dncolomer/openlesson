import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, errorResponse } from "@/lib/pow-api/auth";
import {
  createAgentProtocol,
  listAgentProtocols,
} from "@/lib/pow-api/agent-flow-management";
import { requireAgentRequestOrganization } from "@/lib/organization/request-organization";
import { rejectedProtocolKind } from "@/lib/product-flow";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const result = await authenticateRequest(req, "protocols:read");
  if (result instanceof NextResponse) return result;
  const { auth } = result;
  const ownerUserId = String(auth.user_id || "").trim();
  if (!ownerUserId) return errorResponse(401, "auth_required", "Not authenticated");
  const org = await requireAgentRequestOrganization(req, auth);
  if (!org.ok) return org.response;
  const url = new URL(req.url);
  if (rejectedProtocolKind(url.searchParams.get("kind"))) {
    return errorResponse(
      400,
      "validation_error",
      "Only knowledge verification protocols are supported",
    );
  }
  const workspaceId = url.searchParams.get("workspace_id") || undefined;
  const protocols = await listAgentProtocols({
    ownerUserId,
    workspaceId,
    organizationId: org.organizationId,
  });
  return NextResponse.json({ protocols });
}

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
    const protocol = await createAgentProtocol(auth, undefined, body, org.organizationId);
    return NextResponse.json({ protocol }, { status: 201 });
  } catch (error) {
    return errorResponse(
      400,
      "validation_error",
      error instanceof Error ? error.message : "Failed to create protocol",
    );
  }
}
