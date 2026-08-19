import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
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
      return jsonError(400, "Token required", "validation_error");
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
      return jsonError(500, "Failed to resolve portal", "internal_error");
    }
    if (!portal) {
      return jsonError(404, "Portal not found", "not_found");
    }
    if (portal.status !== "active") {
      return jsonError(410, "Portal is no longer active", "revoked");
    }

    const { data: workspace } = await supabase
      .from("workspaces")
      .select("id, title, root_topic, status, archived_at")
      .eq("id", portal.workspace_id)
      .maybeSingle();

    if (!workspace) {
      return jsonError(404, "Workspace not found", "not_found");
    }
    if (workspace.archived_at != null) {
      return jsonError(410, "Workspace is archived", "archived");
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
    return jsonError(500, "Internal server error", "internal_error");
  }
}
