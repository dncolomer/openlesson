import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/pow-api/auth";
import { createClient } from "@/lib/supabase/server";
import { readJsonObject, tryCreateTapbenchAdminClient } from "@/lib/tapbench/http";
import { loadCatalogAndIssueKeys } from "@/lib/tapbench/issue-keys";
import {
  TAPBENCH_WRAP_SKILL_FILENAME,
  buildTapbenchWrapSkillMarkdown,
} from "@/lib/tapbench/skill-md";
import { listTapbenchBenchmarkTasks } from "@/lib/tapbench/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function workspaceIdsFromBody(body: Record<string, unknown>): string[] {
  const raw = body.workspace_ids ?? body.task_ids ?? body.ids;
  if (Array.isArray(raw)) {
    return raw.filter((id): id is string => typeof id === "string");
  }
  if (typeof body.workspace_id === "string") return [body.workspace_id];
  return [];
}

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

/**
 * Skill.md for selected Tasks. Issues TAPBench keys and embeds them.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await readJsonObject(req);
    const workspaceIds = workspaceIdsFromBody(body);
    if (!workspaceIds.length) {
      return errorResponse(400, "validation_error", "workspace_ids required");
    }

    const supabase = tryCreateTapbenchAdminClient();
    const userId = await optionalUserId();
    const origin =
      typeof body.origin === "string" && body.origin.trim()
        ? body.origin.trim()
        : req.nextUrl.origin;

    const result = await loadCatalogAndIssueKeys({
      supabase,
      workspaceIds,
      userId,
      label: "TAPBench skill",
    });

    if (!result.ok) {
      return errorResponse(404, "workspace_not_found", "Unknown Benchmark Task", {
        workspace_ids: result.missing,
      });
    }

    const markdown = buildTapbenchWrapSkillMarkdown({
      origin,
      tasks: result.issued.map((row) => ({
        id: row.workspace_id,
        title: row.task_title,
        key: row.tapbench_key,
      })),
    });

    return NextResponse.json(
      {
        filename: TAPBENCH_WRAP_SKILL_FILENAME,
        markdown,
        keys: result.issued,
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("[tapbench/skill]", err);
    const message = err instanceof Error ? err.message : "Failed to build TAPBench skill";
    return errorResponse(500, "internal_error", message);
  }
}

/** Skill.md with placeholders (no keys). Query: workspace_ids=a,b */
export async function GET(req: NextRequest) {
  try {
    const supabase = tryCreateTapbenchAdminClient();
    const tasks = await listTapbenchBenchmarkTasks(supabase);
    const wanted = (req.nextUrl.searchParams.get("workspace_ids") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const selected = wanted.length
      ? tasks.filter((t) => wanted.includes(t.id))
      : tasks;
    const markdown = buildTapbenchWrapSkillMarkdown({
      origin: req.nextUrl.origin,
      tasks: selected.map((t) => ({ id: t.id, title: t.title })),
    });
    return NextResponse.json({
      filename: TAPBENCH_WRAP_SKILL_FILENAME,
      markdown,
    });
  } catch (err) {
    console.error("[tapbench/skill GET]", err);
    const message = err instanceof Error ? err.message : "Failed to build TAPBench skill";
    return errorResponse(500, "internal_error", message);
  }
}
