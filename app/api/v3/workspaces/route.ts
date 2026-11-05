import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, errorResponse } from "@/lib/pow-api/auth";
import {
  createManagedWorkspace,
  listManagedWorkspaces,
} from "@/lib/pow-api/workspace-management";

export const runtime = "nodejs";
export const maxDuration = 180;

/** GET /api/v3/workspaces — list Learning Maps. */
export async function GET(req: NextRequest) {
  const result = await authenticateRequest(req, "workspaces:read");
  if (result instanceof NextResponse) return result;
  const { auth, supabase } = result;
  const url = new URL(req.url);
  try {
    const payload = await listManagedWorkspaces(supabase, auth, {
      status: url.searchParams.get("status"),
      limit: url.searchParams.get("limit"),
      offset: url.searchParams.get("offset"),
    });
    return NextResponse.json(payload);
  } catch (error) {
    return errorResponse(
      500,
      "internal_error",
      error instanceof Error ? error.message : "Failed to list workspaces",
    );
  }
}

/** POST /api/v3/workspaces — create a Learning workspace. */
export async function POST(req: NextRequest) {
  const result = await authenticateRequest(req, "workspaces:write");
  if (result instanceof NextResponse) return result;
  const { auth, supabase } = result;
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }
  try {
    const payload = await createManagedWorkspace(supabase, auth, body);
    return NextResponse.json(payload, { status: 201 });
  } catch (error) {
    return errorResponse(
      400,
      "validation_error",
      error instanceof Error ? error.message : "Failed to create workspace",
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
