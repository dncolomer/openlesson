import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AYCL_PRICE_LABEL } from "@/lib/aycl";

export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("workspaces")
      .select("id, title, root_topic, description, cover_image_url, created_at")
      .eq("is_all_you_can_learn", true)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      workspaces: (data || []).map((workspace) => ({
        id: workspace.id,
        title: workspace.title || workspace.root_topic,
        description: workspace.description,
        cover_image_url: workspace.cover_image_url,
        priceLabel: AYCL_PRICE_LABEL,
      })),
    });
  } catch (error) {
    console.error("[aycl/workspaces]", error);
    return NextResponse.json({ error: "Failed to load workspaces" }, { status: 500 });
  }
}