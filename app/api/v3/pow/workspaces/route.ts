import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/agent-v2/auth";
import {
  WORKSPACE_CREATE_UI_ONLY_ERROR_CODE,
  WORKSPACE_CREATE_UI_ONLY_HTTP_STATUS,
  WORKSPACE_CREATE_UI_ONLY_MESSAGE,
} from "@/lib/agent-v2/workspace-create-ui-only";

export const runtime = "nodejs";

/**
 * POST /api/v3/pow/workspaces — programmatic workspace create is disabled.
 * Workspaces must be created manually via the product UI (/workspace/new).
 */
export async function POST(_req: NextRequest) {
  return errorResponse(
    WORKSPACE_CREATE_UI_ONLY_HTTP_STATUS,
    WORKSPACE_CREATE_UI_ONLY_ERROR_CODE,
    WORKSPACE_CREATE_UI_ONLY_MESSAGE
  );
}

// Keep Next.js from treating this as a missing method when clients probe.
export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
