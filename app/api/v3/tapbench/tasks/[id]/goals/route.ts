import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/pow-api/auth";
import { loadTapbenchTaskGoals } from "@/lib/tapbench/goals";
import { tryCreateTapbenchAdminClient } from "@/lib/tapbench/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteProps {
  params: Promise<{ id: string }>;
}

/**
 * Public TAPBench task goals — what to demonstrate for this Benchmark Task.
 * GET /api/v3/tapbench/tasks/{workspace_id}/goals
 */
export async function GET(_req: NextRequest, { params }: RouteProps) {
  const { id } = await params;
  const workspaceId = typeof id === "string" ? id.trim() : "";
  if (!workspaceId) {
    return errorResponse(400, "validation_error", "Benchmark Task id is required");
  }

  const supabase = tryCreateTapbenchAdminClient();
  const payload = await loadTapbenchTaskGoals(supabase, workspaceId);
  if (!payload) {
    return errorResponse(
      404,
      "workspace_not_found",
      "No public TAPBench Benchmark Task with that workspace id",
    );
  }

  return NextResponse.json(payload);
}
