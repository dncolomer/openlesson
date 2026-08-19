import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const { user, supabase } = auth;

    const { data: insight, error: fetchError } = await supabase
      .from("insights")
      .select("id, user_id, archived_at")
      .or(`id.eq.${id},share_token.eq.${id}`)
      .maybeSingle();

    if (fetchError || !insight) {
      return jsonError(404, "Insight not found");
    }

    if (insight.user_id !== user.id) {
      return jsonError(403, "Only the insight owner can archive it");
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
      return jsonError(500, updateError?.message || "Failed to archive insight");
    }

    return NextResponse.json({
      success: true,
      insight: updated,
      message: "Insight archived. It is no longer accessible or shareable.",
    });
  } catch (error) {
    console.error("[insights/archive]", error);
    return jsonError(500, "Internal server error");
  }
}