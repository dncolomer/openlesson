import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import { presentPublicMapCatalog } from "@/lib/dashboard-home-catalog";

export const runtime = "nodejs";

const CATALOG_SELECT =
  "id, title, root_topic, description, workspace_goal, cover_image_url, created_at, is_public, is_all_you_can_learn, is_play_copy, workspace_kind, aycl_category, aycl_summary, aycl_full_price_cents";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    void req;
    const { data, error } = await auth.supabase
      .from("workspaces")
      .select(CATALOG_SELECT)
      .eq("is_public", true)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) return jsonError(500, error.message);
    return NextResponse.json({ maps: presentPublicMapCatalog(data || []) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load maps";
    return jsonError(500, message);
  }
}
