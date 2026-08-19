import { NextRequest } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { resolveAyclSessionAccess } from "@/lib/aycl-session-auth";
import {
  applyTutoringSessionMutate,
  resolveTutoringContext,
  type TutoringMutateAction,
} from "@/lib/tutoring-runtime";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const token = typeof body.token === "string" ? body.token.trim() : "";
    const action = typeof body.action === "string" ? body.action : "";
    const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";

    if (!token || !action || !sessionId) {
      return jsonError(400, "token, action, and sessionId are required");
    }

    const ctx = await resolveAyclSessionAccess(token, sessionId);
    if ("error" in ctx) {
      return jsonError(ctx.status, ctx.error);
    }

    const mutateAction: TutoringMutateAction =
      action === "save" || action === "add_probe" ? action : "get";
    const result = await applyTutoringSessionMutate(
      ctx.supabase as never,
      resolveTutoringContext({
        product: "ile",
        modality: "dialog",
        authKind: "aycl",
        workspaceId: ctx.workspaceId,
        sessionId,
      }),
      {
        action: mutateAction,
        session: body.session,
        probes: body.probes,
        probe: body.probe,
      },
    );

    if (!result.ok) {
      return jsonError(result.status, result.message);
    }
    if (result.action === "get") {
      return Response.json({ session: result.session, probes: result.probes });
    }
    if (result.action === "add_probe") {
      return Response.json({ probe: result.probe });
    }
    return Response.json({ ok: true });
  } catch (error) {
    console.error("[aycl/session-mutate]", error);
    return jsonError(500, "Failed to update session");
  }
}
