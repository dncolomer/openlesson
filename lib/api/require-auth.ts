import type { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { jsonError } from "@/lib/api-error-envelope";
import { createClient } from "@/lib/supabase/server";
import { resolveAyclAccess, resolveAyclSessionAccess } from "@/lib/aycl-session-auth";
import { resolveIleLinkAccess, resolveIleLinkSessionAccess } from "@/lib/ile-link-auth";
import { requireProductAccess } from "@/lib/api/product-access";
import type { AyclCapabilities } from "@/lib/aycl-shared";
import {
  ayclPrincipal,
  cookieUserPrincipal,
  ileGuestPrincipal,
  persistableOwnerUserId,
  type WorkspacePrincipal,
} from "@/lib/workspace-access-policy";

export type AuthenticatedRequest =
  | {
      ok: true;
      principal: WorkspacePrincipal;
      /** Attribution subject — may be aycl:{purchaseId} or a guest id. */
      subjectId: string;
      /** auth.users FK only — never a token subject. */
      persistUserId: string;
      supabase: SupabaseClient;
      ayclCapabilities?: AyclCapabilities;
      guestUserId?: string | null;
    }
  | { ok: false; response: NextResponse };

export function authSubjectId(
  auth: Extract<AuthenticatedRequest, { ok: true }>,
): string {
  return auth.subjectId;
}

export function ayclTokenFromBody(body: Record<string, unknown>): string | null {
  const raw = body.ayclToken ?? body.aycl_token;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

export function ileTokenFromBody(body: Record<string, unknown>): string | null {
  const raw = body.ileToken ?? body.ile_token;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

export type CookieAuthenticatedRequest =
  | {
      ok: true;
      user: User;
      principal: WorkspacePrincipal;
      subjectId: string;
      persistUserId: string;
      supabase: SupabaseClient;
    }
  | { ok: false; response: NextResponse };

export async function requireAuthenticatedUser(): Promise<CookieAuthenticatedRequest> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      ok: false,
      response: jsonError(401, "Not authenticated"),
    };
  }

  return {
    ok: true,
    user,
    principal: cookieUserPrincipal(user.id),
    subjectId: user.id,
    persistUserId: user.id,
    supabase,
  };
}

function persistIds(
  principal: WorkspacePrincipal,
): { subjectId: string; persistUserId: string } | { error: "persist_missing" } {
  const persistUserId = persistableOwnerUserId(principal);
  if (!persistUserId) return { error: "persist_missing" };
  return { subjectId: principal.subjectId, persistUserId };
}

export async function requireSessionOwnership(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string
): Promise<NextResponse | null> {
  const { data: session, error } = await supabase
    .from("sessions")
    .select("id, user_id")
    .eq("id", sessionId)
    .single();

  if (error || !session) {
    return jsonError(404, "Session not found");
  }

  if (session.user_id !== userId) {
    return jsonError(403, "Forbidden");
  }

  return null;
}

async function enforceProductAccessUnlessAycl(
  auth: Extract<AuthenticatedRequest, { ok: true }>,
  cookieUser?: User,
): Promise<AuthenticatedRequest> {
  if (auth.principal.kind !== "cookie_user") return auth;
  if (!cookieUser) return auth;
  const access = await requireProductAccess(auth.supabase, cookieUser);
  if (!access.ok) return { ok: false, response: access.response };
  return auth;
}

/** Auth for workspace-scoped routes (builder, performance, notes, grid). */
export async function guardWorkspaceRoute(
  workspaceId: string,
  options?: {
    ayclToken?: string | null;
    ileToken?: string | null;
    requireProductAccess?: boolean;
    /** When true, AYCL practice-only tier is rejected (creation / grow). */
    requireAyclAuthoring?: boolean;
  }
): Promise<AuthenticatedRequest> {
  const normalizedWorkspaceId = workspaceId.trim();
  if (!normalizedWorkspaceId) {
    return {
      ok: false,
      response: jsonError(400, "workspaceId is required"),
    };
  }

  const ayclToken = options?.ayclToken?.trim() || "";
  if (ayclToken) {
    const aycl = await resolveAyclAccess(ayclToken);
    if ("error" in aycl) {
      return {
        ok: false,
        response: jsonError(aycl.status, aycl.error),
      };
    }
    if (aycl.workspaceId !== normalizedWorkspaceId) {
      return {
        ok: false,
        response: jsonError(403, "Forbidden"),
      };
    }
    if (options?.requireAyclAuthoring && !aycl.capabilities.canAuthor) {
      return {
        ok: false,
        response: jsonError(
          403,
          "This access does not include creation tools. Upgrade to unlock creation on this workspace.",
          "aycl_authoring_required",
          { accessTier: aycl.accessTier },
        ),
      };
    }
    const principal = ayclPrincipal({
      purchaseId: aycl.purchase.id,
      ownerUserId: aycl.ownerUserId,
    });
    const ids = persistIds(principal);
    if ("error" in ids) {
      return { ok: false, response: jsonError(500, "Workspace owner is missing") };
    }
    return {
      ok: true,
      principal,
      subjectId: ids.subjectId,
      persistUserId: ids.persistUserId,
      supabase: aycl.supabase,
      ayclCapabilities: aycl.capabilities,
    };
  }

  const ileToken = options?.ileToken?.trim() || "";
  if (ileToken) {
    const ile = await resolveIleLinkAccess(ileToken);
    if ("error" in ile) {
      return {
        ok: false,
        response: jsonError(ile.status, ile.error),
      };
    }
    if (ile.workspaceId !== normalizedWorkspaceId) {
      return {
        ok: false,
        response: jsonError(403, "Forbidden"),
      };
    }
    const principal = ileGuestPrincipal({
      assignedUserId: ile.assignedUserId,
      guestUserId: ile.guestUserId,
      ownerUserId: ile.ownerUserId,
    });
    if ("error" in principal) {
      return {
        ok: false,
        response: jsonError(500, "ILE guest participant is not provisioned", "guest_missing"),
      };
    }
    const ids = persistIds(principal);
    if ("error" in ids) {
      return { ok: false, response: jsonError(500, "Workspace owner is missing") };
    }
    return {
      ok: true,
      principal,
      subjectId: ids.subjectId,
      persistUserId: ids.persistUserId,
      supabase: ile.supabase,
      guestUserId: principal.guestUserId ?? null,
    };
  }

  const auth = await requireAuthenticatedUser();
  if (!auth.ok) return auth;

  const { data: workspace, error } = await auth.supabase
    .from("workspaces")
    .select("id, user_id")
    .eq("id", normalizedWorkspaceId)
    .single();

  if (error || !workspace) {
    return {
      ok: false,
      response: jsonError(404, "Workspace not found"),
    };
  }

  if (workspace.user_id !== auth.user.id) {
    return {
      ok: false,
      response: jsonError(403, "Forbidden"),
    };
  }

  const stripped = stripCookieAuth(auth);
  if (options?.requireProductAccess !== false) {
    return enforceProductAccessUnlessAycl(stripped, auth.user);
  }

  return stripped;
}

