import { NextRequest, NextResponse } from "next/server";
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
 * GET ?workspaceId=&quality=&subjectKey=
 * POST { workspaceId, ayclToken?, quality?, subjectKey? }
 */
async function handle(
  workspaceId: string,
  supabase: import("@supabase/supabase-js").SupabaseClient,
  filters: { quality: PowQualityFilter; subjectKey: string; currentUserId?: string | null },
) {
  return loadWorkspaceProofOfWorkStats(supabase, workspaceId, {
    quality: filters.quality,
    subjectKey: filters.subjectKey,
    currentUserId: filters.currentUserId,
  });
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const workspaceId = url.searchParams.get("workspaceId") || "";
    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
    }
    const auth = await guardWorkspaceRoute(workspaceId);
    if (!auth.ok) return auth.response;
    const stats = await handle(workspaceId, auth.supabase, {
      quality: parseQuality(url.searchParams.get("quality")),
      subjectKey: parseSubjectKey(url.searchParams.get("subjectKey")),
      currentUserId: auth.user?.id ?? null,
    });
    return NextResponse.json({ stats });
  } catch (error) {
    console.error("[workspace/proof-of-work-stats] GET failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load proof-of-work stats" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId : "";
    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
    }
    const auth = await guardWorkspaceRoute(workspaceId, { ayclToken: ayclTokenFromBody(body) });
    if (!auth.ok) return auth.response;
    const stats = await handle(workspaceId, auth.supabase, {
      quality: parseQuality(body.quality),
      subjectKey: parseSubjectKey(body.subjectKey),
      currentUserId: auth.user?.id ?? null,
    });
    return NextResponse.json({ stats });
  } catch (error) {
    console.error("[workspace/proof-of-work-stats] POST failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load proof-of-work stats" },
      { status: 500 }
    );
  }
}
