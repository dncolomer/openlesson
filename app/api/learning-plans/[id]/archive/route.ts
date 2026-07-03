import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { setWorkspaceArchived } from "@/lib/workspace-archive";

export const runtime = "nodejs";

export async function POST(
  _req: NextRequest,
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

    const workspace = await setWorkspaceArchived(supabase, workspaceId, user.id, true);

    return NextResponse.json({
      success: true,
      workspace: {
        id: workspace.id,
        status: workspace.status,
        archived_at: workspace.archived_at,
        title: workspace.title || workspace.root_topic,
      },
      message: "Workspace archived. It is hidden from your dashboard but data is preserved.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to archive workspace";
    const status = message.includes("not found") ? 404 : message.includes("owner") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(
  _req: NextRequest,
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

    const workspace = await setWorkspaceArchived(supabase, workspaceId, user.id, false);

    return NextResponse.json({
      success: true,
      workspace: {
        id: workspace.id,
        status: workspace.status,
        archived_at: workspace.archived_at,
        title: workspace.title || workspace.root_topic,
      },
      message: "Workspace restored to active.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to restore workspace";
    const status = message.includes("not found") ? 404 : message.includes("owner") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}