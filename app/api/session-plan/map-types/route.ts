/**
 * Session-start map-type catalog: enabled built-ins + custom types for the
 * session's workspace. Falls back to the default eight-id catalog.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import {
  ayclTokenFromBody,
  ileTokenFromBody,
  guardSessionRoute,
} from "@/lib/api/require-auth";
import {
  mapTypePickerCatalog,
  normalizeWorkspaceMapTypes,
} from "@/lib/workspace-map-types";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const sessionId =
      typeof body.sessionId === "string" ? body.sessionId.trim() : "";
    if (!sessionId) {
      return jsonError(400, "sessionId is required");
    }
    const auth = await guardSessionRoute(sessionId, {
      ayclToken: ayclTokenFromBody(body),
      ileToken: ileTokenFromBody(body),
    });
    if (!auth.ok) return auth.response;

    const { data: sessionData, error: sessionError } = await auth.supabase
      .from("sessions")
      .select("metadata")
      .eq("id", sessionId)
      .single();
    if (sessionError) {
      return jsonError(500, sessionError.message);
    }
    const metadata = (sessionData?.metadata ?? {}) as Record<string, unknown>;
    const workspaceId =
      typeof metadata.workspace_id === "string" ? metadata.workspace_id.trim() : "";
    if (!workspaceId) {
      return NextResponse.json({
        catalog: mapTypePickerCatalog(null),
        workspaceId: null,
      });
    }

    const { data: workspace } = await auth.supabase
      .from("workspaces")
      .select("workspace_map_types")
      .eq("id", workspaceId)
      .maybeSingle();
    const state = normalizeWorkspaceMapTypes(
      (workspace as { workspace_map_types?: unknown } | null)?.workspace_map_types,
    );
    return NextResponse.json({
      catalog: mapTypePickerCatalog(state),
      state,
      workspaceId,
    });
  } catch (error) {
    console.error("[session-plan/map-types]", error);
    return jsonError(
      500,
      error instanceof Error ? error.message : "Failed to load map types",
    );
  }
}
