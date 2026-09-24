import type { SupabaseClient } from "@supabase/supabase-js";
import { after, NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { ayclTokenFromBody, guardWorkspaceRoute } from "@/lib/api/require-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createSimulateInsightsJob,
  readableSimulateInsights,
  runSimulateInsightsJob,
  type SimulateInsightsContext,
  type SimulateInsightsJob,
  type SimulateInsightsScope,
} from "@/lib/simulate-insights";
import { callSimulateInsightsModelStep } from "@/lib/simulate-insights-model";
import {
  commitSimulationJob,
  normalizeSimulationCollection,
  serializeSimulationCollection,
  type SimulationCollection,
} from "@/lib/workspace-simulation-collection";

/**
 * POST — start a Simulate Insights job. Returns id + running.
 * The insight list is not in this response. GET reads it after both steps finish.
 */

function scopeOf(raw: unknown): SimulateInsightsScope {
  const value = String(raw || "").toLowerCase();
  if (value === "block") return "block";
  if (value === "multi_block" || value === "multi-block") return "multi_block";
  return "workspace";
}

function asJob(raw: unknown): SimulateInsightsJob | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as SimulateInsightsJob;
  if (!rec.id || !rec.status) return null;
  return rec;
}

async function loadCollection(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<SimulationCollection | null> {
  const { data } = await supabase
    .from("workspaces")
    .select("id, simulation_collection")
    .eq("id", workspaceId)
    .maybeSingle();
  if (!data) return null;
  return normalizeSimulationCollection(
    (data as { simulation_collection?: unknown }).simulation_collection,
  );
}

async function saveCollectionIfVersion(
  supabase: SupabaseClient,
  workspaceId: string,
  collection: SimulationCollection,
  expectedVersion: string | null,
): Promise<boolean> {
  let query = supabase
    .from("workspaces")
    .update({ simulation_collection: serializeSimulationCollection(collection) })
    .eq("id", workspaceId);
  query = expectedVersion
    ? query.filter("simulation_collection->>updated_at", "eq", expectedVersion)
    : query.filter("simulation_collection->>updated_at", "is", null);
  const { data, error } = await query.select("id");
  if (error) throw new Error(error.message || "Failed to persist simulation job");
  return Array.isArray(data) && data.length > 0;
}

async function buildContext(
  supabase: ReturnType<typeof createAdminClient>,
  workspaceId: string,
  input: {
    scope: SimulateInsightsScope;
    blockId: string | null;
    blockIds: string[];
    modifier: string | null;
  },
): Promise<SimulateInsightsContext> {
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("title, root_topic, notes, workspace_goal, description")
    .eq("id", workspaceId)
    .maybeSingle();
  const goal =
    (workspace as { workspace_goal?: string | null } | null)?.workspace_goal ||
    workspace?.description ||
    null;
  const notes = (workspace as { notes?: string | null } | null)?.notes || null;
  const title = workspace?.title || workspace?.root_topic || null;

  if (input.scope === "block" && input.blockId) {
    const { data: block } = await supabase
      .from("blocks")
      .select("title, description, planning_prompt, local_context")
      .eq("id", input.blockId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    const local = block?.local_context as { notes?: string } | null;
    return {
      scope: "block",
      title: block?.title || title,
      description: [block?.description, block?.planning_prompt].filter(Boolean).join("\n"),
      notes: [notes, local?.notes].filter(Boolean).join("\n"),
      goal,
      modifier: input.modifier,
    };
  }

  if (input.scope === "multi_block" && input.blockIds.length) {
    const { data: blocks } = await supabase
      .from("blocks")
      .select("id, title, description")
      .eq("workspace_id", workspaceId)
      .in("id", input.blockIds);
    const rows = blocks || [];
    return {
      scope: "multi_block",
      title: title,
      description: rows
        .map((row) => `${row.title || "Untitled"}: ${row.description || ""}`.trim())
        .join("\n"),
      notes,
      goal,
      blockTitles: rows.map((row) => String(row.title || "")).filter(Boolean),
      modifier: input.modifier,
    };
  }

  const { data: blocks } = await supabase
    .from("blocks")
    .select("title")
    .eq("workspace_id", workspaceId)
    .limit(12);
  return {
    scope: "workspace",
    title,
    description: workspace?.description || null,
    notes,
    goal,
    blockTitles: (blocks || []).map((row) => String(row.title || "")).filter(Boolean),
    modifier: input.modifier,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const workspaceId = String(body.workspaceId || "").trim();
    if (!workspaceId) return jsonError(400, "workspaceId is required");
    const auth = await guardWorkspaceRoute(workspaceId, {
      ayclToken: ayclTokenFromBody(body),
    });
    if (!auth.ok) return auth.response;

    const scope = scopeOf(body.scope);
    const blockId = typeof body.blockId === "string" ? body.blockId.trim() : "";
    const blockIds = Array.isArray(body.blockIds)
      ? body.blockIds.map((id: unknown) => String(id || "").trim()).filter(Boolean)
      : [];
    if (scope === "workspace") {
      return jsonError(400, "Simulate Insights runs on a block");
    }
    if (scope === "block" && !blockId) return jsonError(400, "blockId is required");
    if (scope === "multi_block" && blockIds.length < 2) {
      return jsonError(400, "At least two blocks are required");
    }
    const modifier =
      typeof body.modifierPrompt === "string" ? body.modifierPrompt.trim() : "";
    const model = typeof body.model === "string" ? body.model : undefined;

    const job = createSimulateInsightsJob({ scope, blockId, blockIds });
    await commitSimulationJob({
      job,
      load: async () =>
        (await loadCollection(auth.supabase, workspaceId)) ||
        normalizeSimulationCollection(null),
      saveIfVersion: (collection, expectedVersion) =>
        saveCollectionIfVersion(auth.supabase, workspaceId, collection, expectedVersion),
    });

    after(async () => {
      const admin = createAdminClient();
      const context = await buildContext(admin, workspaceId, {
        scope,
        blockId: blockId || null,
        blockIds,
        modifier: modifier || null,
      });
      await runSimulateInsightsJob({
        job,
        context,
        callStep: (step) =>
          callSimulateInsightsModelStep({ ...step, model }),
        persist: (next) =>
          commitSimulationJob({
            job: next,
            load: async () =>
              (await loadCollection(admin, workspaceId)) ||
              normalizeSimulationCollection(null),
            saveIfVersion: (collection, expectedVersion) =>
              saveCollectionIfVersion(admin, workspaceId, collection, expectedVersion),
          }),
      });
    });

    return NextResponse.json({
      ok: true,
      jobId: job.id,
      status: "running",
      completedSteps: 0,
      insights: [],
    });
  } catch (err) {
    console.error("simulate-insights POST", err);
    return jsonError(500, err instanceof Error ? err.message : "Internal error");
  }
}

export async function GET(req: NextRequest) {
  try {
    const workspaceId = req.nextUrl.searchParams.get("workspaceId") || "";
    const jobId = req.nextUrl.searchParams.get("jobId") || "";
    if (!workspaceId) return jsonError(400, "workspaceId is required");
    if (!jobId) return jsonError(400, "jobId is required");
    const auth = await guardWorkspaceRoute(workspaceId, {
      ayclToken: req.nextUrl.searchParams.get("ayclToken"),
    });
    if (!auth.ok) return auth.response;
    const collection = await loadCollection(auth.supabase, workspaceId);
    const job = asJob(
      (collection?.jobs || []).find((row) => asJob(row)?.id === jobId),
    );
    if (!job) return jsonError(404, "Simulation job not found");
    return NextResponse.json({
      ok: true,
      jobId: job.id,
      status: job.status,
      completedSteps: job.completedSteps,
      error: job.error,
      insights: readableSimulateInsights(job),
    });
  } catch (err) {
    console.error("simulate-insights GET", err);
    return jsonError(500, err instanceof Error ? err.message : "Internal error");
  }
}
