import { NextRequest, NextResponse } from "next/server";
import { buildTeachBackInstructions, getTeachBackBrief, TeachBackMode } from "@/lib/teach-back";

export const runtime = "nodejs";

const XAI_CLIENT_SECRETS_URL = "https://api.x.ai/v1/realtime/client_secrets";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const planId = String(body.planId || "");
    const minutes = Number(body.minutes || 10);
    const mode = (body.mode || "curious") as TeachBackMode;
    const voice = String(body.voice || "ara");
    const focusNodeIds = Array.isArray(body.focusNodeIds) ? body.focusNodeIds.filter(Boolean) : [];

    if (!planId) {
      return NextResponse.json({ error: "planId is required" }, { status: 400 });
    }

    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "XAI_API_KEY is not configured" }, { status: 500 });
    }

    const { brief } = await getTeachBackBrief(planId, focusNodeIds);
    const instructions = buildTeachBackInstructions(brief, mode, minutes);

    const response = await fetch(XAI_CLIENT_SECRETS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ expires_after: { seconds: Math.min(Math.max(minutes * 60 + 120, 300), 3600) } }),
    });

    const tokenPayload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json({ error: tokenPayload.error?.message || "Failed to create voice token" }, { status: response.status });
    }

    const token = tokenPayload.value || tokenPayload.client_secret?.value || tokenPayload.client_secret || tokenPayload.secret;
    if (!token) {
      return NextResponse.json({ error: "xAI token response did not include a usable token" }, { status: 500 });
    }

    return NextResponse.json({
      token,
      model: "grok-voice-latest",
      voice,
      minutes,
      mode,
      instructions,
      workspaceTitle: brief.plan.title,
      nodes: brief.nodes.map((node) => ({ id: node.id, title: node.title, status: node.status })),
    });
  } catch (error) {
    console.error("[workspace-teach-back/token] Error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    const status = message === "Not authenticated" ? 401 : message === "Not authorized" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
