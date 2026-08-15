/**
 * Product-workspace auth for UI routes that are not owner-only
 * (org-admin guest links, eval-member snapshots).
 */

import type { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import { resolveAyclAccess } from "@/lib/aycl-session-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  canAccessWorkspaceEval,
  resolveEvalPersistenceClientMode,
} from "@/lib/pow-api/evaluation-subject";
import type { AuthContext, ApiKeyScope } from "@/lib/pow-api/types";

export type ProductWorkspaceAuthFlags = {
  allowOrgAdmin: boolean;
  allowEvalMember: boolean;
  ayclAsOwner: boolean;
};

export const PRODUCT_AUTH_OWNER_OR_ORG_ADMIN: ProductWorkspaceAuthFlags = {
  allowOrgAdmin: true,
  allowEvalMember: false,
  ayclAsOwner: false,
};

export const PRODUCT_AUTH_EVAL_MEMBER_AYCL_OWNER: ProductWorkspaceAuthFlags = {
  allowOrgAdmin: false,
  allowEvalMember: true,
  ayclAsOwner: true,
};

export function resolveProductWorkspaceAuthMode(input: {
  isOwner: boolean;
  isOrgAdmin: boolean;
  evalAllowed: boolean;
  flags: ProductWorkspaceAuthFlags;
}): "ok" | "deny" {
  if (input.isOwner) return "ok";
  if (input.flags.allowOrgAdmin && input.isOrgAdmin) return "ok";
  if (input.flags.allowEvalMember && input.evalAllowed) return "ok";
  return "deny";
}

export function productWorkspaceAuthIsOwner(input: {
  cookieIsOwner: boolean;
  ayclAccess: boolean;
  flags: ProductWorkspaceAuthFlags;
}): boolean {
  if (input.ayclAccess && input.flags.ayclAsOwner) return true;
  return input.cookieIsOwner;
}

export function decideProductWorkspaceAccess(input: {
  isOwner: boolean;
  isOrgAdmin: boolean;
  evalAllowed: boolean;
  ayclAccess: boolean;
  flags: ProductWorkspaceAuthFlags;
}): { allowed: boolean; isOwner: boolean } {
  const isOwner = productWorkspaceAuthIsOwner({
    cookieIsOwner: input.isOwner,
    ayclAccess: input.ayclAccess,
    flags: input.flags,
  });
  const mode = resolveProductWorkspaceAuthMode({
    isOwner: input.isOwner,
    isOrgAdmin: input.isOrgAdmin,
    evalAllowed: input.evalAllowed,
    flags: input.flags,
  });
  return { allowed: mode === "ok" || isOwner, isOwner };
}

export type ProductWorkspaceLinkAuth =
  | { ok: true; auth: AuthContext; supabase: ReturnType<typeof createAdminClient>; isOwner: boolean }
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

  const decided = decideProductWorkspaceAccess({
    isOwner,
    isOrgAdmin,
    evalAllowed: false,
    ayclAccess: false,
    flags: PRODUCT_AUTH_OWNER_OR_ORG_ADMIN,
  });
  if (!decided.allowed) {
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
  };
}

export type ProductWorkspaceEvalAuth =
  | { ok: true; user: User; supabase: SupabaseClient; ayclAccess?: boolean; isOwner: boolean }
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
    return {
      ok: true,
      user: aycl.actingUser as User,
      supabase: aycl.supabase,
      ayclAccess: true,
      isOwner: true,
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
  const decided = decideProductWorkspaceAccess({
    isOwner: access.isOwner,
    isOrgAdmin: false,
    evalAllowed: resolveEvalPersistenceClientMode(access) !== "deny",
    ayclAccess: false,
    flags: PRODUCT_AUTH_EVAL_MEMBER_AYCL_OWNER,
  });
  if (!decided.allowed) {
    return {
      ok: false,
      response: jsonError(403, "Forbidden"),
    };
  }

  return {
    ok: true,
    user: session.user,
    supabase: admin,
    isOwner: access.isOwner,
  };
}
