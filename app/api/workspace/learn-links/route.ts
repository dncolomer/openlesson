import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  CreateIleLinkError,
  createWorkspaceIleLink,
  reissueWorkspaceIleLink,
} from "@/lib/pow-api/create-learn-link";
import {
  InvalidateGuestLinkError,
  invalidateIleLinkOne,
  invalidateIleLinksAll,
} from "@/lib/pow-api/invalidate-guest-links";
import type { AuthContext } from "@/lib/pow-api/types";
import { guestLinkUrlFromPublicToken } from "@/lib/guest-link-access";
import { requireProductWorkspaceLinkAuth } from "@/lib/product-workspace-auth";
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
    "workspaces:read",
    "workspaces:write",
  ]);
  if (!access.ok) return access.response;

  const ILE_LIST_SELECT_WITH_MODE =
    "id, workspace_id, block_id, status, guest_user_id, assigned_user_id, created_at, access_mode, public_token, guest_link, kind";

  let { data: links, error } = await access.supabase
    .from("sessions")
    .select(ILE_LIST_SELECT_WITH_MODE)
    .eq("workspace_id", workspaceId)
    .eq("kind", "learn")
    .order("created_at", { ascending: false });

  // Missing column (migration not applied) → list without session_mode, default learning.
  if (error) {
    console.error("[workspace/ile-links] List error:", error);
    return jsonError(500, "Failed to list Learn links");
  }

  const origin = baseUrl(req);
  // Always attach listable share URLs from durable public_token (not one-shot client memory).
  const ile_links = (links || []).map((link) => {
    const row = (link && typeof link === "object" ? link : {}) as Record<string, unknown>;
    const guestLink =
      row.guest_link && typeof row.guest_link === "object" && !Array.isArray(row.guest_link)
        ? (row.guest_link as Record<string, unknown>)
        : {};
    const publicToken =
      typeof row.public_token === "string"
        ? row.public_token
        : typeof guestLink.public_token === "string"
          ? guestLink.public_token
          : null;
    const url = guestLinkUrlFromPublicToken(origin, "ile", publicToken);
    return {
      ...guestLink,
      ...row,
      show_end_session: guestLink.show_end_session !== false && row.show_end_session !== false,
      url: url ?? null,
      private_url: url ?? null,
    };
  });

  return NextResponse.json({ ile_links });
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
      "workspaces:read",
      "workspaces:write",
    ]);
    if (!access.ok) return access.response;

    if (invalidateAll) {
      const result = await invalidateIleLinksAll({
        supabase: access.supabase,
        auth: access.auth,
        workspaceId,
      });
      return NextResponse.json({ invalidated: result }, { status: 200 });
    }

    if (invalidateLinkId) {
      const ileLink = await invalidateIleLinkOne({
        supabase: access.supabase,
        auth: access.auth,
        workspaceId,
        linkId: invalidateLinkId,
      });
      return NextResponse.json({ ile_link: ileLink }, { status: 200 });
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
      const ileLink = await reissueWorkspaceIleLink({
        supabase: access.supabase,
        auth: access.auth,
        workspaceId,
        linkId: reissueLinkId,
        baseUrl: baseUrl(req),
      });
      return NextResponse.json({ ile_link: ileLink }, { status: 200 });
    }

    if (!blockId) {
      return jsonError(400, "blockId is required for Learn links");
    }

    const ileLink = await createWorkspaceIleLink({
      supabase: access.supabase,
      auth: access.auth,
      workspaceId,
      blockId,
      body,
      baseUrl: baseUrl(req),
      allowAnonymousForNonAdmin: access.isOwner,
    });

    return NextResponse.json({ ile_link: ileLink }, { status: 201 });
  } catch (error) {
    if (error instanceof CreateIleLinkError || error instanceof InvalidateGuestLinkError) {
      return jsonError(error.status, error.message, error.code);
    }
    console.error("[workspace/ile-links] Create error:", error);
    return jsonError(500, "Failed to create Learn link");
  }
}
