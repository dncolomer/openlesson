import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/require-admin";
import {
  ADMIN_POW_SELECT,
  mapProofOfWorkRow,
} from "@/lib/admin/proof-of-work";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient } = auth;

    const { data: userProfile, error: profileError } = await adminClient
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { data: authData } = await adminClient.auth.admin.getUserById(userId);

    let organization = null;
    if (userProfile.organization_id) {
      const { data: orgData } = await adminClient
        .from("organizations")
        .select("id, name, slug")
        .eq("id", userProfile.organization_id)
        .single();
      organization = orgData;
    }

    const [plansData, powData] = await Promise.all([
      adminClient
        .from("workspaces")
        .select("id, root_topic, title, status, created_at, is_public")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      adminClient
        .from("workspace_proof_of_work")
        .select(ADMIN_POW_SELECT)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    if (powData.error) {
      console.error("Admin user PoW error:", powData.error);
      return NextResponse.json({ error: "Failed to load proof of work" }, { status: 500 });
    }

    const workspaceIds = [
      ...new Set(
        (powData.data || [])
          .map((row) => row.workspace_id)
          .filter((id): id is string => Boolean(id))
      ),
    ];

    const workspaceTitleById = new Map<string, string>();
    if (workspaceIds.length > 0) {
      const { data: workspaces } = await adminClient
        .from("workspaces")
        .select("id, title, root_topic")
        .in("id", workspaceIds);
      for (const ws of workspaces || []) {
        workspaceTitleById.set(ws.id, ws.title || ws.root_topic || ws.id);
      }
    }

    const proofOfWork = (powData.data || []).map((row) =>
      mapProofOfWorkRow(
        row,
        row.workspace_id ? workspaceTitleById.get(row.workspace_id) || null : null
      )
    );

    return NextResponse.json({
      user: {
        ...userProfile,
        email: authData.user?.email || null,
        email_confirmed_at: authData.user?.email_confirmed_at || null,
        organization,
      },
      proofOfWork,
      plans: plansData.data || [],
    });
  } catch (error) {
    console.error("Admin user detail error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
