import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey, hasScope } from "@/lib/agent-v2/auth";
import type { ApiKeyScope, AuthContext } from "@/lib/agent-v2/types";

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
    name: "list_workspaces",
    description: "List the authenticated OpenLesson user's Performance Workspaces.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", description: "Optional workspace status filter." },
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
    name: "list_blocks",
    description: "List available blocks in a Performance Workspace.",
    inputSchema: {
      type: "object",
      properties: {
        workspace_id: {
          type: "string",
          description: "OpenLesson workspace UUID.",
        },
      },
      required: ["workspace_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "list_ghl_links",
    description: "List existing GHL links and completion status for a workspace.",
    inputSchema: {
      type: "object",
      properties: {
        workspace_id: {
          type: "string",
          description: "OpenLesson workspace UUID.",
        },
      },
      required: ["workspace_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "get_ghl_results",
    description: "Get completed GHL link results for a workspace.",
    inputSchema: {
      type: "object",
      properties: {
        workspace_id: { type: "string", description: "OpenLesson workspace UUID." },
        ghl_link_id: { type: "string", description: "GHL link UUID." },
      },
      required: ["workspace_id", "ghl_link_id"],
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
  auth: AuthContext,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
) {
  if (name === "list_workspaces") {
    requireScope(auth.scopes, "workspaces:read");

    const limit = boundedInt(args.limit, 20, 1, 100);
    const offset = boundedInt(args.offset, 0, 0, 10_000);
    const status = stringArg(args, "status");

    let query = supabase
      .from("learning_plans")
      .select("id, title, root_topic, status, notes, created_at, updated_at", { count: "exact" })
      .or(auth.user_id ? `user_id.eq.${auth.user_id},organization_id.eq.${auth.organization_id}` : `organization_id.eq.${auth.organization_id}`)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) query = query.eq("status", status);

    const { data, error, count } = await query;
    if (error) throw new Error(error.message);

    return textToolResult({
      workspaces: data || [],
      pagination: {
        total: count ?? 0,
        limit,
        offset,
        has_more: offset + limit < (count ?? 0),
      },
    });
  }

  if (name === "list_blocks") {
    requireScope(auth.scopes, "workspaces:read");

    const workspaceId = stringArg(args, "workspace_id");
    if (!workspaceId) throw new Error("workspace_id is required.");

    const { data: workspace, error: workspaceError } = await supabase
      .from("learning_plans")
      .select("id, user_id, organization_id")
      .eq("id", workspaceId)
      .single();

    if (workspaceError || !workspace || (workspace.user_id !== auth.user_id && (!auth.organization_id || workspace.organization_id !== auth.organization_id))) throw new Error("Workspace not found.");

    const { data: blocks, error } = await supabase
      .from("plan_nodes")
      .select("id, title, description, is_start, next_node_ids, status, created_at")
      .eq("plan_id", workspaceId)
      .order("created_at", { ascending: true });

    if (error) throw new Error(error.message);
    return textToolResult({ blocks: blocks || [] });
  }

  if (name === "list_ghl_links") {
    requireScope(auth.scopes, "ghl:read");

    const workspaceId = stringArg(args, "workspace_id");
    if (!workspaceId) throw new Error("workspace_id is required.");

    let query = supabase
      .from("workspace_ghc_sessions")
      .select("id, plan_id, plan_node_id, status, requested_duration_seconds, duration_seconds, mode, overall_score, created_at, started_at, completed_at")
      .eq("plan_id", workspaceId)
      .order("created_at", { ascending: false });

    if (auth.guest_user_id) query = query.eq("guest_user_id", auth.guest_user_id);
    else if (!auth.is_org_admin) query = query.eq("user_id", auth.user_id);

    const { data: links, error } = await query;

    if (error) throw new Error(error.message);
    return textToolResult({ ghl_links: links || [] });
  }

  if (name === "get_ghl_results") {
    requireScope(auth.scopes, "ghl:read");

    const workspaceId = stringArg(args, "workspace_id");
    const linkId = stringArg(args, "ghl_link_id");
    if (!workspaceId) throw new Error("workspace_id is required.");
    if (!linkId) throw new Error("ghl_link_id is required.");

    let query = supabase
      .from("workspace_ghc_sessions")
      .select("id, plan_id, plan_node_id, xai_file_id, status, duration_seconds, requested_duration_seconds, mode, summary, analysis, overall_score, marker_scores, created_at, started_at, completed_at")
      .eq("id", linkId)
      .eq("plan_id", workspaceId);

    if (auth.guest_user_id) query = query.eq("guest_user_id", auth.guest_user_id);
    else if (!auth.is_org_admin) query = query.eq("user_id", auth.user_id);

    const { data: link, error } = await query.single();

    if (error || !link) throw new Error("GHL link not found.");
    return textToolResult({ ghl_result: { ...link, gap_analysis: link.status === "completed" ? link.analysis?.gap_analysis || null : null } });
  }

  throw new Error(`Unknown tool: ${name}`);
}

async function handleJsonRpc(
  message: JsonRpcMessage,
  auth: AuthContext,
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
          "OpenLesson read-only connector. Use the tools to read Performance Workspaces, blocks, and GHL link results. Do not attempt to modify OpenLesson data.",
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
  return authenticateApiKey(decodeURIComponent(key), "workspaces:read");
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
