import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey, hasScope } from "@/lib/agent-v2/auth";
import type { ApiKeyScope } from "@/lib/agent-v2/types";

export const runtime = "nodejs";

type JsonRpcId = string | number | null;

interface JsonRpcMessage {
  jsonrpc?: string;
  id?: JsonRpcId;
  method?: string;
  params?: unknown;
}

interface ToolCallParams {
  name?: string;
  arguments?: Record<string, unknown>;
}

const MCP_PROTOCOL_VERSION = "2025-03-26";

const READ_TOOLS = [
  {
    name: "list_sessions",
    description: "List the authenticated OpenLesson user's tutoring sessions.",
    inputSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          description: "Optional session status filter.",
          enum: ["active", "paused", "completed", "ended_by_tutor"],
        },
        limit: {
          type: "number",
          description: "Maximum sessions to return, from 1 to 100. Defaults to 20.",
        },
        offset: {
          type: "number",
          description: "Pagination offset. Defaults to 0.",
        },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "get_session",
    description: "Read one OpenLesson tutoring session with its session plan and probes.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: {
          type: "string",
          description: "OpenLesson session UUID.",
        },
      },
      required: ["session_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "get_session_plan",
    description: "Read the AI-generated step plan for one OpenLesson session.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: {
          type: "string",
          description: "OpenLesson session UUID.",
        },
      },
      required: ["session_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "list_learning_plans",
    description: "List the authenticated OpenLesson user's learning plans.",
    inputSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          description: "Optional plan status filter.",
          enum: ["active", "paused", "completed", "archived"],
        },
        limit: {
          type: "number",
          description: "Maximum plans to return, from 1 to 100. Defaults to 20.",
        },
        offset: {
          type: "number",
          description: "Pagination offset. Defaults to 0.",
        },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "get_learning_plan",
    description: "Read one OpenLesson learning plan with its graph nodes.",
    inputSchema: {
      type: "object",
      properties: {
        plan_id: {
          type: "string",
          description: "OpenLesson learning plan UUID.",
        },
      },
      required: ["plan_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
];

function jsonRpcResult(id: JsonRpcId, result: unknown) {
  return NextResponse.json({ jsonrpc: "2.0", id, result });
}

function jsonRpcError(id: JsonRpcId, code: number, message: string, data?: unknown) {
  return NextResponse.json(
    {
      jsonrpc: "2.0",
      id,
      error: {
        code,
        message,
        ...(data === undefined ? {} : { data }),
      },
    },
    { status: code === -32603 ? 500 : 200 }
  );
}

function textToolResult(value: unknown) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}

function stringArg(args: Record<string, unknown>, name: string) {
  const value = args[name];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function boundedInt(value: unknown, fallback: number, min: number, max: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), min), max);
}

function requireScope(scopes: ApiKeyScope[], scope: ApiKeyScope) {
  if (!hasScope(scopes, scope)) {
    throw new Error(`This MCP connector key requires the ${scope} scope.`);
  }
}

