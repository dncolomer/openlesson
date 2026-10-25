/**
 * Context Dantes / add-link resources were removed from the product model.
 * Routes stay so old clients get an empty list or 410.
 */

import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import {
  ayclTokenFromBody,
  guardWorkspaceRoute,
  requireAuthenticatedUser,
} from "@/lib/api/require-auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const workspaceId = req.nextUrl.searchParams.get("workspaceId")?.trim() || "";
    if (!workspaceId) {
      return jsonError(400, "workspaceId is required");
    }

    const ayclToken = req.nextUrl.searchParams.get("ayclToken");
    if (ayclToken) {
      const auth = await guardWorkspaceRoute(workspaceId, { ayclToken });
      if (!auth.ok) return auth.response;
      return NextResponse.json({ resources: [] });
    }

    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const { user, supabase } = auth;

    const { data: plan } = await supabase
      .from("workspaces")
      .select("user_id, is_public")
      .eq("id", workspaceId)
      .single();

    if (!plan) {
      return jsonError(404, "Workspace not found");
    }
    if (plan.user_id !== user.id && !plan.is_public) {
      return jsonError(403, "Forbidden");
    }

    return NextResponse.json({ resources: [] });
  } catch (err) {
    console.error("[external-resources] GET", err);
    return jsonError(500, "Internal error");
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const workspaceId =
      typeof body.workspaceId === "string"
        ? body.workspaceId.trim()
        : typeof body.workspace_id === "string"
          ? body.workspace_id.trim()
          : "";
    if (!workspaceId) {
      return jsonError(400, "workspaceId is required");
    }
    const auth = await guardWorkspaceRoute(workspaceId, {
      ayclToken: ayclTokenFromBody(body),
    });
    if (!auth.ok) return auth.response;
    return jsonError(410, "External resources were removed");
  } catch (err) {
    console.error("[external-resources] POST", err);
    return jsonError(500, "Internal error");
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const workspaceId =
      typeof body.workspaceId === "string"
        ? body.workspaceId.trim()
        : typeof body.workspace_id === "string"
          ? body.workspace_id.trim()
          : "";
    if (!workspaceId) {
      return jsonError(400, "workspaceId is required");
    }
    const auth = await guardWorkspaceRoute(workspaceId, {
      ayclToken: ayclTokenFromBody(body),
    });
    if (!auth.ok) return auth.response;
    return jsonError(410, "External resources were removed");
  } catch (err) {
    console.error("[external-resources] PATCH", err);
    return jsonError(500, "Internal error");
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const workspaceId = req.nextUrl.searchParams.get("workspaceId")?.trim() || "";
    if (!workspaceId) {
      return jsonError(400, "workspaceId is required");
    }
    const auth = await guardWorkspaceRoute(workspaceId, {
      ayclToken: req.nextUrl.searchParams.get("ayclToken"),
    });
    if (!auth.ok) return auth.response;
    return jsonError(410, "External resources were removed");
  } catch (err) {
    console.error("[external-resources] DELETE", err);
    return jsonError(500, "Internal error");
  }
}
