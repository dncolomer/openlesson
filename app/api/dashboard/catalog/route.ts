import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import {
  PUBLIC_MAP_CATALOG_SELECT,
  presentPublicMapCatalog,
} from "@/lib/dashboard-home-catalog";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    void req;
    const { data, error } = await auth.supabase
      .from("workspaces")
      .select(PUBLIC_MAP_CATALOG_SELECT)
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
