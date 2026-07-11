import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const workspaceId = req.nextUrl.searchParams.get("workspaceId");
    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
    }

    // Get personal analytics (always)
    const { data: personal, error: personalError } = await supabase
      .rpc("get_personal_workspace_analytics", {
        target_workspace_id: workspaceId,
        requesting_user_id: user.id,
      });

    if (personalError) {
      console.error("[Plan Analytics] Personal error:", personalError);
    }

    // Check if user is org admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id, is_org_admin, is_admin")
      .eq("id", user.id)
      .single();

    let org = null;
    if (profile && (profile.is_admin || (profile.is_org_admin && profile.organization_id))) {
      const { data: orgData, error: orgError } = await supabase
        .rpc("get_org_workspace_analytics", {
          target_workspace_id: workspaceId,
          requesting_user_id: user.id,
        });

      if (orgError) {
        console.error("[Plan Analytics] Org error:", orgError);
      } else if (orgData && !orgData.error) {
        org = orgData;
      }
    }

    return NextResponse.json({
      personal: personal || {
        total_sessions: 0,
        completed_sessions: 0,
        total_blocks: 0,
        completed_blocks: 0,
        avg_duration_minutes: 0,
        total_duration_minutes: 0,
        avg_gap_score: 0,
        sessions: [],
      },
      org,
    });
  } catch (error) {
    console.error("[Plan Analytics] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load analytics" },
      { status: 500 }
    );
  }
}
