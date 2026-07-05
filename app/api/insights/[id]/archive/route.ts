import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: insight, error: fetchError } = await supabase
      .from("insights")
      .select("id, user_id, archived_at")
      .or(`id.eq.${id},share_token.eq.${id}`)
      .maybeSingle();

    if (fetchError || !insight) {
      return NextResponse.json({ error: "Insight not found" }, { status: 404 });
    }

    if (insight.user_id !== user.id) {
      return NextResponse.json({ error: "Only the insight owner can archive it" }, { status: 403 });
    }

    if (insight.archived_at) {
      return NextResponse.json({ success: true, message: "Insight is already archived." });
    }

    const { data: updated, error: updateError } = await supabase
      .from("insights")
      .update({
        archived_at: new Date().toISOString(),
        is_public: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", insight.id)
      .eq("user_id", user.id)
      .select("id, archived_at")
      .single();

    if (updateError || !updated) {
      return NextResponse.json({ error: updateError?.message || "Failed to archive insight" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      insight: updated,
      message: "Insight archived. It is no longer accessible or shareable.",
    });
  } catch (error) {
    console.error("[insights/archive]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}