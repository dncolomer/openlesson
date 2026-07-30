import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashPrivateToken } from "@/lib/private-token";
import {
  buildPracticePortalLandingView,
  normalizePracticePortalConfig,
} from "@/lib/practice-portal";

export const runtime = "nodejs";

/**
 * GET /api/practice-portal/[token]
 * Public resolve of a Practice Portal landing payload (no auth).
 * Workspace need not be public — the portal token is the access grant.
 */
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  try {
    const { token: rawToken } = await context.params;
    const token = typeof rawToken === "string" ? rawToken.trim() : "";
    if (!token) {
      return NextResponse.json({ error: "Token required", code: "validation_error" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const tokenHash = hashPrivateToken(token);

    const { data: portal, error } = await supabase
      .from("workspace_practice_portals")
      .select("id, workspace_id, status, config, label")
      .eq("private_token_hash", tokenHash)
      .maybeSingle();

    if (error) {
      console.error("[practice-portal] Resolve error:", error);
      return NextResponse.json({ error: "Failed to resolve portal", code: "internal_error" }, { status: 500 });
    }
    if (!portal) {
      return NextResponse.json({ error: "Portal not found", code: "not_found" }, { status: 404 });
    }
    if (portal.status !== "active") {
      return NextResponse.json({ error: "Portal is no longer active", code: "revoked" }, { status: 410 });
    }

    const { data: workspace } = await supabase
      .from("workspaces")
      .select("id, title, root_topic, status, archived_at")
      .eq("id", portal.workspace_id)
      .maybeSingle();

    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found", code: "not_found" }, { status: 404 });
    }
    if (workspace.archived_at != null) {
      return NextResponse.json({ error: "Workspace is archived", code: "archived" }, { status: 410 });
    }

    const { data: blocks } = await supabase
      .from("blocks")
      .select("id, title, is_start")
      .eq("workspace_id", portal.workspace_id)
      .order("created_at", { ascending: true });

    const config = normalizePracticePortalConfig(portal.config);
    const landing = buildPracticePortalLandingView({
      config,
      workspace: {
        id: workspace.id,
        title: workspace.title,
        root_topic: workspace.root_topic,
      },
      blocks: blocks || [],
      portal_id: portal.id,
    });

    return NextResponse.json({
      ok: true,
      label: portal.label ?? null,
      ...landing,
    });
  } catch (error) {
    console.error("[practice-portal] GET error:", error);
    return NextResponse.json({ error: "Internal server error", code: "internal_error" }, { status: 500 });
  }
}
