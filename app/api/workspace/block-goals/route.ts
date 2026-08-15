/**
 * Block goals CRUD for the block-detail Goals drawer (post-creation only).
 * Read: owner / AYCL / canAccessWorkspaceEval. Write: owner / AYCL only.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { ayclTokenFromBody, requireAuthenticatedUser } from "@/lib/api/require-auth";
import { resolveAyclAccess } from "@/lib/aycl-session-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  canAccessWorkspaceEval,
  resolveEvalPersistenceClientMode,
} from "@/lib/pow-api/evaluation-subject";
import {
  createBlockGoal,
  deleteBlockGoal,
  listBlockGoals,
  updateBlockGoal,
} from "@/lib/pow-api/goals-store";
import type { SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

async function resolveGoalsAccess(
  workspaceId: string,
  ayclToken: string | null,
  mode: "read" | "write",
): Promise<
  | { ok: true; supabase: SupabaseClient }
  | { ok: false; response: NextResponse }
> {
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
    return { ok: true, supabase: aycl.supabase as SupabaseClient };
  }

  const session = await requireAuthenticatedUser();
  if (!session.ok) return session;

  const admin = createAdminClient();
  const { data: plan } = await admin
    .from("workspaces")
    .select("id, user_id, is_group")
    .eq("id", workspaceId)
    .single();

  if (!plan) {
    return {
      ok: false,
      response: jsonError(404, "Workspace not found"),
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
        response: jsonError(403, "Forbidden"),
      };
    }
    return { ok: true, supabase: admin };
  }

  if (resolveEvalPersistenceClientMode(access) === "deny") {
    return {
      ok: false,
      response: jsonError(403, "Forbidden"),
    };
  }

  return { ok: true, supabase: admin };
}

export async function GET(req: NextRequest) {
  try {
    const workspaceId = req.nextUrl.searchParams.get("workspaceId") || "";
    const blockId = req.nextUrl.searchParams.get("blockId") || "";
    if (!workspaceId || !blockId) {
      return jsonError(400, "workspaceId and blockId are required");
    }
    const ayclToken = req.nextUrl.searchParams.get("ayclToken");
    const auth = await resolveGoalsAccess(workspaceId, ayclToken, "read");
    if (!auth.ok) return auth.response;

    const goals = await listBlockGoals(auth.supabase, { workspaceId, blockId });
    return NextResponse.json({ block_goals: goals });
  } catch (error) {
    console.error("[workspace/block-goals GET]", error);
    return jsonError(500, "Internal server error");
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId : "";
    const blockId = typeof body.blockId === "string" ? body.blockId : "";
    if (!workspaceId || !blockId) {
      return jsonError(400, "workspaceId and blockId are required");
    }
    const auth = await resolveGoalsAccess(workspaceId, ayclTokenFromBody(body), "write");
    if (!auth.ok) return auth.response;

    // Ensure block exists in workspace (post-creation only).
    const { data: block } = await auth.supabase
      .from("blocks")
      .select("id")
      .eq("id", blockId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (!block) {
      return jsonError(404, "Block not found");
    }

    const result = await createBlockGoal(auth.supabase, {
      workspaceId,
      blockId,
      text: typeof body.text === "string" ? body.text : "",
      sortOrder: typeof body.sort_order === "number" ? body.sort_order : undefined,
    });
    if (!result.row) {
      return jsonError(400, result.error || "Failed to create goal");
    }
    return NextResponse.json({ goal: result.row, success: true });
  } catch (error) {
    console.error("[workspace/block-goals POST]", error);
    return jsonError(500, "Internal server error");
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId : "";
    const goalId =
      typeof body.goalId === "string"
        ? body.goalId
        : typeof body.id === "string"
          ? body.id
          : "";
    if (!workspaceId || !goalId) {
      return jsonError(400, "workspaceId and goalId are required");
    }
    const auth = await resolveGoalsAccess(workspaceId, ayclTokenFromBody(body), "write");
    if (!auth.ok) return auth.response;

    const result = await updateBlockGoal(auth.supabase, {
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
    console.error("[workspace/block-goals PUT]", error);
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

    const result = await deleteBlockGoal(auth.supabase, { workspaceId, goalId });
    if (!result.ok) {
      return jsonError(400, result.error || "Failed to delete goal");
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[workspace/block-goals DELETE]", error);
    return jsonError(500, "Internal server error");
  }
}
