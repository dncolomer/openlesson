import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: planId } = await params;
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { is_group } = await req.json();
    if (typeof is_group !== "boolean") {
      return NextResponse.json({ error: "is_group must be a boolean" }, { status: 400 });
    }

    // Only the plan owner can toggle group mode
    const { error: updateError } = await supabase
      .from("learning_plans")
      .update({ is_group })
      .eq("id", planId)
      .eq("user_id", user.id);

    if (updateError) {
      console.error("[group toggle] Update error:", updateError);
      return NextResponse.json(
        { error: "Failed to update: " + updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      is_group,
      message: is_group
        ? "Plan is now a group plan. Anyone with the link can start sessions."
        : "Group mode disabled.",
    });
  } catch (error) {
    console.error("[group toggle] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
