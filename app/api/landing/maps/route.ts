import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import {
  LANDING_PUBLIC_MAPS_LIMIT,
  PUBLIC_MAP_CATALOG_SELECT,
  presentPublicMapCatalog,
} from "@/lib/dashboard-home-catalog";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("workspaces")
      .select(PUBLIC_MAP_CATALOG_SELECT)
      .eq("is_public", true)
      .order("created_at", { ascending: false })
      .limit(LANDING_PUBLIC_MAPS_LIMIT);
    if (error) return jsonError(500, error.message);
    return NextResponse.json({ maps: presentPublicMapCatalog(data || []) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load maps";
    return jsonError(500, message);
  }
}
