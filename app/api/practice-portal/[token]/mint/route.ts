import { NextRequest, NextResponse } from "next/server";
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
      return NextResponse.json({ error: "Token required", code: "validation_error" }, { status: 400 });
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
      .select("id, user_id, organization_id, status, archived_at")
      .eq("id", portal.workspace_id)
      .maybeSingle();

    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found", code: "not_found" }, { status: 404 });
    }
    if (workspace.archived_at != null) {
      return NextResponse.json({ error: "Workspace is archived", code: "archived" }, { status: 410 });
    }
    if (!workspace.user_id) {
      return NextResponse.json(
        { error: "Workspace owner is missing", code: "internal_error" },
        { status: 500 },
      );
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
      return NextResponse.json(
        { error: validated.error, code: validated.code },
        { status },
      );
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
        return NextResponse.json(
          { error: "Block not found in this workspace", code: "block_not_found" },
          { status: 404 },
        );
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
      return NextResponse.json(
        { error: "block_id is required for open-ended products", code: "block_required" },
        { status: 400 },
      );
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
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    console.error("[practice-portal/mint] POST error:", error);
    return NextResponse.json({ error: "Internal server error", code: "internal_error" }, { status: 500 });
  }
}
