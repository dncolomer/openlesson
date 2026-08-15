import type { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { jsonError } from "@/lib/api-error-envelope";
import { createClient } from "@/lib/supabase/server";
import { resolveAyclAccess, resolveAyclSessionAccess } from "@/lib/aycl-session-auth";
import { resolveIleLinkAccess, resolveIleLinkSessionAccess } from "@/lib/ile-link-auth";
import { requireProductAccess } from "@/lib/api/product-access";
import type { AyclCapabilities } from "@/lib/aycl-shared";

export type AuthenticatedRequest =
  | {
      ok: true;
      user: User;
      supabase: SupabaseClient;
      ayclAccess?: boolean;
      ileAccess?: boolean;
      ayclCapabilities?: AyclCapabilities;
      guestUserId?: string | null;
    }
  | { ok: false; response: NextResponse };

export function ayclTokenFromBody(body: Record<string, unknown>): string | null {
  const raw = body.ayclToken ?? body.aycl_token;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

export function ileTokenFromBody(body: Record<string, unknown>): string | null {
  const raw = body.ileToken ?? body.ile_token;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

export async function requireAuthenticatedUser(): Promise<AuthenticatedRequest> {
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

  return { ok: true, user, supabase };
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
  auth: Extract<AuthenticatedRequest, { ok: true }>
): Promise<AuthenticatedRequest> {
  if (auth.ayclAccess || auth.ileAccess) return auth;
  const access = await requireProductAccess(auth.supabase, auth.user);
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
    return {
      ok: true,
      user: aycl.actingUser as User,
      supabase: aycl.supabase,
      ayclAccess: true,
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
    return {
      ok: true,
      user: ile.actingUser as User,
      supabase: ile.supabase,
      ileAccess: true,
      guestUserId: ile.assignedUserId ? null : ile.guestUserId,
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

  if (options?.requireProductAccess !== false) {
    return enforceProductAccessUnlessAycl(auth);
  }

  return auth;
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

    return {
      ok: true,
      user: aycl.actingUser as User,
      supabase: aycl.supabase,
      ayclAccess: true,
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

    return {
      ok: true,
      user: ile.actingUser as User,
      supabase: ile.supabase,
      ileAccess: true,
      guestUserId: ile.assignedUserId ? null : ile.guestUserId,
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

  if (requireProduct) {
    return enforceProductAccessUnlessAycl(auth);
  }

  return auth;
}

/**
 * Authenticated user with product access (for routes without session/workspace binding).
 * Prefer guardSessionRoute / guardWorkspaceRoute when a resource id is available.
 */
export async function requireAuthenticatedProductUser(): Promise<AuthenticatedRequest> {
  const auth = await requireAuthenticatedUser();
  if (!auth.ok) return auth;
  return enforceProductAccessUnlessAycl(auth);
}
