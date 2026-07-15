import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workspaceId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await req.json();
    const enabled = Boolean(body.is_all_you_can_learn);

    const admin = createAdminClient();
    const { data: workspace, error: workspaceError } = await admin
      .from("workspaces")
      .select("id, user_id")
      .eq("id", workspaceId)
      .single();

    if (workspaceError || !workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    const { error: updateError } = await admin
      .from("workspaces")
      .update({ is_all_you_can_learn: enabled })
      .eq("id", workspaceId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      is_all_you_can_learn: enabled,
      message: enabled
        ? "Workspace is now available on All-You-Can-Learn."
        : "Workspace removed from All-You-Can-Learn.",
    });
  } catch (error) {
    console.error("[workspaces/aycl]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update AYCL flag" },
      { status: 500 }
    );
  }
}