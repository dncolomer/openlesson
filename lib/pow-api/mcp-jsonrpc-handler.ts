import { NextResponse } from "next/server";
import {
  buildMcpResourceContent,
  MCP_RESOURCE_CATALOG,
} from "@/lib/pow-api/integration-discovery";
import {
  callMcpProofOfWorkTool,
  MCP_PROOF_OF_WORK_PROTOCOL_VERSION,
  MCP_PROOF_OF_WORK_SERVER_INSTRUCTIONS,
  MCP_PROOF_OF_WORK_SERVER_NAME,
  MCP_PROOF_OF_WORK_SERVER_VERSION,
  MCP_EVIDENCE_TOOLS,
} from "@/lib/pow-api/mcp-proof-of-work-server";
import type { AuthContext } from "@/lib/pow-api/types";

export type JsonRpcId = string | number | null;

export interface JsonRpcMessage {
  jsonrpc?: string;
  id?: JsonRpcId;
  method?: string;
  params?: unknown;
}

interface ToolCallParams {
  name?: string;
  arguments?: Record<string, unknown>;
}

export function jsonRpcError(id: JsonRpcId, code: number, message: string) {
  return NextResponse.json(
    {
      jsonrpc: "2.0",
      id,
      error: { code, message },
    },
    { status: code === -32603 ? 500 : 200 }
  );
}

export async function handleJsonRpc(
  message: JsonRpcMessage,
  auth: AuthContext,
   
  supabase: any,
  origin: string
) {
  const id = message.id ?? null;

  if (!message.method) return null;

  if (message.method === "initialize") {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: MCP_PROOF_OF_WORK_PROTOCOL_VERSION,
        capabilities: {
          tools: { listChanged: false },
          resources: { subscribe: false, listChanged: false },
        },
        serverInfo: { name: MCP_PROOF_OF_WORK_SERVER_NAME, version: MCP_PROOF_OF_WORK_SERVER_VERSION },
        instructions: MCP_PROOF_OF_WORK_SERVER_INSTRUCTIONS,
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
    return { jsonrpc: "2.0", id, result: { tools: MCP_EVIDENCE_TOOLS } };
  }

  if (message.method === "resources/list") {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        resources: MCP_RESOURCE_CATALOG.map((resource) => ({
          uri: resource.uri,
          name: resource.name,
          description: resource.description,
          mimeType: resource.mimeType,
        })),
      },
    };
  }

  if (message.method === "resources/read") {
    const params = (message.params || {}) as { uri?: string };
    const uri = typeof params.uri === "string" ? params.uri.trim() : "";
    if (!uri) {
      return {
        jsonrpc: "2.0",
        id,
        error: { code: -32602, message: "resources/read requires uri." },
      };
    }

    const content = buildMcpResourceContent(uri, origin);
    if (!content) {
      return {
        jsonrpc: "2.0",
        id,
        error: { code: -32002, message: `Unknown resource: ${uri}` },
      };
    }

    return {
      jsonrpc: "2.0",
      id,
      result: {
        contents: [{ uri, mimeType: "text/markdown", text: content }],
      },
    };
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
      const result = await callMcpProofOfWorkTool(params.name, params.arguments || {}, {
        auth,
        supabase,
        origin,
      });
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

export async function processMcpJsonRpcRequest(
  req: Request,
  auth: AuthContext,
   
  supabase: any
): Promise<NextResponse> {
  const origin = new URL(req.url).origin;

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

    const response = await handleJsonRpc(message, auth, supabase, origin);
    if (response) responses.push(response);
  }

  if (responses.length === 0) {
    return new NextResponse(null, { status: 202 });
  }

  return NextResponse.json(Array.isArray(body) ? responses : responses[0]);
}

export function mcpEndpointDiscoveryResponse(endpoint: string) {
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