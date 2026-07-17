import { NextRequest, NextResponse } from "next/server";
import { ayclTokenFromBody, guardWorkspaceRoute, requireAuthenticatedUser } from "@/lib/api/require-auth";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workspaceId } = await params;
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const { user, supabase } = auth;

    const { is_group } = await req.json();
    if (typeof is_group !== "boolean") {
      return NextResponse.json({ error: "is_group must be a boolean" }, { status: 400 });
    }

    // Only the plan owner can toggle group mode
    const { error: updateError } = await supabase
      .from("workspaces")
      .update({ is_group })
      .eq("id", workspaceId)
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
