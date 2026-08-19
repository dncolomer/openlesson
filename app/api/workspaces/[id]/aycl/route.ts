import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseAyclListingUpdateBody } from "@/lib/aycl-marketplace";

const LISTING_SELECT =
  "id, is_all_you_can_learn, aycl_category, aycl_summary, aycl_author_name, aycl_author_avatar_url, aycl_learner_price_cents, aycl_full_price_cents";

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
      return jsonError(401, "Unauthorized");
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (!profile?.is_admin) {
      return jsonError(403, "Admin access required");
    }

    const body = (await req.json()) as Record<string, unknown>;
    const { fields, error: parseError } = parseAyclListingUpdateBody(body);

    if (parseError) {
      return jsonError(400, parseError);
    }

    if (Object.keys(fields).length === 0) {
      return jsonError(400, "No AYCL listing fields to update");
    }

    const admin = createAdminClient();
    const { data: workspace, error: workspaceError } = await admin
      .from("workspaces")
      .select("id, user_id")
      .eq("id", workspaceId)
      .single();

    if (workspaceError || !workspace) {
      return jsonError(404, "Workspace not found");
    }

    const { data: updated, error: updateError } = await admin
      .from("workspaces")
      .update(fields)
      .eq("id", workspaceId)
      .select(LISTING_SELECT)
      .single();

    if (updateError) {
      return jsonError(500, updateError.message);
    }

    const enabled = Boolean(updated?.is_all_you_can_learn);
    return NextResponse.json({
      success: true,
      is_all_you_can_learn: enabled,
      listing: updated,
      message:
        "is_all_you_can_learn" in fields
          ? enabled
            ? "Workspace is now available on All-You-Can-Learn."
            : "Workspace removed from All-You-Can-Learn."
          : "AYCL marketplace listing updated.",
    });
  } catch (error) {
    console.error("[workspaces/aycl]", error);
    return jsonError(500, error instanceof Error ? error.message : "Failed to update AYCL listing");
  }
}
