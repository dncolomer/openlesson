import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { createAdminClient } from "@/lib/supabase/admin";
import { assembleAyclCatalogCard } from "@/lib/aycl-marketplace";

export const runtime = "nodejs";

const CATALOG_SELECT =
  "id, title, root_topic, description, cover_image_url, created_at, aycl_category, aycl_summary, aycl_author_name, aycl_author_avatar_url, aycl_learner_price_cents, aycl_full_price_cents";

export async function GET() {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("workspaces")
      .select(CATALOG_SELECT)
      .eq("is_all_you_can_learn", true)
      .order("created_at", { ascending: false });

    if (error) {
      return jsonError(500, error.message);
    }

    const workspaces = (data || []).map((workspace) =>
      assembleAyclCatalogCard(workspace),
    );

    return NextResponse.json({ workspaces });
  } catch (error) {
    console.error("[aycl/workspaces]", error);
    return jsonError(500, "Failed to load workspaces");
  }
}
