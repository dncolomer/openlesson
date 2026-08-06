import { NextRequest, NextResponse } from "next/server";
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

    const body = (await req.json()) as Record<string, unknown>;
    const { fields, error: parseError } = parseAyclListingUpdateBody(body);

    if (parseError) {
      return NextResponse.json({ error: parseError }, { status: 400 });
    }

    if (Object.keys(fields).length === 0) {
      return NextResponse.json(
        { error: "No AYCL listing fields to update" },
        { status: 400 },
      );
    }

    const admin = createAdminClient();
    const { data: workspace, error: workspaceError } = await admin
      .from("workspaces")
      .select("id, user_id")
      .eq("id", workspaceId)
      .single();

    if (workspaceError || !workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    const { data: updated, error: updateError } = await admin
      .from("workspaces")
      .update(fields)
      .eq("id", workspaceId)
      .select(LISTING_SELECT)
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update AYCL listing" },
      { status: 500 }
    );
  }
}
