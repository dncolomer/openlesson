import { NextRequest, NextResponse } from "next/server";
import { ayclTokenFromBody, guardWorkspaceRoute } from "@/lib/api/require-auth";

export const runtime = "nodejs";

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { workspaceId, notes } = body;

    if (!workspaceId || typeof notes !== "string") {
      return NextResponse.json({ error: "workspaceId and notes are required" }, { status: 400 });
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
