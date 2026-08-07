/**
 * Agent PoW API — block-scoped TAPBench link mint.
 * Mirrors POST .../blocks/{blockId}/tap-links.
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, errorResponse } from "@/lib/pow-api/auth";
import {
  CreateTapbenchLinkError,
  createWorkspaceTapbenchLink,
} from "@/lib/pow-api/create-tapbench-link";
import { withProofOfWorkApiResponse } from "@/lib/pow-api/predictive-interruption";

export const runtime = "nodejs";

interface RouteProps {
  params: Promise<{ id: string; blockId: string }>;
}

function baseUrl(req: NextRequest) {
  return process.env.NEXT_PUBLIC_APP_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
}

export async function POST(req: NextRequest, { params }: RouteProps) {
  const result = await authenticateRequest(req, "tap:write");
  if (result instanceof NextResponse) return result;
  const { auth, supabase } = result;
  const { id: workspaceId, blockId } = await params;

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  try {
    const tapbenchLink = await createWorkspaceTapbenchLink({
      supabase,
      auth,
      workspaceId,
      blockId,
      body,
      baseUrl: baseUrl(req),
    });

    return NextResponse.json(
      await withProofOfWorkApiResponse(
        {
          workspace_id: workspaceId,
          tapbench_link: tapbenchLink,
          exercise_source: tapbenchLink.exercise_source,
        },
        {
          endpoint: "create_tapbench_link",
          workspace_id: workspaceId,
          block_id: blockId,
        },
      ),
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof CreateTapbenchLinkError) {
      return errorResponse(error.status, error.code, error.message);
    }
    console.error("[agent/tapbench-links] Create error:", error);
    return errorResponse(500, "internal_error", "Failed to create TAPBench link");
  }
}
