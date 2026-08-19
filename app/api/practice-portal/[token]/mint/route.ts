import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashPrivateToken } from "@/lib/private-token";
import {
  normalizePracticePortalConfig,
  practicePortalMintToCreateFields,
  validatePracticePortalMintRequest,
} from "@/lib/practice-portal";
import {
  CreateTapLinkError,
  createWorkspaceTapLink,
} from "@/lib/pow-api/create-tap-link";
import {
  CreateIleLinkError,
  createWorkspaceIleLink,
} from "@/lib/pow-api/create-ile-link";
import type { AuthContext } from "@/lib/pow-api/types";

export const runtime = "nodejs";

function baseUrl(req: NextRequest) {
  return process.env.NEXT_PUBLIC_APP_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
}

/**
 * POST /api/practice-portal/[token]/mint
 * Public mint of a TAP/ILE guest session from a Practice Portal.
 * Enforces allowed products/timings; creates anonymous guest links via existing helpers.
 *
 * Body: { product_id, minutes?, block_id? }
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  try {
    const { token: rawToken } = await context.params;
    const token = typeof rawToken === "string" ? rawToken.trim() : "";
    if (!token) {
      return jsonError(400, "Token required", "validation_error");
    }

    const body = await req.json().catch(() => ({}));
    const supabase = createAdminClient();
    const tokenHash = hashPrivateToken(token);

    const { data: portal, error } = await supabase
      .from("workspace_practice_portals")
      .select("id, workspace_id, status, config")
      .eq("private_token_hash", tokenHash)
      .maybeSingle();

    if (error) {
      console.error("[practice-portal/mint] Resolve error:", error);
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
      .select("id, user_id, organization_id, status, archived_at")
      .eq("id", portal.workspace_id)
      .maybeSingle();

    if (!workspace) {
      return jsonError(404, "Workspace not found", "not_found");
    }
    if (workspace.archived_at != null) {
      return jsonError(410, "Workspace is archived", "archived");
    }
    if (!workspace.user_id) {
      return jsonError(500, "Workspace owner is missing", "internal_error");
    }

    const config = normalizePracticePortalConfig(portal.config);
    const validated = validatePracticePortalMintRequest(config, {
      product_id: body?.product_id,
      minutes: body?.minutes,
      block_id: body?.block_id,
    });

    if (!validated.ok) {
      const status =
        validated.code === "product_not_allowed" || validated.code === "timing_not_allowed"
          ? 403
          : 400;
      return jsonError(status, validated.error, "validation_error");
    }

    // Ensure block belongs to this workspace when provided / required
    if (validated.block_id) {
      const { data: block } = await supabase
        .from("blocks")
        .select("id")
        .eq("id", validated.block_id)
        .eq("workspace_id", portal.workspace_id)
        .maybeSingle();
      if (!block) {
        return jsonError(404, "Block not found in this workspace", "block_not_found");
      }
    }

    const createFields = practicePortalMintToCreateFields(validated);
    const origin = baseUrl(req);

    const auth: AuthContext = {
      user_id: workspace.user_id,
      guest_user_id: null,
      organization_id: workspace.organization_id,
      is_org_admin: false,
      key_id: "practice-portal",
      scopes: ["tap:write", "workspaces:write"],
    };

    if (createFields.linkKind === "tap") {
      const link = await createWorkspaceTapLink({
        supabase,
        auth,
        workspaceId: portal.workspace_id,
        blockId: createFields.blockId,
        body: createFields.body,
        baseUrl: origin,
        allowAnonymousForNonAdmin: true,
      });
      return NextResponse.json({
        ok: true,
        product_id: validated.product_id,
        link_kind: "tap",
        minutes: validated.minutes,
        interaction_kind: link.interaction_kind,
        url: link.url,
        private_url: link.private_url,
        workspace_id: portal.workspace_id,
        block_id: link.block_id,
        portal_id: portal.id,
      });
    }

    if (!createFields.blockId) {
      return jsonError(400, "block_id is required for open-ended products", "block_required");
    }

    const link = await createWorkspaceIleLink({
      supabase,
      auth,
      workspaceId: portal.workspace_id,
      blockId: createFields.blockId,
      body: createFields.body,
      baseUrl: origin,
      allowAnonymousForNonAdmin: true,
    });

    return NextResponse.json({
      ok: true,
      product_id: validated.product_id,
      link_kind: "ile",
      minutes: null,
      session_mode: link.session_mode,
      url: link.url,
      private_url: link.private_url,
      workspace_id: portal.workspace_id,
      block_id: link.block_id,
      portal_id: portal.id,
    });
  } catch (error) {
    if (error instanceof CreateTapLinkError || error instanceof CreateIleLinkError) {
      return jsonError(error.status, error.message, error.code);
    }
    console.error("[practice-portal/mint] POST error:", error);
    return jsonError(500, "Internal server error", "internal_error");
  }
}
