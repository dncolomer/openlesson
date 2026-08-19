/**
 * Product-workspace auth for UI routes that are not owner-only
 * (org-admin guest links, eval-member snapshots).
 */

import type { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import { resolveAyclAccess } from "@/lib/aycl-session-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  canAccessWorkspaceEval,
  resolveEvalPersistenceClientMode,
} from "@/lib/pow-api/evaluation-subject";
import type { AuthContext, ApiKeyScope } from "@/lib/pow-api/types";
import {
  allowProductWorkspaceEvalAccess,
  allowProductWorkspaceLinkAccess,
  assertWorkspacePolicy,
  ayclPrincipal,
  cookieUserPrincipal,
  type WorkspacePrincipal,
} from "@/lib/workspace-access-policy";

export {
  allowProductWorkspaceEvalAccess,
  allowProductWorkspaceLinkAccess,
};

export type ProductWorkspaceLinkAuth =
  | {
      ok: true;
      auth: AuthContext;
      supabase: ReturnType<typeof createAdminClient>;
      isOwner: boolean;
      principal: WorkspacePrincipal;
      subjectId: string;
      persistUserId: string;
    }
  | { ok: false; response: NextResponse };

/** Cookie owner or org-admin of the workspace. Used by TAP/ILE/portal link routes. */
export async function requireProductWorkspaceLinkAuth(
  workspaceId: string,
  scopes: ApiKeyScope[],
): Promise<ProductWorkspaceLinkAuth> {
  const auth = await requireAuthenticatedUser();
  if (!auth.ok) return auth;

  const { user, supabase } = auth;

  const admin = createAdminClient();
  const { data: workspace } = await admin
    .from("workspaces")
    .select("id, user_id, organization_id")
    .eq("id", workspaceId)
    .single();

  if (!workspace) {
    return { ok: false, response: jsonError(404, "Workspace not found") };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, is_org_admin")
    .eq("id", user.id)
    .maybeSingle();

  const isOwner = workspace.user_id === user.id;
  const isOrgAdmin =
    !!profile?.is_org_admin &&
    !!profile.organization_id &&
    profile.organization_id === workspace.organization_id;

  const principal = cookieUserPrincipal(user.id, {
    organizationId: profile?.organization_id || workspace.organization_id,
    isOrgAdmin,
  });
  const policy = assertWorkspacePolicy({
    principal,
    workspaceOwnerId: workspace.user_id,
    workspaceOrgId: workspace.organization_id,
    action: "link_admin",
  });
  if (!policy.ok) {
    return { ok: false, response: jsonError(403, "Not authorized") };
  }

  return {
    ok: true,
    auth: {
      user_id: user.id,
      guest_user_id: null,
      organization_id: profile?.organization_id || workspace.organization_id,
      is_org_admin: isOrgAdmin,
      key_id: "web",
      scopes,
    },
    supabase: admin,
    isOwner,
    principal,
    subjectId: principal.subjectId,
    persistUserId: user.id,
  };
}

export type ProductWorkspaceEvalAuth =
  | {
      ok: true;
      supabase: SupabaseClient;
      isOwner: boolean;
      principal: WorkspacePrincipal;
      subjectId: string;
      persistUserId: string;
      workspaceOwnerId: string;
    }
  | { ok: false; response: NextResponse };

/** Eval-member / AYCL-as-owner for knowledge-config and snapshot-history. */
export async function requireProductWorkspaceEvalAuth(
  workspaceId: string,
  ayclToken?: string | null,
): Promise<ProductWorkspaceEvalAuth> {
  if (ayclToken) {
    const aycl = await resolveAyclAccess(ayclToken);
    if ("error" in aycl) {
      return {
        ok: false,
        response: jsonError(aycl.status, aycl.error),
      };
    }
    if (aycl.workspaceId !== workspaceId) {
      return {
        ok: false,
        response: jsonError(403, "Forbidden"),
      };
    }
    const principal = ayclPrincipal({
      purchaseId: aycl.purchase.id,
      ownerUserId: aycl.ownerUserId,
    });
    const policy = assertWorkspacePolicy({
      principal,
      workspaceOwnerId: aycl.ownerUserId,
      action: "eval",
    });
    if (!policy.ok) {
      return {
        ok: false,
        response: jsonError(403, "Forbidden"),
      };
    }
    return {
      ok: true,
      supabase: aycl.supabase,
      isOwner: false,
      principal,
      subjectId: principal.subjectId,
      persistUserId: aycl.ownerUserId,
      workspaceOwnerId: aycl.ownerUserId,
    };
  }

  const session = await requireAuthenticatedUser();
  if (!session.ok) return session;

  const admin = createAdminClient();
  const { data: workspace } = await admin
    .from("workspaces")
    .select("id, user_id, is_group")
    .eq("id", workspaceId)
    .single();

  if (!workspace) {
    return {
      ok: false,
      response: jsonError(404, "Workspace not found"),
    };
  }

  const access = canAccessWorkspaceEval({
    callerUserId: session.user.id,
    workspaceOwnerId: workspace.user_id,
    isGroup: Boolean(workspace.is_group),
  });
  const evalAllowed = resolveEvalPersistenceClientMode(access) !== "deny";
  const principal = cookieUserPrincipal(session.user.id);
  const policy = assertWorkspacePolicy({
    principal,
    workspaceOwnerId: workspace.user_id,
    evalAllowed,
    action: "eval",
  });
  if (!policy.ok) {
    return {
      ok: false,
      response: jsonError(403, "Forbidden"),
    };
  }

  return {
    ok: true,
    supabase: admin,
    isOwner: access.isOwner,
    principal,
    subjectId: principal.subjectId,
    persistUserId: session.user.id,
    workspaceOwnerId: workspace.user_id,
  };
}
