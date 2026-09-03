/**
 * Workspace map types: GET list + PUT persist.
 * Read: workspace owner / AYCL authoring access.
 * Write: same, requireAyclAuthoring so practice-only AYCL cannot edit.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { ayclTokenFromBody, guardWorkspaceRoute } from "@/lib/api/require-auth";
import {
  mapTypePickerCatalog,
  normalizeWorkspaceMapTypes,
  serializeWorkspaceMapTypes,
} from "@/lib/workspace-map-types";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const workspaceId = req.nextUrl.searchParams.get("workspaceId") || "";
    const ayclToken = req.nextUrl.searchParams.get("ayclToken");
    if (!workspaceId) {
      return jsonError(400, "workspaceId is required");
    }
    const auth = await guardWorkspaceRoute(workspaceId, {
      ayclToken,
      requireAyclAuthoring: false,
    });
    if (!auth.ok) return auth.response;

    const { data, error } = await auth.supabase
      .from("workspaces")
      .select("workspace_map_types")
      .eq("id", workspaceId)
      .single();
    if (error) {
      return jsonError(500, error.message);
    }
    const state = normalizeWorkspaceMapTypes(
      (data as { workspace_map_types?: unknown } | null)?.workspace_map_types,
    );
    return NextResponse.json({
      state,
      catalog: mapTypePickerCatalog(state),
    });
  } catch (error) {
    console.error("[workspace/map-types GET]", error);
    return jsonError(
      500,
      error instanceof Error ? error.message : "Failed to load map types",
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const workspaceId =
      typeof body.workspaceId === "string" ? body.workspaceId.trim() : "";
    if (!workspaceId) {
      return jsonError(400, "workspaceId is required");
    }
    const auth = await guardWorkspaceRoute(workspaceId, {
      ayclToken: ayclTokenFromBody(body),
      requireAyclAuthoring: true,
    });
    if (!auth.ok) return auth.response;

    const state = serializeWorkspaceMapTypes(body.state);
    const { error } = await auth.supabase
      .from("workspaces")
      .update({ workspace_map_types: state })
      .eq("id", workspaceId);
    if (error) {
      console.error("[workspace/map-types PUT]", error);
      return jsonError(500, "Failed to save map types");
    }
    return NextResponse.json({
      state,
      catalog: mapTypePickerCatalog(state),
    });
  } catch (error) {
    console.error("[workspace/map-types PUT]", error);
    return jsonError(
      500,
      error instanceof Error ? error.message : "Failed to save map types",
    );
  }
}
