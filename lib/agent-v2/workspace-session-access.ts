import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hasProofOfWorkApiAccess } from "@/lib/plans";
import type { AuthContext } from "./types";

export interface WorkspaceSessionPlan {
  id: string;
  title: string | null;
  root_topic: string | null;
  description: string | null;
  notes: string | null;
  conversion_goal: string | null;
  user_id: string;
  organization_id: string | null;
}

export interface WorkspaceSessionAccess {
  userId: string;
  plan: WorkspaceSessionPlan;
  auth: AuthContext;
  supabase: SupabaseClient;
  hasTeams: boolean;
}

export interface TeamsUserSession {
  userId: string;
  auth: AuthContext;
  supabase: SupabaseClient;
  hasTeams: boolean;
  organizationId: string | null;
}

export async function requireTeamsUserSession(): Promise<TeamsUserSession | NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated", code: "auth_required" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, subscription_status, is_admin, organization_id, is_org_admin")
    .eq("id", user.id)
    .single();

  const hasApiAccess =
    profile?.is_admin === true ||
    hasProofOfWorkApiAccess(profile?.plan, profile?.subscription_status);

  if (!hasApiAccess) {
    return NextResponse.json(
      {
        error: "The Proof-of-Work API requires Pro / Teams or API Metered.",
        code: "api_plan_required",
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
    auth,
    supabase: createAdminClient(),
    hasTeams: hasApiAccess,
    organizationId: profile?.organization_id || null,
  };
}

export async function requireWorkspaceOwnerSession(
  workspaceId: string
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
      .from("workspaces")
      .select("id, title, root_topic, description, notes, conversion_goal, user_id, organization_id")
      .eq("id", workspaceId)
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

  const hasApiAccess =
    profile?.is_admin === true ||
    hasProofOfWorkApiAccess(profile?.plan, profile?.subscription_status);

  if (!hasApiAccess) {
    return NextResponse.json(
      {
        error: "The Proof-of-Work API requires Pro / Teams or API Metered.",
        code: "api_plan_required",
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
    hasTeams: hasApiAccess,
  };
}

export interface SessionWorkspaceProofOfWorkAccess {
  userId: string;
  workspace: WorkspaceSessionPlan;
  auth: AuthContext;
  supabase: SupabaseClient;
}

/** Cookie-auth access for ILE sessions uploading proof of work (no Teams gate). */
export async function requireSessionWorkspaceProofOfWorkAccess(
  workspaceId: string,
  sessionId?: string | null,
): Promise<SessionWorkspaceProofOfWorkAccess | NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const [{ data: profile }, { data: workspace }] = await Promise.all([
    supabase
      .from("profiles")
      .select("organization_id, is_org_admin, is_admin")
      .eq("id", user.id)
      .single(),
    supabase
      .from("workspaces")
      .select("id, title, root_topic, description, notes, conversion_goal, user_id, organization_id")
      .eq("id", workspaceId)
      .single(),
  ]);

  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  if (workspace.user_id !== user.id) {
    return NextResponse.json(
      { error: "Only the workspace owner can upload proof of work", code: "forbidden" },
      { status: 403 },
    );
  }

  if (sessionId) {
    const { data: session } = await supabase
      .from("sessions")
      .select("id, user_id, metadata")
      .eq("id", sessionId)
      .single();

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    if (session.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const linkedWorkspaceId =
      session.metadata &&
      typeof session.metadata === "object" &&
      typeof (session.metadata as Record<string, unknown>).workspace_id === "string"
        ? String((session.metadata as Record<string, unknown>).workspace_id)
        : null;

    if (linkedWorkspaceId && linkedWorkspaceId !== workspaceId) {
      return NextResponse.json(
        { error: "session_id does not belong to this workspace", code: "forbidden" },
        { status: 403 },
      );
    }
  }

  const auth: AuthContext = {
    user_id: user.id,
    guest_user_id: null,
    organization_id: profile?.organization_id || workspace.organization_id || null,
    is_org_admin: profile?.is_org_admin === true || profile?.is_admin === true,
    key_id: "ui-session",
    scopes: ["workspaces:read", "workspaces:write"],
  };

  return {
    userId: user.id,
    workspace,
    auth,
    supabase: createAdminClient(),
  };
}