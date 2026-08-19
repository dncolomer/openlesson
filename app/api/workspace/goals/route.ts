/**
 * Workspace goals CRUD for the Goals tab.
 * GET  — list workspace goals (+ optional block goals when blockId query)
 * POST — create workspace goal
 * PUT  — update workspace goal by id
 * DELETE — delete workspace goal by id (query or body)
 *
 * Read access: workspace owner, AYCL purchase subject, or eval member.
 * Write access: policy action "author" (owner, or AYCL unless canAuthor is false).
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { ayclTokenFromBody } from "@/lib/api/require-auth";
import {
  createWorkspaceGoal,
  deleteWorkspaceGoal,
  listBlockGoals,
  listWorkspaceGoals,
  updateWorkspaceGoal,
} from "@/lib/pow-api/goals-store";
import { requireProductWorkspaceEvalAuth } from "@/lib/product-workspace-auth";
import { assertWorkspacePolicy } from "@/lib/workspace-access-policy";
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
  const auth = await requireProductWorkspaceEvalAuth(workspaceId, ayclToken);
  if (!auth.ok) return auth;

  if (mode === "write") {
    const policy = assertWorkspacePolicy({
      principal: auth.principal,
      workspaceOwnerId: auth.workspaceOwnerId,
      action: "author",
    });
    if (!policy.ok) {
      return {
        ok: false,
        response: jsonError(403, "Forbidden"),
      };
    }
  }

  return {
    ok: true,
    supabase: auth.supabase,
    userId: auth.subjectId,
    isOwner: auth.isOwner,
  };
}

export async function GET(req: NextRequest) {
  try {
    const workspaceId = req.nextUrl.searchParams.get("workspaceId") || "";
    if (!workspaceId) {
      return jsonError(400, "workspaceId is required");
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
    return jsonError(500, "Internal server error");
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId : "";
    if (!workspaceId) {
      return jsonError(400, "workspaceId is required");
    }
    const auth = await resolveGoalsAccess(workspaceId, ayclTokenFromBody(body), "write");
    if (!auth.ok) return auth.response;

    const result = await createWorkspaceGoal(auth.supabase, {
      workspaceId,
      text: typeof body.text === "string" ? body.text : "",
      sortOrder: typeof body.sort_order === "number" ? body.sort_order : undefined,
    });
    if (!result.row) {
      return jsonError(400, result.error || "Failed to create goal");
    }
    return NextResponse.json({ goal: result.row, success: true });
  } catch (error) {
    console.error("[workspace/goals POST]", error);
    return jsonError(500, "Internal server error");
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId : "";
    const goalId = typeof body.goalId === "string" ? body.goalId : typeof body.id === "string" ? body.id : "";
    if (!workspaceId || !goalId) {
      return jsonError(400, "workspaceId and goalId are required");
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
      return jsonError(400, result.error || "Failed to update goal");
    }
    return NextResponse.json({ goal: result.row, success: true });
  } catch (error) {
    console.error("[workspace/goals PUT]", error);
    return jsonError(500, "Internal server error");
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
      return jsonError(400, "workspaceId and goalId are required");
    }
    const auth = await resolveGoalsAccess(workspaceId, ayclToken, "write");
    if (!auth.ok) return auth.response;

    const result = await deleteWorkspaceGoal(auth.supabase, { workspaceId, goalId });
    if (!result.ok) {
      return jsonError(400, result.error || "Failed to delete goal");
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[workspace/goals DELETE]", error);
    return jsonError(500, "Internal server error");
  }
}
