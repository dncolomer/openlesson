import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import {
  complimentaryLinkPublicUrl,
  parseComplimentaryLinkCreateBody,
} from "@/lib/aycl-complimentary";
import { createPrivateToken, hashPrivateToken } from "@/lib/private-token";
import { createAdminClient } from "@/lib/supabase/admin";
import { canUserManageWorkspace } from "@/lib/workspace-archive";

export const runtime = "nodejs";

const LINK_SELECT =
  "id, workspace_id, access_tier, public_token, max_uses, use_count, expires_at, status, created_at, revoked_at";

function originFromRequest(req: NextRequest): string {
  return process.env.NEXT_PUBLIC_APP_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
}

async function requireWorkspaceOwner(workspaceId: string) {
  const auth = await requireAuthenticatedUser();
  if (!auth.ok) return auth;

  const admin = createAdminClient();
  const { data: workspace, error } = await admin
    .from("workspaces")
    .select("id, user_id")
    .eq("id", workspaceId)
    .single();

  if (error || !workspace) {
    return { ok: false as const, response: jsonError(404, "Workspace not found") };
  }
  if (!canUserManageWorkspace(workspace, auth.user.id)) {
    return {
      ok: false as const,
      response: jsonError(403, "Only the workspace owner can manage complimentary AYCL URLs"),
    };
  }
  return { ok: true as const, user: auth.user, admin, workspace };
}

function serializeLink(
  row: {
    id: string;
    workspace_id: string;
    access_tier: string;
    public_token: string;
    max_uses: number | null;
    use_count: number;
    expires_at: string | null;
    status: string;
    created_at: string;
    revoked_at: string | null;
  },
  origin: string,
) {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    access_tier: row.access_tier,
    max_uses: row.max_uses,
    use_count: row.use_count,
    expires_at: row.expires_at,
    status: row.status,
    created_at: row.created_at,
    revoked_at: row.revoked_at,
    url: complimentaryLinkPublicUrl(origin, row.public_token),
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: workspaceId } = await params;
    const access = await requireWorkspaceOwner(workspaceId);
    if (!access.ok) return access.response;

    const { data, error } = await access.admin
      .from("aycl_complimentary_links")
      .select(LINK_SELECT)
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });

    if (error) {
      return jsonError(500, error.message);
    }

    const origin = originFromRequest(req);
    return NextResponse.json({
      links: (data || []).map((row) => serializeLink(row, origin)),
    });
  } catch (error) {
    console.error("[workspaces/aycl/complimentary] GET", error);
    return jsonError(500, "Failed to list complimentary AYCL URLs");
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: workspaceId } = await params;
    const access = await requireWorkspaceOwner(workspaceId);
    if (!access.ok) return access.response;

    const body = (await req.json()) as Record<string, unknown>;
    const parsed = parseComplimentaryLinkCreateBody(body);
    if ("error" in parsed) {
      return jsonError(400, parsed.error);
    }

    const publicToken = createPrivateToken();
    const { data, error } = await access.admin
      .from("aycl_complimentary_links")
      .insert({
        workspace_id: workspaceId,
        created_by: access.user.id,
        access_tier: parsed.fields.access_tier,
        access_token_hash: hashPrivateToken(publicToken),
        public_token: publicToken,
        max_uses: parsed.fields.max_uses,
        use_count: 0,
        expires_at: parsed.fields.expires_at,
        status: "active",
      })
      .select(LINK_SELECT)
      .single();

    if (error || !data) {
      return jsonError(500, error?.message || "Failed to create complimentary URL");
    }

    return NextResponse.json({
      success: true,
      link: serializeLink(data, originFromRequest(req)),
    });
  } catch (error) {
    console.error("[workspaces/aycl/complimentary] POST", error);
    return jsonError(500, "Failed to create complimentary AYCL URL");
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: workspaceId } = await params;
    const access = await requireWorkspaceOwner(workspaceId);
    if (!access.ok) return access.response;

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const linkId =
      typeof body.id === "string"
        ? body.id.trim()
        : typeof body.linkId === "string"
          ? body.linkId.trim()
          : "";
    if (!linkId) {
      return jsonError(400, "id is required");
    }

    const { data, error } = await access.admin
      .from("aycl_complimentary_links")
      .update({
        status: "revoked",
        revoked_at: new Date().toISOString(),
      })
      .eq("id", linkId)
      .eq("workspace_id", workspaceId)
      .eq("status", "active")
      .select(LINK_SELECT)
      .maybeSingle();

    if (error) {
      return jsonError(500, error.message);
    }
    if (!data) {
      return jsonError(404, "Complimentary URL not found");
    }

    return NextResponse.json({
      success: true,
      link: serializeLink(data, originFromRequest(req)),
    });
  } catch (error) {
    console.error("[workspaces/aycl/complimentary] DELETE", error);
    return jsonError(500, "Failed to revoke complimentary AYCL URL");
  }
}
