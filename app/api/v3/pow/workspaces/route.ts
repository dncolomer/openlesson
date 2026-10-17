import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, errorResponse } from "@/lib/pow-api/auth";
import { listManagedWorkspaces } from "@/lib/pow-api/workspace-management";
import { withProofOfWorkApiResponse } from "@/lib/pow-api/predictive-interruption";

export const runtime = "nodejs";

/**
 * GET /api/v3/pow/workspaces — alias of workspace-management list.
 * Canonical collection is GET /api/v3/workspaces.
 */
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
    return NextResponse.json(
      await withProofOfWorkApiResponse(payload, { endpoint: "list_workspaces" }),
    );
  } catch (error) {
    return errorResponse(
      500,
      "internal_error",
      error instanceof Error ? error.message : "Failed to list workspaces",
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