async function callTool(
  name: string,
  args: Record<string, unknown>,
  auth: { user_id: string; scopes: ApiKeyScope[] },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
) {
  if (name === "list_sessions") {
    requireScope(auth.scopes, "sessions:read");

    const limit = boundedInt(args.limit, 20, 1, 100);
    const offset = boundedInt(args.offset, 0, 0, 10_000);
    const status = stringArg(args, "status");

    let query = supabase
      .from("sessions")
      .select(
        "id, problem, status, duration_ms, report, report_generated_at, metadata, created_at, ended_at",
        { count: "exact" }
      )
      .eq("user_id", auth.user_id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) query = query.eq("status", status);

    const { data, error, count } = await query;
    if (error) throw new Error(error.message);

    return textToolResult({
      sessions: data || [],
      pagination: {
        total: count ?? 0,
        limit,
        offset,
        has_more: offset + limit < (count ?? 0),
      },
    });
  }

  if (name === "get_session") {
    requireScope(auth.scopes, "sessions:read");

    const sessionId = stringArg(args, "session_id");
    if (!sessionId) throw new Error("session_id is required.");

    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select("id, user_id, problem, status, duration_ms, report, report_generated_at, metadata, created_at, ended_at")
      .eq("id", sessionId)
      .eq("user_id", auth.user_id)
      .single();

    if (sessionError || !session) throw new Error("Session not found.");

    const [{ data: plan }, { data: probes }] = await Promise.all([
      supabase.from("session_plans").select("*").eq("session_id", sessionId).maybeSingle(),
      supabase
        .from("probes")
        .select("id, timestamp_ms, gap_score, signals, text, expanded_text, request_type, plan_step_id, archived, focused, created_at")
        .eq("session_id", sessionId)
        .order("timestamp_ms", { ascending: true }),
    ]);

    return textToolResult({ session, plan: plan || null, probes: probes || [] });
  }

  if (name === "get_session_plan") {
    requireScope(auth.scopes, "sessions:read");

    const sessionId = stringArg(args, "session_id");
    if (!sessionId) throw new Error("session_id is required.");

    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select("id")
      .eq("id", sessionId)
      .eq("user_id", auth.user_id)
      .single();

    if (sessionError || !session) throw new Error("Session not found.");

    const { data: plan, error: planError } = await supabase
      .from("session_plans")
      .select("*")
      .eq("session_id", sessionId)
      .maybeSingle();

    if (planError) throw new Error(planError.message);
    if (!plan) throw new Error("No plan found for this session.");

    return textToolResult({ plan });
  }

  if (name === "list_learning_plans") {
    requireScope(auth.scopes, "plans:read");

    const limit = boundedInt(args.limit, 20, 1, 100);
    const offset = boundedInt(args.offset, 0, 0, 10_000);
    const status = stringArg(args, "status");

    let query = supabase
      .from("learning_plans")
      .select(
        "id, title, root_topic, status, source_type, source_url, source_summary, notes, cover_image_url, is_public, is_group, created_at, updated_at",
        { count: "exact" }
      )
      .eq("user_id", auth.user_id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) query = query.eq("status", status);

    const { data, error, count } = await query;
    if (error) throw new Error(error.message);

    return textToolResult({
      plans: data || [],
      pagination: {
        total: count ?? 0,
        limit,
        offset,
        has_more: offset + limit < (count ?? 0),
      },
    });
  }

  if (name === "get_learning_plan") {
    requireScope(auth.scopes, "plans:read");

    const planId = stringArg(args, "plan_id");
    if (!planId) throw new Error("plan_id is required.");

    const { data: plan, error: planError } = await supabase
      .from("learning_plans")
      .select("*")
      .eq("id", planId)
      .eq("user_id", auth.user_id)
      .single();

    if (planError || !plan) throw new Error("Learning plan not found.");

    const { data: nodes, error: nodesError } = await supabase
      .from("plan_nodes")
      .select("*")
      .eq("plan_id", planId)
      .order("created_at", { ascending: true });

    if (nodesError) throw new Error(nodesError.message);

    return textToolResult({ plan, nodes: nodes || [] });
  }

  throw new Error(`Unknown tool: ${name}`);
}

async function handleJsonRpc(
  message: JsonRpcMessage,
  auth: { user_id: string; scopes: ApiKeyScope[] },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
) {
  const id = message.id ?? null;

  if (!message.method) return null;

  if (message.method === "initialize") {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "openlesson-grok-mcp", version: "0.1.0" },
        instructions:
          "OpenLesson read-only connector. Use the tools to read this user's tutoring sessions and learning plans. Do not attempt to modify OpenLesson data.",
      },
    };
  }

  if (message.method === "ping") {
    return { jsonrpc: "2.0", id, result: {} };
  }

  if (message.method === "notifications/initialized") {
    return null;
  }

  if (message.method === "tools/list") {
    return { jsonrpc: "2.0", id, result: { tools: READ_TOOLS } };
  }

  if (message.method === "tools/call") {
    const params = (message.params || {}) as ToolCallParams;
    if (!params.name) {
      return {
        jsonrpc: "2.0",
        id,
        error: { code: -32602, message: "tools/call requires a tool name." },
      };
    }

    try {
      const result = await callTool(params.name, params.arguments || {}, auth, supabase);
      return { jsonrpc: "2.0", id, result };
    } catch (error) {
      return {
        jsonrpc: "2.0",
        id,
        error: {
          code: -32000,
          message: error instanceof Error ? error.message : "Tool call failed.",
        },
      };
    }
  }

  return {
    jsonrpc: "2.0",
    id,
    error: { code: -32601, message: `Method not found: ${message.method}` },
  };
}

async function authenticateMcpKey(key: string) {
  return authenticateApiKey(decodeURIComponent(key), "sessions:read");
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params;
  const authResult = await authenticateMcpKey(key);
  if (authResult instanceof NextResponse) return authResult;

  const endpoint = `/api/mcp/${encodeURIComponent(key)}`;
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(`event: endpoint\ndata: ${endpoint}\n\n`));
      controller.close();
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params;
  const authResult = await authenticateMcpKey(key);
  if (authResult instanceof NextResponse) return authResult;

  const { auth, supabase } = authResult;

  let body: JsonRpcMessage | JsonRpcMessage[];
  try {
    body = await req.json();
  } catch {
    return jsonRpcError(null, -32700, "Parse error");
  }

  const messages = Array.isArray(body) ? body : [body];
  const responses = [];

  for (const message of messages) {
    if (!message || message.jsonrpc !== "2.0") {
      responses.push({
        jsonrpc: "2.0",
        id: message?.id ?? null,
        error: { code: -32600, message: "Invalid JSON-RPC request." },
      });
      continue;
    }

    const response = await handleJsonRpc(message, auth, supabase);
    if (response) responses.push(response);
  }

  if (responses.length === 0) {
    return new NextResponse(null, { status: 202 });
  }

  return NextResponse.json(Array.isArray(body) ? responses : responses[0]);
}
