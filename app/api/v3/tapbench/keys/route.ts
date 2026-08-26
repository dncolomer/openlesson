import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/pow-api/auth";
import { createClient } from "@/lib/supabase/server";
import { readJsonObject, tryCreateTapbenchAdminClient } from "@/lib/tapbench/http";
import { loadCatalogAndIssueKeys } from "@/lib/tapbench/issue-keys";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function optionalUserId(): Promise<string | null> {
  try {
    const browser = await createClient();
    const {
      data: { user },
    } = await browser.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

function workspaceIdsFromBody(body: Record<string, unknown>): string[] {
  const raw = body.workspace_ids ?? body.task_ids ?? body.ids;
  if (Array.isArray(raw)) {
    return raw.filter((id): id is string => typeof id === "string");
  }
  if (typeof body.workspace_id === "string") return [body.workspace_id];
  return [];
}

/** Issue TAPBench keys for one or more Benchmark Tasks. */
export async function POST(req: NextRequest) {
  try {
    const body = await readJsonObject(req);
    const workspaceIds = workspaceIdsFromBody(body);
    if (!workspaceIds.length) {
      return errorResponse(400, "validation_error", "workspace_ids required");
    }

    const supabase = tryCreateTapbenchAdminClient();
    const userId = await optionalUserId();
    const result = await loadCatalogAndIssueKeys({
      supabase,
      workspaceIds,
      userId,
      label: typeof body.label === "string" ? body.label : "TAPBench key",
    });

    if (!result.ok) {
      return errorResponse(404, "workspace_not_found", "Unknown Benchmark Task", {
        workspace_ids: result.missing,
      });
    }

    return NextResponse.json({ keys: result.issued }, { status: 201 });
  } catch (err) {
    console.error("[tapbench/keys]", err);
    const message = err instanceof Error ? err.message : "Failed to issue TAPBench key";
    return errorResponse(500, "internal_error", message);
  }
}
