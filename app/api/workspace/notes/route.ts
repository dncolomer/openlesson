import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { ayclTokenFromBody, guardWorkspaceRoute } from "@/lib/api/require-auth";

export const runtime = "nodejs";

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { workspaceId, notes } = body;

    if (!workspaceId || typeof notes !== "string") {
      return jsonError(400, "workspaceId and notes are required");
    }

    const auth = await guardWorkspaceRoute(workspaceId, { ayclToken: ayclTokenFromBody(body) });
    if (!auth.ok) return auth.response;

    const { user, supabase } = auth;

    const { error: updateError } = await supabase
      .from("workspaces")
      .update({ notes })
      .eq("id", workspaceId)
      .eq("user_id", user.id);

    if (updateError) {
      console.error("[Plan Notes] Update error:", updateError);
      return jsonError(500, "Failed to update notes");
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Plan Notes] Error:", error);
    return jsonError(500, error instanceof Error ? error.message : "Failed to update notes");
  }
}
