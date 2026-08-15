import { NextRequest, NextResponse } from "next/server";
import { ayclTokenFromBody, guardWorkspaceRoute } from "@/lib/api/require-auth";
import { buildSuggestFromSimulation } from "@/lib/suggest-from-simulation";
import { normalizeSimulationCollection } from "@/lib/workspace-simulation-collection";

/**
 * POST — suggest generative guidance from the curated simulation collection.
 */
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

    const { data: workspace } = await supabase
      .from("workspaces")
      .select("id, title, root_topic, workspace_goal, description, simulation_collection")
      .eq("id", workspaceId)
      .maybeSingle();

    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    const collection = normalizeSimulationCollection(
      (workspace as { simulation_collection?: unknown }).simulation_collection,
    );

    // Allow client to pass a provisional collection (e.g. just-generated, not yet saved)
    if (body.collection) {
      const merged = normalizeSimulationCollection(body.collection);
      if (merged.items.length) {
        // Prefer durable collection; if empty fall through already handled
      }
    }

    const suggestions = buildSuggestFromSimulation(
      body.collection
        ? normalizeSimulationCollection(body.collection)
        : collection,
      {
        surface: body.surface,
        draftPrompt: body.draftPrompt ?? body.topic ?? body.prompt,
        workspaceTitle:
          workspace.title || workspace.root_topic || body.workspaceTitle,
        workspaceGoal:
          (workspace as { workspace_goal?: string | null }).workspace_goal ||
          workspace.description ||
          body.workspaceGoal,
        limit: typeof body.limit === "number" ? body.limit : 5,
      },
    );

    return NextResponse.json({
      ok: true,
      suggestions,
      itemCount: collection.items.filter((i) => !i.removed).length,
    });
  } catch (err) {
    console.error("suggest-from-simulation", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}
