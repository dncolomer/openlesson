/**
 * GET/PUT workspace map right-pane Excalidraw scene.
 */

import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import {
  ayclTokenFromBody,
  guardWorkspaceRoute,
  requireAuthenticatedUser,
} from "@/lib/api/require-auth";
import {
  emptyWorkspaceMapCanvasScene,
  normalizeWorkspaceMapCanvasScene,
  prepareWorkspaceMapCanvasPersist,
} from "@/lib/workspace-map-canvas";

export const runtime = "nodejs";

async function loadScene(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  workspaceId: string,
) {
  const { data, error } = await supabase
    .from("workspaces")
    .select("map_canvas_scene")
    .eq("id", workspaceId)
    .single();

  if (error) {
    // Column missing until migration — return blank scene
    if (/schema cache|map_canvas_scene|does not exist/i.test(error.message || "")) {
      return { scene: emptyWorkspaceMapCanvasScene(), missingColumn: true };
    }
    throw error;
  }
  return {
    scene: normalizeWorkspaceMapCanvasScene(
      (data as { map_canvas_scene?: unknown } | null)?.map_canvas_scene,
    ),
    missingColumn: false,
  };
}

/** GET ?workspaceId= — load scene (owner / AYCL / public read like notes). */
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
      const { scene } = await loadScene(auth.supabase, workspaceId);
      return NextResponse.json({ scene });
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

    const { scene } = await loadScene(supabase, workspaceId);
    return NextResponse.json({ scene });
  } catch (err) {
    console.error("[map-canvas] GET", err);
    return jsonError(500, err instanceof Error ? err.message : "Failed to load canvas");
  }
}

/** PUT body: { workspaceId, scene, ayclToken? } — owner/AYCL only. */
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const workspaceId = String(body.workspaceId || "").trim();
    if (!workspaceId) {
      return jsonError(400, "workspaceId is required");
    }

    const auth = await guardWorkspaceRoute(workspaceId, {
      ayclToken: ayclTokenFromBody(body),
    });
    if (!auth.ok) return auth.response;

    const { scene, json } = prepareWorkspaceMapCanvasPersist(body.scene);
    const parsed = JSON.parse(json);

    const { error } = await auth.supabase
      .from("workspaces")
      .update({ map_canvas_scene: parsed })
      .eq("id", workspaceId);

    if (error) {
      console.error("[map-canvas] PUT", error);
      if (/schema cache|map_canvas_scene|does not exist/i.test(error.message || "")) {
        return jsonError(503, "map_canvas_scene column missing — run npm run db:migrate",
            scene,);
      }
      return jsonError(500, error.message);
    }

    return NextResponse.json({ ok: true, scene });
  } catch (err) {
    console.error("[map-canvas] PUT", err);
    return jsonError(500, err instanceof Error ? err.message : "Failed to save canvas");
  }
}
