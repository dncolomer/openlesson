import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { ayclTokenFromBody, guardWorkspaceRoute } from "@/lib/api/require-auth";
import {
  assembleSuggestFromSimulationXaiMessages,
  normalizeSuggestFromSimulationResponse,
  simulationCollectionToSuggestSnapshots,
} from "@/lib/suggest-from-simulation";
import { runSuggestFromKnowledgeModel } from "@/lib/run-suggest-from-knowledge-model";
import { normalizeSimulationCollection } from "@/lib/workspace-simulation-collection";

/**
 * POST — suggest author prompts from the curated simulation collection
 * through the same xAI assembler as Suggest from Knowledge.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const workspaceId = body.workspaceId as string | undefined;
    if (!workspaceId) {
      return jsonError(400, "workspaceId is required");
    }
    const auth = await guardWorkspaceRoute(workspaceId, {
      ayclToken: ayclTokenFromBody(body),
    });
    if (!auth.ok) return auth.response;
    const { supabase } = auth;

    const { data: workspace } = await supabase
      .from("workspaces")
      .select("id, title, root_topic, workspace_goal, description, notes, simulation_collection")
      .eq("id", workspaceId)
      .maybeSingle();

    if (!workspace) {
      return jsonError(404, "Workspace not found");
    }

    const collection = normalizeSimulationCollection(
      (workspace as { simulation_collection?: unknown }).simulation_collection,
    );
    const snapshots = simulationCollectionToSuggestSnapshots(collection);
    if (snapshots.length === 0) {
      return NextResponse.json({
        ok: true,
        suggestions: [],
        itemCount: 0,
      });
    }

    const limit =
      typeof body.limit === "number" && Number.isFinite(body.limit)
        ? Math.max(1, Math.min(Math.trunc(body.limit), 8))
        : 4;

    const assembled = assembleSuggestFromSimulationXaiMessages(collection, {
      surface: body.surface,
      draftPrompt: body.draftPrompt ?? body.topic ?? body.prompt,
      workspaceTitle: workspace.title || workspace.root_topic,
      workspaceGoal:
        (workspace as { workspace_goal?: string | null }).workspace_goal ||
        workspace.description,
      workspaceNotes: (workspace as { notes?: string | null }).notes,
      limit,
    });

    const modelResult = await runSuggestFromKnowledgeModel(assembled, {
      model: typeof body.model === "string" ? body.model : undefined,
    });
    if (!modelResult.ok) {
      return jsonError(
        502,
        modelResult.error ||
          "Failed to generate simulation suggestions (xAI unavailable or empty response)",
      );
    }

    const suggestions = normalizeSuggestFromSimulationResponse(modelResult.data, {
      sourceSnapshotIds: assembled.sourceSnapshotIds,
      limit,
    });

    return NextResponse.json({
      ok: true,
      suggestions,
      itemCount: snapshots.length,
    });
  } catch (err) {
    console.error("suggest-from-simulation", err);
    return jsonError(500, err instanceof Error ? err.message : "Internal error");
  }
}
