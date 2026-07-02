import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthContext } from "./types";

export interface WorkspaceSessionPlan {
  id: string;
  title: string | null;
  root_topic: string | null;
  description: string | null;
  notes: string | null;
  user_id: string;
}

export interface WorkspaceSessionAccess {
  userId: string;
  plan: WorkspaceSessionPlan;
  auth: AuthContext;
  supabase: SupabaseClient;
  hasTeams: boolean;
}

export async function requireWorkspaceOwnerSession(
  planId: string
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
      .select("plan, subscription_status, is_admin, organization_id, is_org_admin")
      .eq("id", user.id)
      .single(),
    supabase
      .from("learning_plans")
      .select("id, title, root_topic, description, notes, user_id")
      .eq("id", planId)
      .single(),
  ]);

  if (!plan) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  if (plan.user_id !== user.id) {
    return NextResponse.json(
      { error: "Only the workspace owner can access integration tools", code: "forbidden" },
      { status: 403 }
    );
  }

  const hasTeams =
    profile?.is_admin === true ||
    (profile?.plan === "pro_teams" && profile?.subscription_status === "active");

  if (!hasTeams) {
    return NextResponse.json(
      {
        error: "The Agentic API requires the Teams tier.",
        code: "teams_required",
        renew_url: "/pricing",
      },
      { status: 403 }
    );
  }

  const auth: AuthContext = {
    user_id: user.id,
    guest_user_id: null,
    organization_id: profile?.organization_id || null,
    is_org_admin: profile?.is_org_admin === true || profile?.is_admin === true,
    key_id: "ui-session",
    scopes: ["workspaces:read", "workspaces:write"],
  };

  return {
    userId: user.id,
    plan,
    auth,
    supabase: createAdminClient(),
    hasTeams,
  };
}