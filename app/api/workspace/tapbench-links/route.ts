/**
 * Workspace TAPBench links — mint + list (always-visible share URLs).
 * Used by Knowledge Regions tab. Shares createWorkspaceTapbenchLink with agent PoW API.
 */

import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { ayclTokenFromBody, guardWorkspaceRoute } from "@/lib/api/require-auth";
import {
  CreateTapbenchLinkError,
  createWorkspaceTapbenchLink,
} from "@/lib/pow-api/create-tapbench-link";
import { listTapbenchLinksPersisted } from "@/lib/pow-api/tapbench-store";
import type { AuthContext } from "@/lib/pow-api/types";

export const runtime = "nodejs";

function baseUrl(req: NextRequest) {
  return process.env.NEXT_PUBLIC_APP_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
}

/**
 * Session/browser mint must NOT set auth_method=api_key with a fake key_id.
 * createdByApiKeyId only returns key_id for real Bearer API keys; a non-UUID
 * like "session" would break organization_guest_users.created_by_api_key_id (FK).
 */
export function sessionAuthContext(userId: string): AuthContext {
  return {
    user_id: userId,
    guest_user_id: null,
    organization_id: null,
    is_org_admin: false,
    key_id: "",
    scopes: ["*"],
    // Omit auth_method so createdByApiKeyId(auth) is null (same as pre-agent UI mint).
  };
}

export async function GET(req: NextRequest) {
  try {
    const workspaceId = req.nextUrl.searchParams.get("workspaceId")?.trim() || "";
    if (!workspaceId) {
      return jsonError(400, "workspaceId is required");
    }
    const auth = await guardWorkspaceRoute(workspaceId);
    if (!auth.ok) return auth.response;

    const links = await listTapbenchLinksPersisted(
      auth.supabase,
      workspaceId,
      baseUrl(req),
    );

    return NextResponse.json({
      workspace_id: workspaceId,
      tapbench_links: links,
    });
  } catch (error) {
    console.error("[workspace/tapbench-links] GET failed:", error);
    return jsonError(500, "Failed to list TAPBench links");
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId.trim() : "";
    if (!workspaceId) {
      return jsonError(400, "workspaceId is required");
    }

    const auth = await guardWorkspaceRoute(workspaceId, {
      ayclToken: ayclTokenFromBody(body),
    });
    if (!auth.ok) return auth.response;

    const blockId =
      typeof body.blockId === "string"
        ? body.blockId.trim()
        : typeof body.block_id === "string"
          ? body.block_id.trim()
          : "";

    const tapbenchLink = await createWorkspaceTapbenchLink({
      supabase: auth.supabase,
      auth: sessionAuthContext(auth.user.id),
      workspaceId,
      blockId: blockId || null,
      body,
      baseUrl: baseUrl(req),
      // guardWorkspaceRoute already authorized this session for the workspace.
      skipAccessCheck: true,
    });

    return NextResponse.json(
      {
        workspace_id: workspaceId,
        tapbench_link: {
          id: tapbenchLink.id,
          workspace_id: tapbenchLink.workspace_id,
          block_id: tapbenchLink.block_id,
          status: tapbenchLink.status,
          exercise: tapbenchLink.exercise,
          duration_seconds: tapbenchLink.duration_seconds,
          expires_at: tapbenchLink.expires_at,
          remaining_ms: tapbenchLink.remaining_ms,
          created_at: tapbenchLink.created_at,
          public_token: tapbenchLink.session_token,
          url: tapbenchLink.url,
          session_token: tapbenchLink.session_token,
          guest_user_id: tapbenchLink.guest_user_id,
        },
        exercise_source: tapbenchLink.exercise_source,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof CreateTapbenchLinkError) {
      return jsonError(error.status, error.message, error.code);
    }
    console.error("[workspace/tapbench-links] POST failed:", error);
    return jsonError(500, "Failed to create TAPBench link");
  }
}
