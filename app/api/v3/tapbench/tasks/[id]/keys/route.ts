import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/pow-api/auth";
import { createClient } from "@/lib/supabase/server";
import { listTapbenchBenchmarkTasks } from "@/lib/tapbench/catalog";
import { issueTapbenchTaskKey, memoryTapbenchKeyStore } from "@/lib/tapbench/keys";
import { tryCreateTapbenchAdminClient, readJsonObject } from "@/lib/tapbench/http";
import { supabaseTapbenchKeyStore } from "@/lib/tapbench/store-supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteProps {
  params: Promise<{ id: string }>;
}

/**
 * Issue a TAPBench key scoped to one Benchmark Task (workspace).
 */
export async function POST(req: NextRequest, { params }: RouteProps) {
  try {
    const { id: workspaceId } = await params;
    const taskId = typeof workspaceId === "string" ? workspaceId.trim() : "";
    if (!taskId) {
      return errorResponse(400, "validation_error", "Benchmark Task id is required");
    }

    const supabase = tryCreateTapbenchAdminClient();
    const tasks = await listTapbenchBenchmarkTasks(supabase);
    const task = tasks.find((t) => t.id === taskId);
    if (!task) {
      return errorResponse(
        404,
        "workspace_not_found",
        "No public TAPBench Benchmark Task with that workspace id",
      );
    }

    let userId: string | null = null;
    try {
      const browser = await createClient();
      const {
        data: { user },
      } = await browser.auth.getUser();
      userId = user?.id ?? null;
    } catch {
      userId = null;
    }

    const body = await readJsonObject(req);
    const label = typeof body.label === "string" ? body.label : "TAPBench key";

    const store = supabase ? supabaseTapbenchKeyStore(supabase) : memoryTapbenchKeyStore;
    const issued = await issueTapbenchTaskKey(
      { workspaceId: taskId, userId, label },
      store,
    );

    return NextResponse.json(
      {
        tapbench_key: issued.rawKey,
        key: {
          id: issued.record.id,
          workspace_id: issued.record.workspace_id,
          key_prefix: issued.record.key_prefix,
          label: issued.record.label,
          created_at: issued.record.created_at,
        },
        task: { id: task.id, title: task.title },
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("[tapbench/tasks/keys]", err);
    const message = err instanceof Error ? err.message : "Failed to issue TAPBench key";
    return errorResponse(500, "internal_error", message);
  }
}
