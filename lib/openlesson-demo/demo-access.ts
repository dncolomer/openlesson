import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AuthContext } from "@/lib/agent-v2/types";
import type {
  TeamsUserSession,
  WorkspaceSessionAccess,
  WorkspaceSessionPlan,
} from "@/lib/agent-v2/workspace-session-access";

function adminRequiredResponse() {
  return NextResponse.json(
    { error: "Admin access required", code: "admin_required" },
    { status: 403 },
  );
}

export async function requireDemoAdminSession(): Promise<TeamsUserSession | NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated", code: "auth_required" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, organization_id, is_org_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    return adminRequiredResponse();
  }

  const auth: AuthContext = {
    user_id: user.id,
    guest_user_id: null,
    organization_id: profile.organization_id || null,
    is_org_admin: true,
    key_id: "ui-session",
    scopes: ["workspaces:read", "workspaces:write"],
  };

  return {
    userId: user.id,
    auth,
    supabase: createAdminClient(),
    hasTeams: true,
    organizationId: profile.organization_id || null,
  };
}

export async function requireDemoAdminWorkspaceSession(
  workspaceId: string,
): Promise<WorkspaceSessionAccess | NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const [{ data: profile }, { data: plan }] = await Promise.all([
    supabase
      .from("profiles")
      .select("is_admin, organization_id, is_org_admin")
      .eq("id", user.id)
      .single(),
    supabase
      .from("workspaces")
      .select("id, title, root_topic, description, notes, conversion_goal, user_id, organization_id")
      .eq("id", workspaceId)
      .single(),
  ]);

  if (!profile?.is_admin) {
    return adminRequiredResponse();
  }

  if (!plan) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  if (plan.user_id !== user.id) {
    return NextResponse.json(
      { error: "Only the workspace owner can access integration tools", code: "forbidden" },
      { status: 403 },
    );
  }

  const auth: AuthContext = {
    user_id: user.id,
    guest_user_id: null,
    organization_id: profile.organization_id || null,
    is_org_admin: true,
    key_id: "ui-session",
    scopes: ["workspaces:read", "workspaces:write"],
  };

  return {
    userId: user.id,
    plan: plan as WorkspaceSessionPlan,
    auth,
    supabase: createAdminClient(),
    hasTeams: true,
  };
}