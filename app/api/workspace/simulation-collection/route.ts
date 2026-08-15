import { NextRequest, NextResponse } from "next/server";
import { ayclTokenFromBody, guardWorkspaceRoute } from "@/lib/api/require-auth";
import {
  appendSimulationCollectionItems,
  depositSimulationGeneration,
  hardDeleteSimulationCollectionItem,
  listSimulationCollectionItems,
  normalizeSimulationCollection,
  normalizeSimulationCollectionOrigin,
  removeSimulationCollectionItem,
  serializeSimulationCollection,
  updateSimulationCollectionItem,
  type SimulationCollectionItemKind,
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
      return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
    }
    const auth = await guardWorkspaceRoute(workspaceId, {});
    if (!auth.ok) return auth.response;
    const { supabase } = auth;

    const { data: workspace, error } = await supabase
      .from("workspaces")
      .select("id, simulation_collection")
      .eq("id", workspaceId)
      .maybeSingle();
    if (error || !workspace) {
      return NextResponse.json(
        { error: error?.message || "Workspace not found" },
        { status: error ? 500 : 404 },
      );
    }

    const collection = normalizeSimulationCollection(
      (workspace as { simulation_collection?: unknown }).simulation_collection,
    );
    const includeRemoved =
      req.nextUrl.searchParams.get("includeRemoved") === "1" ||
      req.nextUrl.searchParams.get("includeRemoved") === "true";
    const kindRaw = req.nextUrl.searchParams.get("kind");
    const kind =
      kindRaw === "question" || kindRaw === "exercise"
        ? (kindRaw as SimulationCollectionItemKind)
        : null;
    const items = listSimulationCollectionItems(collection, {
      includeRemoved,
      kind,
    });
    return NextResponse.json({
      ok: true,
      collection: serializeSimulationCollection(collection),
      items,
    });
  } catch (err) {
    console.error("simulation-collection GET", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const workspaceId = body.workspaceId as string | undefined;
    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
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
      return NextResponse.json(
        { error: error?.message || "Workspace not found" },
        { status: error ? 500 : 404 },
      );
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

    if (action === "deposit") {
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
      collection = depositSimulationGeneration(collection, {
        questions: body.questions,
        exercises: body.exercises,
        probes: body.probes,
        origin,
        modifierPrompt: body.modifierPrompt ?? body.userGuidance ?? null,
      });
    } else if (action === "create") {
      const kind: SimulationCollectionItemKind =
        body.kind === "exercise" ? "exercise" : "question";
      const text = String(body.text || body.question || "").trim();
      if (text.length < 4) {
        return NextResponse.json({ error: "text is required" }, { status: 400 });
      }
      collection = appendSimulationCollectionItems(collection, [
        {
          kind,
          text,
          coachCue: body.coachCue ?? body.coach_cue ?? null,
          origin: normalizeSimulationCollectionOrigin(body.origin),
          modifierPrompt: body.modifierPrompt ?? null,
        },
      ]);
    } else if (action === "update") {
      const itemId = String(body.itemId || body.id || "").trim();
      if (!itemId) {
        return NextResponse.json({ error: "itemId is required" }, { status: 400 });
      }
      const next = updateSimulationCollectionItem(collection, itemId, {
        text: body.text,
        kind: body.kind === "exercise" || body.kind === "question" ? body.kind : undefined,
        coachCue: body.coachCue ?? body.coach_cue,
      });
      if (!next) {
        return NextResponse.json({ error: "Item not found or invalid text" }, { status: 404 });
      }
      collection = next;
    } else if (action === "delete" || action === "remove") {
      const itemId = String(body.itemId || body.id || "").trim();
      if (!itemId) {
        return NextResponse.json({ error: "itemId is required" }, { status: 400 });
      }
      const next = removeSimulationCollectionItem(collection, itemId);
      if (!next) {
        return NextResponse.json({ error: "Item not found" }, { status: 404 });
      }
      collection = next;
    } else if (action === "hard_delete") {
      const itemId = String(body.itemId || body.id || "").trim();
      if (!itemId) {
        return NextResponse.json({ error: "itemId is required" }, { status: 400 });
      }
      const next = hardDeleteSimulationCollectionItem(collection, itemId);
      if (!next) {
        return NextResponse.json({ error: "Item not found" }, { status: 404 });
      }
      collection = next;
    } else {
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    const wire = serializeSimulationCollection(collection);
    const { error: upErr } = await supabase
      .from("workspaces")
      .update({ simulation_collection: wire })
      .eq("id", workspaceId);
    if (upErr) {
      // Column may not exist yet pre-migration — surface clearly.
      return NextResponse.json(
        { error: upErr.message || "Failed to persist simulation collection" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      collection: wire,
      items: listSimulationCollectionItems(collection),
    });
  } catch (err) {
    console.error("simulation-collection POST", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}
