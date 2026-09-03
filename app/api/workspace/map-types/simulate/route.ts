/**
 * Test-generate a chapter map for a map type without starting a session.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { ayclTokenFromBody, guardWorkspaceRoute } from "@/lib/api/require-auth";
import { createSessionPlanLLM } from "@/lib/xai";
import {
  mapTypeRecordFromBuiltin,
  mapTypeTopologyResemblance,
  normalizeCustomMapTypeRecord,
  normalizeWorkspaceMapTypes,
  resolveMapTypeRecord,
} from "@/lib/workspace-map-types";
import { isInitialChaptersLevel } from "@/lib/initial-chapters";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
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

    const { data: workspace, error } = await auth.supabase
      .from("workspaces")
      .select("title, root_topic, description, workspace_map_types")
      .eq("id", workspaceId)
      .single();
    if (error || !workspace) {
      return jsonError(404, "Workspace not found");
    }

    const state = normalizeWorkspaceMapTypes(
      (workspace as { workspace_map_types?: unknown }).workspace_map_types,
    );
    const rawRecord = body.mapType;
    const mapTypeId =
      typeof body.mapTypeId === "string" ? body.mapTypeId.trim() : "";
    const mapType =
      normalizeCustomMapTypeRecord(rawRecord) ||
      (isInitialChaptersLevel(mapTypeId)
        ? mapTypeRecordFromBuiltin(mapTypeId)
        : resolveMapTypeRecord(mapTypeId || rawRecord, state));

    const topic =
      (typeof body.topic === "string" && body.topic.trim()) ||
      String(
        (workspace as { root_topic?: string }).root_topic ||
          (workspace as { title?: string }).title ||
          "this workspace",
      ).trim() ||
      "this workspace";

    const result = await createSessionPlanLLM({
      problem: topic,
      objectives: [`Preview a ${mapType.label} chapter map for ${topic}`],
      initialChapters: mapType.id,
      mapType,
      mapTypesState: state,
    });
    if (!result.success || !result.plan) {
      return jsonError(500, result.error || "Failed to generate map type preview");
    }

    const generated = (result.plan.steps || [])
      .filter(
        (s) =>
          typeof s.position_x === "number" && typeof s.position_y === "number",
      )
      .map((s) => ({
        row: s.position_y as number,
        col: s.position_x as number,
        keyword: s.map_keyword || s.description,
      }));
    const resemblance = mapTypeTopologyResemblance(generated, mapType);

    return NextResponse.json({
      mapTypeId: mapType.id,
      steps: result.plan.steps,
      unusable_cells: result.plan.unusable_cells ?? [],
      generated,
      resemblance,
    });
  } catch (error) {
    console.error("[workspace/map-types/simulate]", error);
    return jsonError(
      500,
      error instanceof Error ? error.message : "Failed to simulate map type",
    );
  }
}
