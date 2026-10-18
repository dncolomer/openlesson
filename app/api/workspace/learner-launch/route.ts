import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { rejectIfFreeWeeklySessionLimit } from "@/lib/api/free-session-quota";
import { loadProductAccessSnapshot } from "@/lib/api/product-access";
import { ayclTokenFromBody, ileTokenFromBody, guardWorkspaceRoute } from "@/lib/api/require-auth";
import { isPaidOnlyWorkspaceKind } from "@/lib/free-tier";
import { buildLearnerLaunchBody } from "@/lib/workspace-learner-writes";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const payload = buildLearnerLaunchBody({
      workspaceId: String(body.workspaceId || ""),
      blockId: String(body.blockId || ""),
      sessionMode: body.sessionMode || body.session_mode,
      planningPrompt:
        body.planningPrompt != null || body.planning_prompt != null
          ? String(body.planningPrompt ?? body.planning_prompt ?? "")
          : undefined,
      ayclToken: ayclTokenFromBody(body),
      ileToken: ileTokenFromBody(body),
    });
    const workspaceId = String(payload.workspaceId || "");
    const blockId = String(payload.blockId || "");
    if (!workspaceId || !blockId) {
      return jsonError(400, "workspaceId and blockId are required");
    }

    const auth = await guardWorkspaceRoute(workspaceId, {
      feature: "map",
      ayclToken: ayclTokenFromBody(body),
      ileToken: ileTokenFromBody(body),
      requireProductAccess: false,
    });
    if (!auth.ok) return auth.response;

    if (auth.principal.kind === "cookie_user") {
      const access = await loadProductAccessSnapshot(auth.supabase, auth.persistUserId);
      if (!access.ok) return access.response;
      if (!access.hasPaidAccess) {
        const { data: workspaceKindRow } = await auth.supabase
          .from("workspaces")
          .select("workspace_kind")
          .eq("id", workspaceId)
          .maybeSingle();
        if (isPaidOnlyWorkspaceKind(workspaceKindRow?.workspace_kind)) {
          return jsonError(
            403,
            "Upgrade to run Verification or Calibration.",
            "product_access_required",
            { renew_url: "/pricing" },
          );
        }
        const denied = await rejectIfFreeWeeklySessionLimit(
          auth.supabase,
          auth.persistUserId,
        );
        if (denied) return denied;
      }
    }

    const { data: block, error: blockError } = await auth.supabase
      .from("blocks")
      .select("id, title, planning_prompt, workspace_id, status")
      .eq("id", blockId)
      .eq("workspace_id", workspaceId)
      .single();
    if (blockError || !block) {
      return jsonError(404, "Block not found");
    }

    const sessionMode = payload.sessionMode === "project" ? "project" : "learning";
    const planningPrompt =
      typeof payload.planningPrompt === "string"
        ? payload.planningPrompt.trim() || null
        : block.planning_prompt || null;

    if (typeof payload.planningPrompt === "string") {
      const { error: promptError } = await auth.supabase
        .from("blocks")
        .update({ planning_prompt: planningPrompt })
        .eq("id", blockId)
        .eq("workspace_id", workspaceId);
      if (promptError) {
        return jsonError(500, promptError.message || "Failed to save prompt");
      }
    }

    const { data: session, error: sessionError } = await auth.supabase
      .from("sessions")
      .insert({
        user_id: auth.persistUserId,
        problem: block.title,
        status: "active",
        planning_prompt: planningPrompt,
        metadata: {
          session_mode: sessionMode,
          ile_session_mode: sessionMode,
          block_id: block.id,
          block_title: block.title,
          workspace_id: workspaceId,
          subject_id: auth.subjectId,
          ...(auth.principal.kind === "aycl" ? { aycl_subject_id: auth.subjectId } : {}),
          ...(auth.principal.guestUserId
            ? { guest_user_id: auth.principal.guestUserId }
            : {}),
        },
      })
      .select("id")
      .single();
    if (sessionError || !session) {
      return jsonError(500, sessionError?.message || "Failed to create session");
    }

    const { error: blockUpdateError } = await auth.supabase
      .from("blocks")
      .update({ status: "in_progress", session_id: session.id })
      .eq("id", blockId)
      .eq("workspace_id", workspaceId);
    if (blockUpdateError) {
      await auth.supabase.from("sessions").delete().eq("id", session.id);
      return jsonError(500, blockUpdateError.message || "Failed to update block");
    }

    const { error: joinError } = await auth.supabase.from("block_sessions").insert({
      block_id: blockId,
      session_id: session.id,
      user_id: auth.persistUserId,
      workspace_id: workspaceId,
    });
    if (joinError) {
      await auth.supabase
        .from("blocks")
        .update({ status: block.status ?? "not_started", session_id: null })
        .eq("id", blockId)
        .eq("workspace_id", workspaceId);
      await auth.supabase.from("sessions").delete().eq("id", session.id);
      return jsonError(500, joinError.message || "Failed to link session");
    }

    return NextResponse.json({ sessionId: session.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to launch";
    return jsonError(500, message);
  }
}
