import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || undefined;
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    // withCover=1 restricts the result to public plans that have a
    // generated cover image — used by the landing-page carousel, which
    // is purely visual and skips card-less plans.
    const requireCover = searchParams.get("withCover") === "1";

    let query = supabase
      .from("workspaces")
      .select("id, root_topic, title, user_id, remix_count, cover_image_url, created_at", { count: "exact" })
      .eq("is_public", true)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (requireCover) {
      query = query.not("cover_image_url", "is", null);
    }

    if (search) {
      query = query.ilike("root_topic", `%${search}%`);
    }

    const { data: plans, count: total, error } = await query;

    if (error) {
      console.error("Error fetching public plans:", error);
      return jsonError(500, error.message);
    }

    const communityPlans = (plans || []).map((p: any) => ({
      id: p.id,
      root_topic: p.root_topic,
      title: p.title,
      cover_image_url: p.cover_image_url,
      created_at: p.created_at,
      remix_count: p.remix_count || 0,
    }));

    return NextResponse.json({ plans: communityPlans, total: total || 0 });
  } catch (error) {
    console.error("Error fetching community plans:", error);
    return jsonError(500, "Failed to fetch community plans");
  }
}
