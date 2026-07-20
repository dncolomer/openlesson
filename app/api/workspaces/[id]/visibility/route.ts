import { NextRequest, NextResponse } from "next/server";
import { ayclTokenFromBody, guardWorkspaceRoute, requireAuthenticatedUser } from "@/lib/api/require-auth";
import { normalizeWorkspaceGoal } from "@/lib/pow-api/conversion-goal";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workspaceId } = await params;
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const { user, supabase } = auth;

    const body = await req.json();
    const { is_public, title, description, workspace_goal } = body;

    const updates: Record<string, unknown> = {};

    if (typeof is_public === "boolean") {
      updates.is_public = is_public;
    }

    if (typeof title === "string" && title.trim()) {
      updates.title = title.trim();
      updates.root_topic = title.trim();
    }

    if (typeof description === "string") {
      updates.description = description.trim() || null;
    }

    if ("workspace_goal" in body) {
      updates.workspace_goal =
        workspace_goal === null ? null : normalizeWorkspaceGoal(workspace_goal);
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    // First, let's check if we can read the plan
    const { data: existingPlan, error: checkError } = await supabase
      .from("workspaces")
      .select("id, user_id, is_public")
      .eq("id", workspaceId)
      .single();

    if (checkError) {
      console.error("Check error:", checkError);
      return NextResponse.json({ error: "Cannot access plan: " + checkError.message }, { status: 500 });
    }

    console.log("Existing plan:", existingPlan);
    console.log("Current user:", user.id);

    // Now update
    const { error: updateError } = await supabase
      .from("workspaces")
      .update({ ...updates, author_id: user.id })
      .eq("id", workspaceId)
      .eq("user_id", user.id);

    if (updateError) {
      console.error("Update error:", updateError);
      return NextResponse.json({ error: "Update failed: " + updateError.message }, { status: 500 });
    }

    // Verify the update
    const { data: verifyPlan } = await supabase
      .from("workspaces")
      .select("is_public, title, description, workspace_goal")
      .eq("id", workspaceId)
      .single();

    console.log("After update:", verifyPlan);

    const response: Record<string, any> = {
      success: true,
    };

    if (typeof is_public === "boolean") {
      response.is_public = verifyPlan?.is_public;
      response.message = is_public
        ? "Plan is now public and visible to the community!"
        : "Plan is now private.";
    }

    if (title) {
      response.title = verifyPlan?.title;
      response.message = response.message 
        ? response.message + " Title updated." 
        : "Title updated.";
    }

    if (typeof description === "string") {
      response.description = verifyPlan?.description;
    }

    if ("workspace_goal" in body) {
      response.workspace_goal = verifyPlan?.workspace_goal;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error updating plan visibility:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update visibility" },
      { status: 500 }
    );
  }
}
