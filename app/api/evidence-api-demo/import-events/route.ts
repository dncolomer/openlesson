import { NextRequest, NextResponse } from "next/server";
import { requireTeamsUserSession } from "@/lib/agent-v2/workspace-session-access";
import { generateCustomDemoFromImport } from "@/lib/evidence-api-demo/generate-custom-from-import";
import {
  detectImportSource,
  type ImportSource,
} from "@/lib/evidence-api-demo/parse-import-text";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const access = await requireTeamsUserSession();
    if (access instanceof NextResponse) return access;

    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const importText = typeof body.importText === "string" ? body.importText.trim() : "";
    if (!importText) {
      return NextResponse.json({ error: "importText is required." }, { status: 400 });
    }

    const importSource: ImportSource =
      body.importSource === "mcp"
        ? "mcp"
        : body.importSource === "skill"
          ? "skill"
          : detectImportSource(importText);

    const { demo, summary } = await generateCustomDemoFromImport(importText, importSource);

    return NextResponse.json({
      custom_definition: demo,
      import_summary: summary,
    });
  } catch (error) {
    console.error("[evidence-api-demo/import-events] Error:", error);
    const message = error instanceof Error ? error.message : "Failed to import simulation events";
    const hint = message.includes("XAI_API_KEY")
      ? "Set XAI_API_KEY in .env.local and restart the dev server."
      : undefined;
    return NextResponse.json({ error: message, hint }, { status: 500 });
  }
}