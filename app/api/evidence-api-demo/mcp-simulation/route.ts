import { NextRequest, NextResponse } from "next/server";
import { requireDemoAdminSession } from "@/lib/evidence-api-demo/demo-access";
import {
  connectMcpServer,
  McpHttpClientError,
  pullMcpToolData,
} from "@/lib/evidence-api-demo/mcp-http-client";
import { translateMcpResultToEvents } from "@/lib/evidence-api-demo/translate-mcp-to-events";

export const runtime = "nodejs";
export const maxDuration = 120;

function parseToolArgs(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return {};
    return JSON.parse(trimmed) as Record<string, unknown>;
  }
  throw new Error("toolArgs must be a JSON object or JSON string.");
}

export async function POST(req: NextRequest) {
  try {
    const access = await requireDemoAdminSession();
    if (access instanceof NextResponse) return access;

    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const step = body.step === "pull" ? "pull" : "connect";
    const serverUrl = typeof body.serverUrl === "string" ? body.serverUrl.trim() : "";
    const authHeader = typeof body.authHeader === "string" ? body.authHeader.trim() : undefined;

    if (!serverUrl) {
      return NextResponse.json({ error: "serverUrl is required." }, { status: 400 });
    }

    if (step === "connect") {
      const { serverInfo, tools, importLog } = await connectMcpServer(serverUrl, authHeader);
      return NextResponse.json({
        server_info: serverInfo,
        tools,
        import_log: importLog,
      });
    }

    const toolName = typeof body.toolName === "string" ? body.toolName.trim() : "";
    if (!toolName) {
      return NextResponse.json({ error: "toolName is required for pull." }, { status: 400 });
    }

    let toolArgs: Record<string, unknown>;
    try {
      toolArgs = parseToolArgs(body.toolArgs);
    } catch {
      return NextResponse.json({ error: "toolArgs must be valid JSON." }, { status: 400 });
    }

    const toolDescription =
      typeof body.toolDescription === "string" ? body.toolDescription : undefined;

    const { rawResult, importLog } = await pullMcpToolData(
      serverUrl,
      toolName,
      toolArgs,
      authHeader
    );

    const events = translateMcpResultToEvents(toolName, toolDescription, rawResult);

    return NextResponse.json({
      tool_name: toolName,
      raw_result: rawResult,
      events,
      import_log: importLog,
    });
  } catch (error) {
    console.error("[evidence-api-demo/mcp-simulation] Error:", error);

    if (error instanceof McpHttpClientError) {
      return NextResponse.json(
        {
          error: error.message,
          import_log: error.log,
        },
        { status: 502 }
      );
    }

    const message = error instanceof Error ? error.message : "MCP simulation request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}