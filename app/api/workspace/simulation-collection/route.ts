import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { ayclTokenFromBody, guardWorkspaceRoute } from "@/lib/api/require-auth";
import {
  depositSimulationGeneration,
  hardDeleteSimulationCollectionItem,
  keepSimulatedInsights,
  listSimulationCollectionItems,
  normalizeSimulationCollection,
  normalizeSimulationCollectionOrigin,
  removeSimulationCollectionItem,
  simulationCollectionHasLegacyRows,
  serializeSimulationCollection,
  updateSimulationCollectionItem,
  type SimulationCollectionOrigin,
} from "@/lib/workspace-simulation-collection";

/**
 * GET — list curated simulation collection for a workspace.
 * Query: workspaceId, includeRemoved?=0|1, kind?=question|exercise
 *
 * POST — mutate collection:
 *  action: list | deposit | create | update | delete | hard_delete
 */
export async function GET(req: NextRequest) {
  try {
    const workspaceId = req.nextUrl.searchParams.get("workspaceId");
    if (!workspaceId) {
      return jsonError(400, "workspaceId is required");
    }
    const auth = await guardWorkspaceRoute(workspaceId, {
      ayclToken: req.nextUrl.searchParams.get("ayclToken"),
    });
    if (!auth.ok) return auth.response;
    const { supabase } = auth;

    const { data: workspace, error } = await supabase
      .from("workspaces")
      .select("id, simulation_collection")
      .eq("id", workspaceId)
      .maybeSingle();
    if (error || !workspace) {
      return jsonError(error ? 500 : 404, error?.message || "Workspace not found");
    }

    const rawCollection = (workspace as { simulation_collection?: unknown })
      .simulation_collection;
    const collection = normalizeSimulationCollection(rawCollection);
    if (simulationCollectionHasLegacyRows(rawCollection)) {
      await supabase
        .from("workspaces")
        .update({ simulation_collection: serializeSimulationCollection(collection) })
        .eq("id", workspaceId);
    }
    const includeRemoved =
      req.nextUrl.searchParams.get("includeRemoved") === "1" ||
      req.nextUrl.searchParams.get("includeRemoved") === "true";
    const items = listSimulationCollectionItems(collection, {
      includeRemoved,
    });
    return NextResponse.json({
      ok: true,
      collection: serializeSimulationCollection(collection),
      items,
    });
  } catch (err) {
    console.error("simulation-collection GET", err);
    return jsonError(500, err instanceof Error ? err.message : "Internal error");
  }
}

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

    const { data: workspace, error } = await supabase
      .from("workspaces")
      .select("id, simulation_collection")
      .eq("id", workspaceId)
      .maybeSingle();
    if (error || !workspace) {
      return jsonError(error ? 500 : 404, error?.message || "Workspace not found");
    }

    let collection = normalizeSimulationCollection(
      (workspace as { simulation_collection?: unknown }).simulation_collection,
    );
    const action = String(body.action || "list").toLowerCase();

    if (action === "list") {
      return NextResponse.json({
        ok: true,
        items: listSimulationCollectionItems(collection),
        collection: serializeSimulationCollection(collection),
      });
    }

    if (action === "deposit" || action === "keep") {
      const origin: SimulationCollectionOrigin = normalizeSimulationCollectionOrigin(
        body.origin ||
          (body.blockIds
            ? {
                kind: "multi_block",
                blockIds: body.blockIds,
                blockTitles: body.blockTitles,
              }
            : body.blockId
              ? { kind: "block", blockId: body.blockId, blockTitle: body.blockTitle }
              : { kind: "workspace" }),
      );
      const insights = Array.isArray(body.insights)
        ? body.insights
        : body.title || body.body
          ? [{ title: body.title, body: body.body }]
          : [];
      collection = depositSimulationGeneration(collection, {
        insights,
        origin,
      });
    } else if (action === "create") {
      const title = String(body.title || "").trim();
      const insightBody = String(body.body || body.text || "").trim();
      if (title.length < 2 || insightBody.length < 8) {
        return jsonError(400, "title and body are required");
      }
      collection = keepSimulatedInsights(collection, {
        insights: [{ title, body: insightBody }],
        origin: normalizeSimulationCollectionOrigin(body.origin),
      });
    } else if (action === "update") {
      const itemId = String(body.itemId || body.id || "").trim();
      if (!itemId) {
        return jsonError(400, "itemId is required");
      }
      const next = updateSimulationCollectionItem(collection, itemId, {
        title: body.title,
        body: body.body,
        text: body.text,
      });
      if (!next) {
        return jsonError(404, "Item not found or invalid text");
      }
      collection = next;
    } else if (action === "delete" || action === "remove") {
      const itemId = String(body.itemId || body.id || "").trim();
      if (!itemId) {
        return jsonError(400, "itemId is required");
      }
      const next = removeSimulationCollectionItem(collection, itemId);
      if (!next) {
        return jsonError(404, "Item not found");
      }
      collection = next;
    } else if (action === "hard_delete") {
      const itemId = String(body.itemId || body.id || "").trim();
      if (!itemId) {
        return jsonError(400, "itemId is required");
      }
      const next = hardDeleteSimulationCollectionItem(collection, itemId);
      if (!next) {
        return jsonError(404, "Item not found");
      }
      collection = next;
    } else {
      return jsonError(400, `Unknown action: ${action}`);
    }

    const wire = serializeSimulationCollection(collection);
    const { error: upErr } = await supabase
      .from("workspaces")
      .update({ simulation_collection: wire })
      .eq("id", workspaceId);
    if (upErr) {
      // Column may not exist yet pre-migration — surface clearly.
      return jsonError(500, upErr.message || "Failed to persist simulation collection");
    }

    return NextResponse.json({
      ok: true,
      collection: wire,
      items: listSimulationCollectionItems(collection),
    });
  } catch (err) {
    console.error("simulation-collection POST", err);
    return jsonError(500, err instanceof Error ? err.message : "Internal error");
  }
}
