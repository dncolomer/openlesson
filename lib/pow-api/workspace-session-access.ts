import type { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveBillingEntity, billingEntityHasApiAccess } from "@/lib/billing-entity";
import {
  resolveIleLinkAccess,
  resolveIleLinkSessionAccess,
} from "@/lib/ile-link-auth";
import { resolveAyclAccess } from "@/lib/aycl-session-auth";
import {
  assertWorkspacePolicy,
  ayclPrincipal,
} from "@/lib/workspace-access-policy";
import type { AuthContext } from "./types";

async function profileHasApiAccess(profile: {
  plan: string | null;
  subscription_status: string | null;
  is_admin: boolean | null;
  organization_id: string | null;
} | null): Promise<boolean> {
  if (!profile) return false;
  if (profile.is_admin === true) return true;

  let org = null;
  if (profile.organization_id) {
    const admin = createAdminClient();
    const { data: orgRow } = await admin
      .from("organizations")
      .select(
        "id, plan, subscription_status, current_period_end, extra_lessons, billing_mode, archived_at"
      )
      .eq("id", profile.organization_id)
      .maybeSingle();
    org = orgRow;
  }

  const entity = resolveBillingEntity(
    {
      plan: (profile.plan || "inactive") as import("@/lib/plans").PlanId,
      is_admin: !!profile.is_admin,
      extra_lessons: 0,
      subscription_status: profile.subscription_status || "inactive",
      current_period_end: null,
      token_tier: null,
      token_validity_expires_at: null,
      organization_id: profile.organization_id,
    },
    org
  );
  return billingEntityHasApiAccess(entity);
}

export interface WorkspaceSessionPlan {
  id: string;
  title: string | null;
  root_topic: string | null;
  description: string | null;
  notes: string | null;
  workspace_goal: string | null;
  user_id: string;
  organization_id: string | null;
  evaluation_mode?: string | null;
  protocol_config?: unknown;
  external_refs?: unknown;
  workspace_kind?: string | null;
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
    return jsonError(401, "Not authenticated", "auth_required");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, subscription_status, is_admin, organization_id, is_org_admin")
    .eq("id", user.id)
    .single();

  const hasApiAccess = await profileHasApiAccess(profile);

