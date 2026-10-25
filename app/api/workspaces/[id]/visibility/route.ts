import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { ayclTokenFromBody, guardWorkspaceRoute, requireAuthenticatedUser } from "@/lib/api/require-auth";
import { normalizeAyclCategory } from "@/lib/aycl-marketplace";
import { rejectPublishPlayCopy } from "@/lib/dashboard-home-catalog";
import { normalizeWorkspaceGoal } from "@/lib/pow-api/conversion-goal";
import { denyWorkspaceFeatureResponse } from "@/lib/workspace-feature-gate";
import { createAdminClient } from "@/lib/supabase/admin";

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
    const { is_public, title, description, workspace_goal, learning_model_size, aycl_category } = body;

    const admin = createAdminClient();
    const { data: kindRow } = await admin
      .from("workspaces")
      .select("workspace_kind")
      .eq("id", workspaceId)
      .maybeSingle();
    if (typeof is_public === "boolean") {
      const denied = denyWorkspaceFeatureResponse(kindRow?.workspace_kind, "make_public");
      if (denied) return denied;
    }
    if ("workspace_goal" in body) {
      const denied = denyWorkspaceFeatureResponse(kindRow?.workspace_kind, "goals");
      if (denied) return denied;
    }

    const { data: existingPlan, error: checkError } = await supabase
      .from("workspaces")
      .select("id, user_id, is_public, aycl_category, is_play_copy")
      .eq("id", workspaceId)
      .single();

    if (checkError) {
      console.error("Check error:", checkError);
      return jsonError(500, "Cannot access plan: " + checkError.message);
    }

    const updates: Record<string, unknown> = {};

    if (typeof is_public === "boolean") {
      updates.is_public = is_public;
    }

    if (typeof is_public === "boolean" && is_public) {
      const playCopyError = rejectPublishPlayCopy({
        makingPublic: true,
        isPlayCopy: Boolean(existingPlan?.is_play_copy),
      });
      if (playCopyError) return jsonError(403, playCopyError);
    }
    if (aycl_category !== undefined) {
      updates.aycl_category = normalizeAyclCategory(aycl_category);
    }

    if (typeof title === "string" && title.trim()) {
      updates.title = title.trim();
      updates.root_topic = title.trim();
    }

    if (typeof description === "string") {
      updates.description = description.trim() || null;
    }

    if ("workspace_goal" in body && updates.description === undefined) {
      updates.description =
        workspace_goal === null ? null : normalizeWorkspaceGoal(workspace_goal);
    }

    if ("learning_model_size" in body) {
      const size = Math.round(Number(learning_model_size));
      updates.learning_model_size = size === 8 || size === 16 ? size : 4;
    }

    if (Object.keys(updates).length === 0) {
      return jsonError(400, "No valid fields to update");
    }

    console.log("Existing plan:", existingPlan);
    console.log("Current user:", user.id);

    // Now update
    let updateError = (
      await supabase
        .from("workspaces")
        .update({ ...updates, author_id: user.id })
        .eq("id", workspaceId)
        .eq("user_id", user.id)
    ).error;
    if (updateError && String(updateError.message).includes("learning_model_size")) {
      const { learning_model_size: _size, ...withoutSize } = updates;
      updateError = (
        await supabase
          .from("workspaces")
          .update({ ...withoutSize, author_id: user.id })
          .eq("id", workspaceId)
          .eq("user_id", user.id)
      ).error;
    }

    if (updateError) {
      console.error("Update error:", updateError);
      return jsonError(500, "Update failed: " + updateError.message);
    }

    // Verify the update
    const { data: verifyPlan } = await supabase
      .from("workspaces")
      .select("is_public, title, description")
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
      response.workspace_goal = verifyPlan?.description ?? null;
    }

    if ("learning_model_size" in body) {
      const size = Number(updates.learning_model_size);
      response.learning_model_size = size === 8 || size === 16 ? size : 4;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error updating plan visibility:", error);
    return jsonError(500, error instanceof Error ? error.message : "Failed to update visibility");
  }
}
