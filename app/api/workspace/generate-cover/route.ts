import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateAndStorePlanCover } from "@/lib/workspace-image";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { workspaceId, description } = await req.json();

    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
    }

    // Verify ownership
    const { data: plan, error: planError } = await supabase
      .from("workspaces")
      .select("id, user_id, root_topic, description")
      .eq("id", workspaceId)
      .single();

    if (planError || !plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    if (plan.user_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const imageDescription = description || plan.description || plan.root_topic;

    const coverUrl = await generateAndStorePlanCover(
      supabase as any,
      user.id,
      workspaceId,
      imageDescription
    );

    if (!coverUrl) {
      return NextResponse.json(
        { error: "Failed to generate cover image" },
        { status: 500 }
      );
    }

    return NextResponse.json({ coverImageUrl: coverUrl });
  } catch (error) {
    console.error("Generate cover error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
