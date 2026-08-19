import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadPublicMapOfKnowledge } from "@/lib/map-of-knowledge/load-public-map";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/map-of-knowledge?embedding_model_id=
 * Public aggregate of public workspaces: regions, user locations, PoW stats, blocks.
 * Filter embeddings / regions by embedding_model_id (default knowledgecfg-v1-d64).
 */
export async function GET(req: NextRequest) {
  try {
    const embeddingModelId =
      req.nextUrl.searchParams.get("embedding_model_id")?.trim() ||
      req.nextUrl.searchParams.get("embeddingModelId")?.trim() ||
      null;
    const supabase = createAdminClient();
    const payload = await loadPublicMapOfKnowledge(supabase, { embeddingModelId });
    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    });
  } catch (error) {
    console.error("[api/map-of-knowledge]", error);
    return jsonError(500, error instanceof Error ? error.message : "Failed to load Map of Knowledge",);
  }
}
