/**
 * Workspace goals CRUD for the Goals tab.
 * GET  — list workspace goals (+ optional block goals when blockId query)
 * POST — create workspace goal
 * PUT  — update workspace goal by id
 * DELETE — delete workspace goal by id (query or body)
 *
 * Read access: workspace owner, AYCL token, or canAccessWorkspaceEval.
 * Write access: owner or AYCL only.
 */
import { NextRequest, NextResponse } from "next/server";
import { ayclTokenFromBody, requireAuthenticatedUser } from "@/lib/api/require-auth";
import { resolveAyclAccess } from "@/lib/aycl-session-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  canAccessWorkspaceEval,
  resolveEvalPersistenceClientMode,
} from "@/lib/pow-api/evaluation-subject";
import {
  createWorkspaceGoal,
  deleteWorkspaceGoal,
  listBlockGoals,
  listWorkspaceGoals,
  updateWorkspaceGoal,
} from "@/lib/pow-api/goals-store";
import type { SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

async function resolveGoalsAccess(
  workspaceId: string,
  ayclToken: string | null,
  mode: "read" | "write",
): Promise<
  | { ok: true; supabase: SupabaseClient; userId: string; isOwner: boolean }
  | { ok: false; response: NextResponse }
> {
  if (ayclToken) {
    const aycl = await resolveAyclAccess(ayclToken);
    if ("error" in aycl) {
      return {
        ok: false,
        response: NextResponse.json({ error: aycl.error }, { status: aycl.status }),
      };
    }
    if (aycl.workspaceId !== workspaceId) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      };
    }
    return {
      ok: true,
      supabase: aycl.supabase as SupabaseClient,
      userId: aycl.actingUser.id,
      isOwner: true,
    };
  }

  const session = await requireAuthenticatedUser();
  if (!session.ok) return session;

  const admin = createAdminClient();
  const { data: plan } = await admin
    .from("workspaces")
    .select("id, user_id, is_group, is_public")
    .eq("id", workspaceId)
    .single();

  if (!plan) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Workspace not found" }, { status: 404 }),
    };
  }

  const access = canAccessWorkspaceEval({
    callerUserId: session.user.id,
    workspaceOwnerId: plan.user_id,
    isGroup: Boolean(plan.is_group),
  });

  if (mode === "write") {
    if (!access.isOwner) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      };
    }
    return {
      ok: true,
      supabase: admin,
      userId: session.user.id,
      isOwner: true,
    };
  }

  // Read: owner/eval access only — never open private goal text to any authenticated user.
  if (resolveEvalPersistenceClientMode(access) === "deny") {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return {
    ok: true,
    supabase: admin,
    userId: session.user.id,
    isOwner: access.isOwner,
  };
}

export async function GET(req: NextRequest) {
  try {
    const workspaceId = req.nextUrl.searchParams.get("workspaceId") || "";
    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
    }
    const ayclToken = req.nextUrl.searchParams.get("ayclToken");
    const auth = await resolveGoalsAccess(workspaceId, ayclToken, "read");
    if (!auth.ok) return auth.response;

    const goals = await listWorkspaceGoals(auth.supabase, workspaceId);
    const blockId = req.nextUrl.searchParams.get("blockId");
    const blockGoals = await listBlockGoals(auth.supabase, {
      workspaceId,
      blockId: blockId || null,
    });
    return NextResponse.json({
      workspace_goals: goals,
      block_goals: blockGoals,
    });
  } catch (error) {
    console.error("[workspace/goals GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId : "";
    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
    }
    const auth = await resolveGoalsAccess(workspaceId, ayclTokenFromBody(body), "write");
    if (!auth.ok) return auth.response;

    const result = await createWorkspaceGoal(auth.supabase, {
      workspaceId,
      text: typeof body.text === "string" ? body.text : "",
      sortOrder: typeof body.sort_order === "number" ? body.sort_order : undefined,
    });
    if (!result.row) {
      return NextResponse.json({ error: result.error || "Failed to create goal" }, { status: 400 });
    }
    return NextResponse.json({ goal: result.row, success: true });
  } catch (error) {
    console.error("[workspace/goals POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId : "";
    const goalId = typeof body.goalId === "string" ? body.goalId : typeof body.id === "string" ? body.id : "";
    if (!workspaceId || !goalId) {
      return NextResponse.json({ error: "workspaceId and goalId are required" }, { status: 400 });
    }
    const auth = await resolveGoalsAccess(workspaceId, ayclTokenFromBody(body), "write");
    if (!auth.ok) return auth.response;

    const result = await updateWorkspaceGoal(auth.supabase, {
      workspaceId,
      goalId,
      text: typeof body.text === "string" ? body.text : undefined,
      sortOrder: typeof body.sort_order === "number" ? body.sort_order : undefined,
    });
    if (!result.row) {
      return NextResponse.json({ error: result.error || "Failed to update goal" }, { status: 400 });
    }
    return NextResponse.json({ goal: result.row, success: true });
  } catch (error) {
    console.error("[workspace/goals PUT]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    let workspaceId = req.nextUrl.searchParams.get("workspaceId") || "";
    let goalId = req.nextUrl.searchParams.get("goalId") || "";
    let ayclToken: string | null = req.nextUrl.searchParams.get("ayclToken");
    if (!workspaceId || !goalId) {
      const body = await req.json().catch(() => ({}));
      workspaceId =
        workspaceId || (typeof body.workspaceId === "string" ? body.workspaceId : "");
      goalId = goalId || (typeof body.goalId === "string" ? body.goalId : "");
      ayclToken = ayclToken || ayclTokenFromBody(body);
    }
    if (!workspaceId || !goalId) {
      return NextResponse.json({ error: "workspaceId and goalId are required" }, { status: 400 });
    }
    const auth = await resolveGoalsAccess(workspaceId, ayclToken, "write");
    if (!auth.ok) return auth.response;

    const result = await deleteWorkspaceGoal(auth.supabase, { workspaceId, goalId });
    if (!result.ok) {
      return NextResponse.json({ error: result.error || "Failed to delete goal" }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[workspace/goals DELETE]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