export type GuardSessionOptions = {
  ayclToken?: string | null;
  ileToken?: string | null;
  /** When true, sessionId must be present for non-AYCL auth. Default false for back-compat. */
  requireSessionId?: boolean;
  /** Enforce product entitlement for cookie-auth users. Default true. */
  requireProductAccess?: boolean;
};

/** Auth + optional session ownership for LLM/session API routes. */
export async function guardSessionRoute(
  sessionId?: string | null,
  options?: GuardSessionOptions
): Promise<AuthenticatedRequest> {
  const ayclToken = options?.ayclToken?.trim() || "";
  const ileToken = options?.ileToken?.trim() || "";
  const requireProduct = options?.requireProductAccess !== false;

  if (ayclToken && sessionId) {
    const aycl = await resolveAyclSessionAccess(ayclToken, sessionId);
    if ("error" in aycl) {
      return {
        ok: false,
        response: jsonError(aycl.status, aycl.error),
      };
    }

    const principal = ayclPrincipal({
      purchaseId: aycl.purchase.id,
      ownerUserId: aycl.ownerUserId,
    });
    const ids = persistIds(principal);
    if ("error" in ids) {
      return { ok: false, response: jsonError(500, "Workspace owner is missing") };
    }
    return {
      ok: true,
      principal,
      subjectId: ids.subjectId,
      persistUserId: ids.persistUserId,
      supabase: aycl.supabase,
    };
  }

  if (ileToken && sessionId) {
    const ile = await resolveIleLinkSessionAccess(ileToken, sessionId);
    if ("error" in ile) {
      return {
        ok: false,
        response: jsonError(ile.status, ile.error),
      };
    }

    const principal = ileGuestPrincipal({
      assignedUserId: ile.assignedUserId,
      guestUserId: ile.guestUserId,
      ownerUserId: ile.ownerUserId,
    });
    if ("error" in principal) {
      return {
        ok: false,
        response: jsonError(500, "ILE guest participant is not provisioned", "guest_missing"),
      };
    }
    const ids = persistIds(principal);
    if ("error" in ids) {
      return { ok: false, response: jsonError(500, "Workspace owner is missing") };
    }
    return {
      ok: true,
      principal,
      subjectId: ids.subjectId,
      persistUserId: ids.persistUserId,
      supabase: ile.supabase,
      guestUserId: principal.guestUserId ?? null,
    };
  }

  const auth = await requireAuthenticatedUser();
  if (!auth.ok) return auth;

  if (options?.requireSessionId && !sessionId) {
    return {
      ok: false,
      response: jsonError(400, "sessionId is required"),
    };
  }

  if (sessionId) {
    const denied = await requireSessionOwnership(auth.supabase, auth.user.id, sessionId);
    if (denied) {
      return { ok: false, response: denied };
    }
  }

  const stripped = stripCookieAuth(auth);
  if (requireProduct) {
    return enforceProductAccessUnlessAycl(stripped, auth.user);
  }

  return stripped;
}

/**
 * Authenticated user with product access (for routes without session/workspace binding).
 * Prefer guardSessionRoute / guardWorkspaceRoute when a resource id is available.
 */
export async function requireAuthenticatedProductUser(): Promise<AuthenticatedRequest> {
  const auth = await requireAuthenticatedUser();
  if (!auth.ok) return auth;
  return enforceProductAccessUnlessAycl(stripCookieAuth(auth), auth.user);
}

function stripCookieAuth(
  auth: Extract<CookieAuthenticatedRequest, { ok: true }>,
): Extract<AuthenticatedRequest, { ok: true }> {
  return {
    ok: true,
    principal: auth.principal,
    subjectId: auth.subjectId,
    persistUserId: auth.persistUserId,
    supabase: auth.supabase,
  };
}
