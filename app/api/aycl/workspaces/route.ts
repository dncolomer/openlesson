import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  AYCL_FULL_PRICE_LABEL,
  AYCL_LEARNER_PRICE_LABEL,
  ayclOfferDescription,
  ayclOfferLabel,
} from "@/lib/aycl-shared";

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
        /** @deprecated use offers.full.priceLabel */
        priceLabel: AYCL_FULL_PRICE_LABEL,
        offers: {
          learner: {
            tier: "learner" as const,
            label: ayclOfferLabel("learner"),
            description: ayclOfferDescription("learner"),
            priceLabel: AYCL_LEARNER_PRICE_LABEL,
          },
          full: {
            tier: "full" as const,
            label: ayclOfferLabel("full"),
            description: ayclOfferDescription("full"),
            priceLabel: AYCL_FULL_PRICE_LABEL,
          },
        },
      })),
    });
  } catch (error) {
    console.error("[aycl/workspaces]", error);
    return NextResponse.json({ error: "Failed to load workspaces" }, { status: 500 });
  }
}