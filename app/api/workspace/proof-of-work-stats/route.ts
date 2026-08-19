import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { ayclTokenFromBody, guardWorkspaceRoute } from "@/lib/api/require-auth";
import { loadWorkspaceProofOfWorkStats } from "@/lib/pow-api/proof-of-work-stats";
import type { PowQualityFilter } from "@/lib/pow-api/pow-quality";

export const runtime = "nodejs";

const QUALITY_FILTERS = new Set<PowQualityFilter>(["all", "scored", "practice", "impure"]);

function parseQuality(value: unknown): PowQualityFilter {
  if (typeof value === "string" && QUALITY_FILTERS.has(value as PowQualityFilter)) {
    return value as PowQualityFilter;
  }
  return "all";
}

function parseSubjectKey(value: unknown): string {
  return typeof value === "string" && value.trim() ? value.trim() : "all";
}

/**
 * Cookie-auth Evaluation surface for workspace UI.
 * GET ?workspaceId=&quality=&subjectKey=&blockId=
 * POST { workspaceId, ayclToken?, quality?, subjectKey?, blockId? }
 */
async function handle(
  workspaceId: string,
  supabase: import("@supabase/supabase-js").SupabaseClient,
  filters: {
    quality: PowQualityFilter;
    subjectKey: string;
    currentUserId?: string | null;
    blockId?: string | null;
  },
) {
  return loadWorkspaceProofOfWorkStats(supabase, workspaceId, {
    quality: filters.quality,
    subjectKey: filters.subjectKey,
    currentUserId: filters.currentUserId,
    blockId: filters.blockId,
  });
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const workspaceId = url.searchParams.get("workspaceId") || "";
    if (!workspaceId) {
      return jsonError(400, "workspaceId is required");
    }
    const auth = await guardWorkspaceRoute(workspaceId);
    if (!auth.ok) return auth.response;
    const blockId = url.searchParams.get("blockId");
    const stats = await handle(workspaceId, auth.supabase, {
      quality: parseQuality(url.searchParams.get("quality")),
      subjectKey: parseSubjectKey(url.searchParams.get("subjectKey")),
      currentUserId: auth.subjectId,
      blockId: blockId && blockId.trim() ? blockId.trim() : null,
    });
    return NextResponse.json({ stats });
  } catch (error) {
    console.error("[workspace/proof-of-work-stats] GET failed:", error);
    return jsonError(500, error instanceof Error ? error.message : "Failed to load proof-of-work stats");
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId : "";
    if (!workspaceId) {
      return jsonError(400, "workspaceId is required");
    }
    const auth = await guardWorkspaceRoute(workspaceId, { ayclToken: ayclTokenFromBody(body) });
    if (!auth.ok) return auth.response;
    const blockId =
      typeof body.blockId === "string" && body.blockId.trim()
        ? body.blockId.trim()
        : null;
    const stats = await handle(workspaceId, auth.supabase, {
      quality: parseQuality(body.quality),
      subjectKey: parseSubjectKey(body.subjectKey),
      currentUserId: auth.subjectId,
      blockId,
    });
    return NextResponse.json({ stats });
  } catch (error) {
    console.error("[workspace/proof-of-work-stats] POST failed:", error);
    return jsonError(500, error instanceof Error ? error.message : "Failed to load proof-of-work stats");
  }
}
