import { NextRequest, NextResponse } from "next/server";
import { ayclTokenFromBody, guardWorkspaceRoute, requireAuthenticatedUser } from "@/lib/api/require-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { CreateTapLinkError, createWorkspaceTapLink } from "@/lib/pow-api/create-tap-link";
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
      scopes: ["tap:read", "tap:write"],
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

  const { data: links, error } = await access.supabase
    .from("workspace_tap_sessions")
    .select(
      "id, workspace_id, block_id, status, requested_duration_seconds, duration_seconds, participant_type, post_session, redirect_url, guest_user_id, assigned_user_id, created_at, started_at, completed_at"
    )
    .eq("workspace_id", workspaceId)
    .not("private_token_hash", "is", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[workspace/tap-links] List error:", error);
    return NextResponse.json({ error: "Failed to list TAP links" }, { status: 500 });
  }

  return NextResponse.json({ tap_links: links || [] });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId.trim() : "";
    const blockId = typeof body.blockId === "string" ? body.blockId.trim() : "";

    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
    }

    const access = await resolveWebAuth(workspaceId);
    if ("error" in access) {
      return NextResponse.json({ error: access.error }, { status: access.status });
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
    if (error instanceof CreateTapLinkError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error("[workspace/tap-links] Create error:", error);
    return NextResponse.json({ error: "Failed to create TAP link" }, { status: 500 });
  }
}