import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { forkPlan } from "@/lib/storage";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workspaceId } = await params;
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await forkPlan(workspaceId, user.id);

    return NextResponse.json({
      success: true,
      workspaceId: result.workspaceId,
      message: `Plan forked with ${result.nodesCount} sessions. Your copy will be adapted to your learning journey as you complete sessions.`,
    });
  } catch (error) {
    console.error("Error forking plan:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fork plan" },
      { status: 500 }
    );
  }
}