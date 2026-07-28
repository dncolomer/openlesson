import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  CreateIleLinkError,
  createWorkspaceIleLink,
  reissueWorkspaceIleLink,
} from "@/lib/pow-api/create-ile-link";
import {
  InvalidateGuestLinkError,
  invalidateIleLinkOne,
  invalidateIleLinksAll,
} from "@/lib/pow-api/invalidate-guest-links";
import type { AuthContext } from "@/lib/pow-api/types";

export const runtime = "nodejs";

function baseUrl(req: NextRequest) {
  return process.env.NEXT_PUBLIC_APP_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
}

async function resolveWebAuth(workspaceId: string): Promise<
  | { error: string; status: number }
  | { auth: AuthContext; supabase: ReturnType<typeof createAdminClient>; isOwner: boolean }
> {
  const auth = await requireAuthenticatedUser();
  if (!auth.ok) {
    return { error: "Not authenticated", status: 401 };
  }
  const { user, supabase } = auth;

  const admin = createAdminClient();
  const { data: workspace } = await admin
    .from("workspaces")
    .select("id, user_id, organization_id")
    .eq("id", workspaceId)
    .single();

  if (!workspace) {
    return { error: "Workspace not found", status: 404 };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, is_org_admin")
    .eq("id", user.id)
    .maybeSingle();

  const isOwner = workspace.user_id === user.id;
  const isOrgAdmin =
    !!profile?.is_org_admin &&
    !!profile.organization_id &&
    profile.organization_id === workspace.organization_id;

  if (!isOwner && !isOrgAdmin) {
    return { error: "Not authorized", status: 403 };
  }

  return {
    auth: {
      user_id: user.id,
      guest_user_id: null,
      organization_id: profile?.organization_id || workspace.organization_id,
      is_org_admin: isOrgAdmin,
      key_id: "web",
      scopes: ["workspaces:read", "workspaces:write"],
    },
    supabase: admin,
    isOwner,
  };
}

export async function GET(req: NextRequest) {
  const workspaceId = req.nextUrl.searchParams.get("workspaceId")?.trim() || "";
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
  }

  const access = await resolveWebAuth(workspaceId);
  if ("error" in access) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const ILE_LIST_SELECT_WITH_MODE =
    "id, workspace_id, block_id, status, participant_type, guest_user_id, assigned_user_id, session_id, created_at, started_at, completed_at, access_mode, public_token, entry_query_params, show_end_session, session_mode";
  /** Fallback when session_mode migration not yet applied on the target DB. */
  const ILE_LIST_SELECT_LEGACY =
    "id, workspace_id, block_id, status, participant_type, guest_user_id, assigned_user_id, session_id, created_at, started_at, completed_at, access_mode, public_token, entry_query_params, show_end_session";

  let { data: links, error } = await access.supabase
    .from("workspace_ile_links")
    .select(ILE_LIST_SELECT_WITH_MODE)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  // Missing column (migration not applied) → list without session_mode, default learning.
  if (error) {
    const msg = `${error.message || ""} ${error.details || ""} ${error.hint || ""}`.toLowerCase();
    const missingSessionMode =
      msg.includes("session_mode") ||
      (msg.includes("column") && msg.includes("does not exist")) ||
      error.code === "42703";
    if (missingSessionMode) {
      console.warn(
        "[workspace/ile-links] session_mode missing — falling back to legacy select. Apply migration 20260728120000_ile_session_mode.",
      );
      const legacy = await access.supabase
        .from("workspace_ile_links")
        .select(ILE_LIST_SELECT_LEGACY)
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false });
      if (legacy.error) {
        console.error("[workspace/ile-links] List error:", legacy.error);
        return NextResponse.json({ error: "Failed to list ILE links" }, { status: 500 });
      }
      links = (legacy.data || []).map((row) => ({
        ...row,
        session_mode: "learning",
      }));
      error = null;
    }
  }

  if (error) {
    console.error("[workspace/ile-links] List error:", error);
    return NextResponse.json({ error: "Failed to list ILE links" }, { status: 500 });
  }

  return NextResponse.json({ ile_links: links || [] });
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
      return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
    }

    const access = await resolveWebAuth(workspaceId);
    if ("error" in access) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

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
      return NextResponse.json({ error: "blockId is required for ILE links" }, { status: 400 });
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
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error("[workspace/ile-links] Create error:", error);
    return NextResponse.json({ error: "Failed to create ILE link" }, { status: 500 });
  }
}
