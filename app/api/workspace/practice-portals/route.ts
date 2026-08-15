import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPrivateToken, hashPrivateToken } from "@/lib/private-token";
import {
  buildPracticePortalUrl,
  normalizePracticePortalConfig,
} from "@/lib/practice-portal";
import { requireProductWorkspaceLinkAuth } from "@/lib/product-workspace-auth";

export const runtime = "nodejs";

function baseUrl(req: NextRequest) {
  return process.env.NEXT_PUBLIC_APP_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
}

/**
 * GET /api/workspace/practice-portals?workspaceId=
 * List Practice Portals for a workspace (owner/org-admin).
 */
export async function GET(req: NextRequest) {
  const workspaceId = req.nextUrl.searchParams.get("workspaceId")?.trim() || "";
  if (!workspaceId) {
    return jsonError(400, "workspaceId is required");
  }

  const access = await requireProductWorkspaceLinkAuth(workspaceId, [
    "tap:read",
    "tap:write",
    "workspaces:write",
  ]);
  if (!access.ok) return access.response;

  const { data: portals, error } = await access.supabase
    .from("workspace_practice_portals")
    .select(
      "id, workspace_id, status, config, label, created_at, revoked_at, public_token",
    )
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[workspace/practice-portals] List error:", error);
    return jsonError(500, "Failed to list Practice Portals");
  }

  const origin = baseUrl(req);
  const rows = (portals || []).map((row) => {
    const config = normalizePracticePortalConfig(row.config);
    const token =
      typeof row.public_token === "string" && row.public_token.trim()
        ? row.public_token.trim()
        : null;
    const url =
      row.status === "active" && token
        ? buildPracticePortalUrl(origin, token)
        : null;
    return {
      ...row,
      config,
      public_token: token,
      url,
    };
  });

  return NextResponse.json({ practice_portals: rows });
}

/**
 * POST /api/workspace/practice-portals
 * Create or invalidate a Practice Portal.
 *
 * Create body: { workspaceId, config?, label? }
 * Invalidate: { workspaceId, invalidate_portal_id }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId.trim() : "";
    if (!workspaceId) {
      return jsonError(400, "workspaceId is required");
    }

    const access = await requireProductWorkspaceLinkAuth(workspaceId, [
      "tap:read",
      "tap:write",
      "workspaces:write",
    ]);
    if (!access.ok) return access.response;

    const invalidatePortalId =
      typeof body.invalidate_portal_id === "string"
        ? body.invalidate_portal_id.trim()
        : typeof body.invalidatePortalId === "string"
          ? body.invalidatePortalId.trim()
          : "";

    if (invalidatePortalId) {
      const { data: updated, error } = await access.supabase
        .from("workspace_practice_portals")
        .update({ status: "revoked", revoked_at: new Date().toISOString() })
        .eq("id", invalidatePortalId)
        .eq("workspace_id", workspaceId)
        .eq("status", "active")
        .select("id, status, revoked_at")
        .maybeSingle();

      if (error) {
        console.error("[workspace/practice-portals] Invalidate error:", error);
        return jsonError(500, "Failed to invalidate portal");
      }
      if (!updated) {
        return jsonError(404, "Portal not found or already revoked");
      }
      return NextResponse.json({ practice_portal: updated, invalidated: true });
    }

    const config = normalizePracticePortalConfig(body.config ?? body);
    const label =
      typeof body.label === "string" && body.label.trim()
        ? body.label.trim().slice(0, 120)
        : null;

    const token = createPrivateToken();
    const tokenHash = hashPrivateToken(token);
    const ownerUserId = access.auth.user_id;
    if (!ownerUserId) {
      return jsonError(401, "Not authenticated");
    }

    // If a fixed block is set, ensure it belongs to this workspace
    if (config.block_id) {
      const { data: block } = await access.supabase
        .from("blocks")
        .select("id")
        .eq("id", config.block_id)
        .eq("workspace_id", workspaceId)
        .maybeSingle();
      if (!block) {
        return jsonError(400, "Fixed block not found in this workspace", "block_not_found");
      }
    }

    const { data: portal, error } = await access.supabase
      .from("workspace_practice_portals")
      .insert({
        workspace_id: workspaceId,
        user_id: ownerUserId,
        organization_id: access.auth.organization_id,
        private_token_hash: tokenHash,
        public_token: token,
        config,
        label,
        status: "active",
      })
      .select("id, workspace_id, status, config, label, created_at, public_token")
      .single();

    if (error || !portal) {
      console.error("[workspace/practice-portals] Create error:", error);
      return jsonError(500, "Failed to create Practice Portal");
    }

    const origin = baseUrl(req);
    const url = buildPracticePortalUrl(origin, token);

    return NextResponse.json({
      practice_portal: {
        ...portal,
        config: normalizePracticePortalConfig(portal.config),
        public_token: token,
        url,
        token,
      },
    });
  } catch (error) {
    console.error("[workspace/practice-portals] POST error:", error);
    return jsonError(500, "Internal server error");
  }
}
