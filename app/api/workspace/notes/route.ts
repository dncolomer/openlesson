import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function PUT(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { workspaceId, notes } = await req.json();

    if (!workspaceId || typeof notes !== "string") {
      return NextResponse.json({ error: "workspaceId and notes are required" }, { status: 400 });
    }

    // Verify ownership and update in one query (RLS also enforces this)
    const { error: updateError } = await supabase
      .from("workspaces")
      .update({ notes })
      .eq("id", workspaceId)
      .eq("user_id", user.id);

    if (updateError) {
      console.error("[Plan Notes] Update error:", updateError);
      return NextResponse.json({ error: "Failed to update notes" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Plan Notes] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update notes" },
      { status: 500 }
    );
  }
}
