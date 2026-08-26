import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/pow-api/auth";
import {
  authenticateTapbenchKey,
  memoryTapbenchKeyStore,
} from "@/lib/tapbench/keys";
import { memoryTapbenchRunStore, publicTapbenchRunView } from "@/lib/tapbench/runs";
import { bearerToken, tryCreateTapbenchAdminClient } from "@/lib/tapbench/http";
import { supabaseTapbenchKeyStore, supabaseTapbenchRunStore } from "@/lib/tapbench/store-supabase";
import { listTapbenchBenchmarkTasks } from "@/lib/tapbench/catalog";
import { listTapbenchPublicRegions } from "@/lib/tapbench/region";
import { supabaseTapbenchGuestStore } from "@/lib/tapbench/guests";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public TAPBench results explore.
 * Query: run_id, workspace_id, mine=1 (requires TAPBench key).
 */
export async function GET(req: NextRequest) {
  const supabase = tryCreateTapbenchAdminClient();
  const runStore = supabase ? supabaseTapbenchRunStore(supabase) : memoryTapbenchRunStore;
  const keyStore = supabase ? supabaseTapbenchKeyStore(supabase) : memoryTapbenchKeyStore;
  const { searchParams } = new URL(req.url);
  const runId = searchParams.get("run_id")?.trim() || "";
  const workspaceId = searchParams.get("workspace_id")?.trim() || "";
  const mine = searchParams.get("mine") === "1";

  const tasks = await listTapbenchBenchmarkTasks(supabase);
  const titleById = new Map(tasks.map((t) => [t.id, t.title]));

  if (runId) {
    const run = await runStore.getById(runId);
    if (!run) {
      return errorResponse(404, "not_found", "TAPBench run not found");
    }
    return NextResponse.json({
      run: {
        ...publicTapbenchRunView(run),
        task_title: titleById.get(run.workspace_id) || run.workspace_id,
      },
    });
  }

  if (mine) {
    const token = bearerToken(req);
    if (!token) {
      return errorResponse(401, "unauthorized", "TAPBench key required to list own runs");
    }
    const authed = await authenticateTapbenchKey(token, keyStore);
    if (!authed.ok) {
      return errorResponse(401, authed.code, authed.message);
    }
    const runs = await runStore.listByKey(authed.key.id);
    const guests = supabase
      ? await supabaseTapbenchGuestStore(supabase).listByKey(authed.key.id)
      : [];
    const guestSet = new Set(guests.map((g) => g.guest_user_id));
    const taskIds = workspaceId ? [workspaceId] : tasks.map((t) => t.id);
    const regions = (await listTapbenchPublicRegions(supabase, taskIds)).filter((region) =>
      region.guest_user_ids.some((id) => guestSet.has(id)),
    );
    return NextResponse.json({
      runs: runs.map((run) => ({
        ...publicTapbenchRunView(run),
        task_title: titleById.get(run.workspace_id) || run.workspace_id,
      })),
      regions: regions.map((region) => ({
        ...region,
        task_title: titleById.get(region.workspace_id) || region.workspace_id,
      })),
    });
  }

  const runs = workspaceId
    ? await runStore.listByWorkspace(workspaceId)
    : await runStore.listAll();
  const taskIds = workspaceId ? [workspaceId] : tasks.map((t) => t.id);
  const regions = await listTapbenchPublicRegions(supabase, taskIds);

  return NextResponse.json({
    owner_email: "tapbench@uncertain.systems",
    embedding_model_id: "knowledgecfg-v1-d64",
    dim: 64,
    runs: runs.map((run) => ({
      ...publicTapbenchRunView(run),
      task_title: titleById.get(run.workspace_id) || run.workspace_id,
    })),
    regions: regions.map((region) => ({
      ...region,
      task_title: titleById.get(region.workspace_id) || region.workspace_id,
    })),
  });
}