  if (!hasApiAccess) {
    return jsonError(
      403,
      "The Proof-of-Work API requires Pro / Teams or API Metered.",
      "api_plan_required",
      { renew_url: "/pricing" },
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
    return jsonError(401, "Not authenticated");
  }

  const [{ data: profile }, { data: plan }] = await Promise.all([
    supabase
      .from("profiles")
      .select("plan, subscription_status, is_admin, organization_id, is_org_admin")
      .eq("id", user.id)
      .single(),
    supabase
      .from("workspaces")
      .select("id, title, root_topic, description, notes, workspace_goal, user_id, organization_id, workspace_kind")
      .eq("id", workspaceId)
      .single(),
  ]);

  if (!plan) {
    return jsonError(404, "Workspace not found");
  }

  if (plan.user_id !== user.id) {
    return jsonError(403, "Only the workspace owner can access integration tools", "forbidden");
  }

  const hasApiAccess = await profileHasApiAccess(profile);

  if (!hasApiAccess) {
    return jsonError(
      403,
      "The Proof-of-Work API requires Pro / Teams or API Metered.",
      "api_plan_required",
      { renew_url: "/pricing" },
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
  /** When PoW is authorized via an ILE guest link token. */
  ileLinkId?: string | null;
}

export type SessionWorkspaceProofOfWorkAccessOptions = {
  /** Private token for shareable ILE guest links (`/ile/session/{token}`). */
  ileToken?: string | null;
  /** AYCL purchase token — scores as the purchase subject, never the owner. */
  ayclToken?: string | null;
  /** URL query params from the share link — param-scoped guest identity. */
  entryQueryParams?: import("@/lib/guest-link-access").EntryQueryParams | null;
};

/**
 * Access for ILE sessions uploading proof of work (no Teams gate).
 * Supports cookie-auth owners and shareable ILE private tokens.
 */
export async function requireSessionWorkspaceProofOfWorkAccess(
  workspaceId: string,
  sessionId?: string | null,
  options?: SessionWorkspaceProofOfWorkAccessOptions,
): Promise<SessionWorkspaceProofOfWorkAccess | NextResponse> {
  const normalizedWorkspaceId = workspaceId.trim();
  if (!normalizedWorkspaceId) {
    return jsonError(400, "workspaceId is required");
  }

  const ayclToken = options?.ayclToken?.trim() || "";
  if (ayclToken) {
    const aycl = await resolveAyclAccess(ayclToken);
    if ("error" in aycl) {
      return jsonError(aycl.status, aycl.error);
    }
    if (aycl.workspaceId !== normalizedWorkspaceId) {
      return jsonError(403, "Forbidden");
    }
    const principal = ayclPrincipal({
      purchaseId: aycl.purchase.id,
      ownerUserId: aycl.ownerUserId,
    });
    const policy = assertWorkspacePolicy({
      principal,
      workspaceOwnerId: aycl.ownerUserId,
      action: "score_performance",
    });
    if (!policy.ok) {
      return jsonError(403, "Forbidden");
    }
    const { data: workspace } = await aycl.supabase
      .from("workspaces")
      .select(
        "id, title, root_topic, description, notes, workspace_goal, user_id, organization_id, evaluation_mode, protocol_config, external_refs",
      )
      .eq("id", normalizedWorkspaceId)
      .single();
    if (!workspace) {
      return jsonError(404, "Workspace not found");
    }
    const auth: AuthContext = {
      user_id: principal.subjectId,
      guest_user_id: null,
      organization_id: workspace.organization_id,
      is_org_admin: false,
      key_id: "aycl-ile-performance",
      scopes: ["workspaces:read"],
    };
    return {
      userId: principal.subjectId,
      workspace,
      auth,
      supabase: aycl.supabase,
    };
  }

  const ileToken = options?.ileToken?.trim() || "";
  if (ileToken) {
    const entryQueryParams = options?.entryQueryParams ?? {};
    const ile = sessionId
      ? await resolveIleLinkSessionAccess(ileToken, sessionId, entryQueryParams)
      : await resolveIleLinkAccess(ileToken, entryQueryParams);
    if ("error" in ile) {
      return jsonError(ile.status, ile.error);
    }
    if (ile.workspaceId !== normalizedWorkspaceId) {
      return jsonError(403, "Forbidden");
    }

    const { data: workspace } = await ile.supabase
      .from("workspaces")
      .select(
        "id, title, root_topic, description, notes, workspace_goal, user_id, organization_id, evaluation_mode, protocol_config, external_refs",
      )
      .eq("id", normalizedWorkspaceId)
      .single();

    if (!workspace) {
      return jsonError(404, "Workspace not found");
    }

    // Guest-link PoW is attributed to guest (or assigned member), never the owner.
    const participantUserId = ile.assignedUserId;
    const participantGuestUserId = ile.assignedUserId ? null : ile.guestUserId;
    if (!participantUserId && !participantGuestUserId) {
      return jsonError(500, "ILE guest participant is not provisioned", "guest_missing");
    }

    const auth: AuthContext = {
      user_id: participantUserId,
      guest_user_id: participantGuestUserId,
      organization_id: workspace.organization_id,
      is_org_admin: false,
      key_id: "ile-link",
      scopes: ["workspaces:read", "workspaces:write"],
    };

    return {
      // Prefer participant user id; fall back to owner only as a non-attribution carrier.
      userId: participantUserId || ile.ownerUserId,
      workspace,
      auth,
      supabase: ile.supabase,
      ileLinkId: ile.linkId,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonError(401, "Not authenticated");
  }

  const [{ data: profile }, { data: workspace }] = await Promise.all([
    supabase
      .from("profiles")
      .select("organization_id, is_org_admin, is_admin")
      .eq("id", user.id)
      .single(),
    supabase
      .from("workspaces")
      .select(
        "id, title, root_topic, description, notes, workspace_goal, user_id, organization_id, is_group, evaluation_mode, protocol_config, external_refs",
      )
      .eq("id", normalizedWorkspaceId)
      .single(),
  ]);

  if (!workspace) {
    return jsonError(404, "Workspace not found");
  }

  const isOwner = workspace.user_id === user.id;
  const isOrgMemberOfGroup =
    workspace.is_group === true &&
    !!workspace.organization_id &&
    profile?.organization_id === workspace.organization_id;

  let sessionRow: { id: string; user_id: string | null; metadata: unknown } | null = null;
  if (sessionId) {
    const { data: session } = await supabase
      .from("sessions")
      .select("id, user_id, metadata")
      .eq("id", sessionId)
      .single();

    if (!session) {
      return jsonError(404, "Session not found");
    }
    sessionRow = session;

    const linkedWorkspaceId =
      session.metadata &&
      typeof session.metadata === "object" &&
      typeof (session.metadata as Record<string, unknown>).workspace_id === "string"
        ? String((session.metadata as Record<string, unknown>).workspace_id)
        : null;

    if (linkedWorkspaceId && linkedWorkspaceId !== normalizedWorkspaceId) {
      return jsonError(403, "session_id does not belong to this workspace", "forbidden");
    }
  }

  const isSessionParticipant = Boolean(sessionRow && sessionRow.user_id === user.id);
  if (!isOwner && !isSessionParticipant && !isOrgMemberOfGroup) {
    return jsonError(
      403,
      "Only the workspace owner, session participant, or group org member can upload proof of work",
      "forbidden",
    );
  }

  // Map UI: always attribute to the signed-in user opening the session.
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

/** Extract ILE private token from a JSON body (ileToken, ile_token, or privateToken). */
export function ileTokenFromPowBody(body: Record<string, unknown>): string | null {
  const raw = body.ileToken ?? body.ile_token ?? body.privateToken ?? body.private_token;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}