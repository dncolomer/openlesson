/**
 * Agent PoW API — TAPBench link mint + list (Bearer API key).
 * Mirrors tap-links: POST creates (optional body block_id), GET lists.
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, errorResponse } from "@/lib/pow-api/auth";
import {
  CreateTapbenchLinkError,
  createWorkspaceTapbenchLink,
  listWorkspaceTapbenchLinks,
} from "@/lib/pow-api/create-tapbench-link";
import { withProofOfWorkApiResponse } from "@/lib/pow-api/predictive-interruption";

export const runtime = "nodejs";

interface RouteProps {
  params: Promise<{ id: string }>;
}

function baseUrl(req: NextRequest) {
  return process.env.NEXT_PUBLIC_APP_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
}

export async function GET(req: NextRequest, { params }: RouteProps) {
  const result = await authenticateRequest(req, "tap:read");
  if (result instanceof NextResponse) return result;
  const { auth, supabase } = result;
  const { id: workspaceId } = await params;

  try {
    const listed = await listWorkspaceTapbenchLinks({
      supabase,
      auth,
      workspaceId,
      baseUrl: baseUrl(req),
    });

    return NextResponse.json(
      await withProofOfWorkApiResponse(listed, {
        endpoint: "list_tapbench_links",
        workspace_id: workspaceId,
      }),
    );
  } catch (error) {
    if (error instanceof CreateTapbenchLinkError) {
      return errorResponse(error.status, error.code, error.message);
    }
    console.error("[agent/tapbench-links:list] error:", error);
    return errorResponse(500, "internal_error", "Failed to list TAPBench links");
  }
}

/** Create a TAPBench link (optional body `block_id`). Block path: POST .../blocks/{block_id}/tapbench-links. */
export async function POST(req: NextRequest, { params }: RouteProps) {
  const result = await authenticateRequest(req, "tap:write");
  if (result instanceof NextResponse) return result;
  const { auth, supabase } = result;
  const { id: workspaceId } = await params;

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
          block_id: tapbenchLink.block_id,
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
