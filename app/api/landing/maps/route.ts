import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import {
  PUBLIC_MAP_CATALOG_SELECT,
  presentPublicMapCatalog,
} from "@/lib/dashboard-home-catalog";
import {
  LANDING_FEATURED_MAP_IDS,
  orderLandingFeaturedMaps,
} from "@/lib/marketing/landing-featured-maps";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("workspaces")
      .select(PUBLIC_MAP_CATALOG_SELECT)
      .in("id", [...LANDING_FEATURED_MAP_IDS]);
    if (error) return jsonError(500, error.message);
    const maps = orderLandingFeaturedMaps(presentPublicMapCatalog(data || []));
    return NextResponse.json({ maps });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load maps";
    return jsonError(500, message);
  }
}
