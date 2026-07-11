import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, createdByApiKeyId, errorResponse } from "@/lib/agent-v2/auth";
import { canAccessAgentWorkspace } from "@/lib/agent-v2/workspace-access";
import {
  buildGhlScoreSessionUrl,
  createPrivateToken,
  getGhcScoreBriefForUser,
  hashPrivateToken,
} from "@/lib/ghc-score";
import { withProofOfWorkApiResponse } from "@/lib/agent-v2/predictive-interruption";

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

  const requestedMinutes = Number(body.minutes || 15);
  const minutes = requestedMinutes === 30 ? 30 : 15;
  const guestEmail = typeof body.guest_email === "string" ? body.guest_email.trim().toLowerCase() : "";
  const requestedGuestId = typeof body.guest_user_id === "string" ? body.guest_user_id : null;

  const { data: block, error: blockError } = await supabase
    .from("blocks")
    .select("id, workspace_id, workspaces!inner(id, user_id, organization_id, guest_user_id)")
    .eq("id", blockId)
    .eq("workspace_id", workspaceId)
    .single();

  if (blockError || !block) {
    return errorResponse(404, "block_not_found", "Block not found");
  }

  const workspace = (block as any).workspaces;
  if (!canAccessAgentWorkspace(auth, workspace)) {
    return errorResponse(404, "workspace_not_found", "Workspace not found");
  }

  let guestUserId = auth.guest_user_id;
  if (!guestUserId && (requestedGuestId || guestEmail)) {
    if (!auth.is_org_admin || !auth.organization_id) {
      return errorResponse(403, "forbidden", "Only organization admins can assign TAP links to guests");
    }
    let guestQuery = supabase
      .from("organization_guest_users")
      .select("id, status")
      .eq("organization_id", auth.organization_id)
      .eq("status", "active");
    guestQuery = requestedGuestId ? guestQuery.eq("id", requestedGuestId) : guestQuery.eq("email", guestEmail);
    const { data: guest } = await guestQuery.single();
    if (!guest) return errorResponse(404, "guest_not_found", "Guest user not found");
    guestUserId = guest.id;
  }

  const ownerUserId = auth.user_id || workspace.user_id;
  if (!ownerUserId) {
    return errorResponse(500, "internal_error", "Workspace owner is missing");
  }

  try {
    await getGhcScoreBriefForUser(workspaceId, ownerUserId, [blockId], true, null);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Not authorized";
    return errorResponse(message === "Workspace not found" ? 404 : 403, message === "Workspace not found" ? "workspace_not_found" : "forbidden", message);
  }

  const privateToken = createPrivateToken();
  const { data: link, error } = await supabase
    .from("workspace_tap_sessions")
    .insert({
      workspace_id: workspaceId,
      user_id: ownerUserId,
      guest_user_id: guestUserId,
      organization_id: auth.organization_id || workspace.organization_id,
      created_by_api_key_id: createdByApiKeyId(auth),
      private_token_hash: hashPrivateToken(privateToken),
      requested_duration_seconds: Math.round(minutes * 60),
      block_id: blockId,
      mode: "curious",
      focus_block_ids: [blockId],
      voice_id: "ara",
      status: "pending",
    })
    .select("id, workspace_id, block_id, status, requested_duration_seconds, focus_block_ids, created_at")
    .single();

  if (error || !link) {
    console.error("[agent/ghl-links] Create error:", error);
    return errorResponse(500, "internal_error", "Failed to create TAP link");
  }

  return NextResponse.json(
    withProofOfWorkApiResponse(
      {
        tap_link: {
          ...link,
          private_url: buildGhlScoreSessionUrl(baseUrl(req), privateToken),
        },
      },
      {
        endpoint: "create_tap_link",
        workspace_id: workspaceId,
        block_id: blockId,
        tap_minutes: minutes,
      }
    ),
    { status: 201 }
  );
}
