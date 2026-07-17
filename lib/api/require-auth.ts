import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { resolveAyclAccess, resolveAyclSessionAccess } from "@/lib/aycl-session-auth";
import { requireProductAccess } from "@/lib/api/product-access";

export type AuthenticatedRequest =
  | { ok: true; user: User; supabase: SupabaseClient; ayclAccess?: boolean }
  | { ok: false; response: NextResponse };

export function ayclTokenFromBody(body: Record<string, unknown>): string | null {
  const raw = body.ayclToken ?? body.aycl_token;
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
      response: NextResponse.json({ error: "Not authenticated" }, { status: 401 }),
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
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (session.user_id !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return null;
}

async function enforceProductAccessUnlessAycl(
  auth: Extract<AuthenticatedRequest, { ok: true }>
): Promise<AuthenticatedRequest> {
  if (auth.ayclAccess) return auth;
  const access = await requireProductAccess(auth.supabase, auth.user);
  if (!access.ok) return { ok: false, response: access.response };
  return auth;
}

/** Auth for workspace-scoped routes (builder, performance, notes, grid). */
export async function guardWorkspaceRoute(
  workspaceId: string,
  options?: { ayclToken?: string | null; requireProductAccess?: boolean }
): Promise<AuthenticatedRequest> {
  const normalizedWorkspaceId = workspaceId.trim();
  if (!normalizedWorkspaceId) {
    return {
      ok: false,
      response: NextResponse.json({ error: "workspaceId is required" }, { status: 400 }),
    };
  }

  const ayclToken = options?.ayclToken?.trim() || "";
  if (ayclToken) {
    const aycl = await resolveAyclAccess(ayclToken);
    if ("error" in aycl) {
      return {
        ok: false,
        response: NextResponse.json({ error: aycl.error }, { status: aycl.status }),
      };
    }
    if (aycl.workspaceId !== normalizedWorkspaceId) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      };
    }
    return {
      ok: true,
      user: aycl.actingUser as User,
      supabase: aycl.supabase,
      ayclAccess: true,
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
      response: NextResponse.json({ error: "Workspace not found" }, { status: 404 }),
    };
  }

  if (workspace.user_id !== auth.user.id) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  if (options?.requireProductAccess !== false) {
    return enforceProductAccessUnlessAycl(auth);
  }

  return auth;
}

export type GuardSessionOptions = {
  ayclToken?: string | null;
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
  const requireProduct = options?.requireProductAccess !== false;

  if (ayclToken && sessionId) {
    const aycl = await resolveAyclSessionAccess(ayclToken, sessionId);
    if ("error" in aycl) {
      return {
        ok: false,
        response: NextResponse.json({ error: aycl.error }, { status: aycl.status }),
      };
    }

    return {
      ok: true,
      user: aycl.actingUser as User,
      supabase: aycl.supabase,
      ayclAccess: true,
    };
  }

  const auth = await requireAuthenticatedUser();
  if (!auth.ok) return auth;

  if (options?.requireSessionId && !sessionId) {
    return {
      ok: false,
      response: NextResponse.json({ error: "sessionId is required" }, { status: 400 }),
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
