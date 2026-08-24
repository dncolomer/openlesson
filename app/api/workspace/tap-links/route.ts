import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { ayclTokenFromBody, guardWorkspaceRoute } from "@/lib/api/require-auth";
import { requireProductWorkspaceLinkAuth } from "@/lib/product-workspace-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  CreateTapLinkError,
  createWorkspaceTapLink,
  reissueWorkspaceTapLink,
} from "@/lib/pow-api/create-tap-link";
import {
  InvalidateGuestLinkError,
  invalidateTapLinkOne,
  invalidateTapLinksAll,
} from "@/lib/pow-api/invalidate-guest-links";
import type { AuthContext } from "@/lib/pow-api/types";
import { guestLinkUrlFromPublicToken } from "@/lib/guest-link-access";
import { assertWorkspaceAllowsKnowledgeLinkMint } from "@/lib/workspace-kind";

export const runtime = "nodejs";

function baseUrl(req: NextRequest) {
  return process.env.NEXT_PUBLIC_APP_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
}

export async function GET(req: NextRequest) {
  const workspaceId = req.nextUrl.searchParams.get("workspaceId")?.trim() || "";
  if (!workspaceId) {
    return jsonError(400, "workspaceId is required");
  }

  const access = await requireProductWorkspaceLinkAuth(workspaceId, [
    "tap:read",
    "tap:write",
  ]);
  if (!access.ok) return access.response;

  const { data: links, error } = await access.supabase
    .from("workspace_tap_sessions")
    .select(
      "id, workspace_id, block_id, status, requested_duration_seconds, duration_seconds, participant_type, post_session, redirect_url, guest_user_id, assigned_user_id, created_at, started_at, completed_at, access_mode, public_token, entry_query_params, show_end_session, interaction_kind"
    )
    .eq("workspace_id", workspaceId)
    .not("private_token_hash", "is", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[workspace/tap-links] List error:", error);
    return jsonError(500, "Failed to list TAP links");
  }

  const origin = baseUrl(req);
  // Always attach listable share URLs from durable public_token (not one-shot client memory).
  const tap_links = (links || []).map((link) => {
    const url = guestLinkUrlFromPublicToken(origin, "tap", link.public_token);
    return {
      ...link,
      url: url ?? null,
      private_url: url ?? null,
    };
  });

  return NextResponse.json({ tap_links });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId.trim() : "";
    const blockId = typeof body.blockId === "string" ? body.blockId.trim() : "";
    const reissueLinkId =
      typeof body.reissue_link_id === "string"
        ? body.reissue_link_id.trim()
        : typeof body.reissueLinkId === "string"
          ? body.reissueLinkId.trim()
          : "";
    const invalidateLinkId =
      typeof body.invalidate_link_id === "string"
        ? body.invalidate_link_id.trim()
        : typeof body.invalidateLinkId === "string"
          ? body.invalidateLinkId.trim()
          : "";
    const invalidateAll =
      body.invalidate_all === true ||
      body.invalidateAll === true ||
      body.invalidate_all === "true" ||
      body.invalidateAll === "true";

    if (!workspaceId) {
      return jsonError(400, "workspaceId is required");
    }

    const access = await requireProductWorkspaceLinkAuth(workspaceId, [
      "tap:read",
      "tap:write",
    ]);
    if (!access.ok) return access.response;

    if (invalidateAll) {
      const result = await invalidateTapLinksAll({
        supabase: access.supabase,
        auth: access.auth,
        workspaceId,
      });
      return NextResponse.json({ invalidated: result }, { status: 200 });
    }

    if (invalidateLinkId) {
      const tapLink = await invalidateTapLinkOne({
        supabase: access.supabase,
        auth: access.auth,
        workspaceId,
        linkId: invalidateLinkId,
      });
      return NextResponse.json({ tap_link: tapLink }, { status: 200 });
    }

    const { data: kindRow } = await access.supabase
      .from("workspaces")
      .select("workspace_kind")
      .eq("id", workspaceId)
      .maybeSingle();
    const mintGate = assertWorkspaceAllowsKnowledgeLinkMint(kindRow?.workspace_kind);
    if (!mintGate.ok) {
      return jsonError(403, mintGate.error, mintGate.code);
    }

    if (reissueLinkId) {
      const tapLink = await reissueWorkspaceTapLink({
        supabase: access.supabase,
        auth: access.auth,
        workspaceId,
        linkId: reissueLinkId,
        baseUrl: baseUrl(req),
      });
      return NextResponse.json({ tap_link: tapLink }, { status: 200 });
    }

    const tapLink = await createWorkspaceTapLink({
      supabase: access.supabase,
      auth: access.auth,
      workspaceId,
      blockId: blockId || null,
      body,
      baseUrl: baseUrl(req),
      allowAnonymousForNonAdmin: access.isOwner,
    });

    return NextResponse.json({ tap_link: tapLink }, { status: 201 });
  } catch (error) {
    if (error instanceof CreateTapLinkError || error instanceof InvalidateGuestLinkError) {
      return jsonError(error.status, error.message, error.code);
    }
    console.error("[workspace/tap-links] Create error:", error);
    return jsonError(500, "Failed to create TAP link");
  }
}