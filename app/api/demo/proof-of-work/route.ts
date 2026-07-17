import { NextRequest, NextResponse } from "next/server";
import { uploadWorkspaceProofOfWork } from "@/lib/agent-v2/upload-workspace-proof-of-work";
import { requireDemoAdminWorkspaceSession } from "@/lib/product-demos/demo-access";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId : "";
    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
    }

    const access = await requireDemoAdminWorkspaceSession(workspaceId);
    if (access instanceof NextResponse) return access;

    const payload = body.payload;
    const payloadJson =
      payload && typeof payload === "object" && !Array.isArray(payload)
        ? (payload as Record<string, unknown>)
        : null;

    const base64 =
      typeof body.data === "string"
        ? body.data
        : payloadJson
          ? Buffer.from(JSON.stringify(payloadJson, null, 2)).toString("base64")
          : "";

    const evidence = await uploadWorkspaceProofOfWork(
      access.supabase,
      access.auth,
      {
        id: workspaceId,
        user_id: access.plan.user_id,
        organization_id: access.plan.organization_id ?? access.auth.organization_id,
      },
      {
        workspaceId: workspaceId,
        type: typeof body.type === "string" ? body.type : "tool",
        mime_type: typeof body.mime_type === "string" ? body.mime_type : "application/json",
        data: base64,
        block_id: typeof body.block_id === "string" ? body.block_id : null,
        session_id: typeof body.session_id === "string" ? body.session_id : null,
        file_name: typeof body.file_name === "string" ? body.file_name : undefined,
        tool_name: typeof body.tool_name === "string" ? body.tool_name : "nexusfront",
        tool_action: typeof body.tool_action === "string" ? body.tool_action : undefined,
        metadata:
          body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
            ? (body.metadata as Record<string, unknown>)
            : { source: "partner_integration" },
      }
    );

    return NextResponse.json({ evidence }, { status: 201 });
  } catch (error) {
    console.error("[demo/proof-of-work] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to upload proof of work" },
      { status: 500 }
    );
  }
}