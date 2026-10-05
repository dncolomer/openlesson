import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import { copyLearningWorkspaceToVerification } from "@/lib/copy-learning-to-verification";
import { denyWorkspaceFeatureById } from "@/lib/workspace-feature-gate";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;

    const body = await req.json().catch(() => ({}));
    const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId.trim() : "";
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!workspaceId) return jsonError(400, "workspaceId is required");
    if (!title) return jsonError(400, "Name is required");

    const denied = await denyWorkspaceFeatureById(workspaceId, "map");
    if (denied) return denied;

    const { workspaceId: createdId } = await copyLearningWorkspaceToVerification(auth.supabase, {
      sourceWorkspaceId: workspaceId,
      ownerUserId: auth.user.id,
      title,
    });
    return NextResponse.json({ workspaceId: createdId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create Verification workspace";
    if (message === "Workspace not found") return jsonError(404, message);
    if (message === "Forbidden") return jsonError(403, message);
    return jsonError(400, message);
  }
}
