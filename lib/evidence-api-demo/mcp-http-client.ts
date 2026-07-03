import type { McpImportLogEntry, McpToolDescriptor } from "./mcp-simulation-types";

const MCP_PROTOCOL_VERSION = "2025-03-26";
const CLIENT_INFO = { name: "openlesson-evidence-demo", version: "1.0.0" };

type JsonRpcId = string | number | null;

interface JsonRpcResponse {
  jsonrpc?: string;
  id?: JsonRpcId;
  result?: unknown;
  error?: { code?: number; message?: string; data?: unknown };
}

export class McpHttpClientError extends Error {
  constructor(
    message: string,
    readonly log: McpImportLogEntry[] = []
  ) {
    super(message);
    this.name = "McpHttpClientError";
  }
}

export function validateMcpServerUrl(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new Error("Enter a valid MCP server URL (http or https).");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("MCP server URL must use http or https.");
  }

  return parsed;
}

function createLog(
  level: McpImportLogEntry["level"],
  message: string,
  detail?: string
): McpImportLogEntry {
  return {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    level,
    message,
    detail,
  };
}

function buildHeaders(authHeader?: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };

  if (authHeader?.trim()) {
    const value = authHeader.trim();
    headers.Authorization = value.startsWith("Bearer ") ? value : `Bearer ${value}`;
  }

  return headers;
}

async function parseMcpResponseBody(
  response: Response
): Promise<{ payload: JsonRpcResponse; transport: string }> {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("text/event-stream")) {
    const text = await response.text();
    const dataLines = text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .filter(Boolean);

    const lastData = dataLines[dataLines.length - 1];
    if (!lastData) {
      throw new Error("MCP server returned an empty SSE stream.");
    }

    return { payload: JSON.parse(lastData) as JsonRpcResponse, transport: "sse" };
  }

  const text = await response.text();
  if (!text.trim()) {
    throw new Error("MCP server returned an empty response.");
  }

  return { payload: JSON.parse(text) as JsonRpcResponse, transport: "json" };
}

async function mcpRequest(
  serverUrl: string,
  method: string,
  params: unknown,
  authHeader: string | undefined,
  log: McpImportLogEntry[],
  requestId: number
): Promise<unknown> {
  log.push(createLog("info", `→ ${method}`, JSON.stringify(params ?? {}, null, 2)));

  const response = await fetch(serverUrl, {
    method: "POST",
    headers: buildHeaders(authHeader),
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: requestId,
      method,
      params,
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok && response.status !== 202) {
    const body = await response.text().catch(() => "");
    throw new McpHttpClientError(
      `MCP server HTTP ${response.status}${body ? `: ${body.slice(0, 200)}` : ""}`,
      log
    );
  }

  if (response.status === 202) {
    log.push(createLog("info", `← ${method}`, "accepted (no JSON-RPC body)"));
    return null;
  }

  const { payload, transport } = await parseMcpResponseBody(response);

  if (payload.error?.message) {
    throw new McpHttpClientError(payload.error.message, log);
  }

  log.push(
    createLog(
      "success",
      `← ${method}`,
      `transport=${transport}\n${JSON.stringify(payload.result ?? null, null, 2).slice(0, 4000)}`
    )
  );

  return payload.result;
}

function normalizeTools(result: unknown): McpToolDescriptor[] {
  if (!result || typeof result !== "object") return [];
  const tools = (result as { tools?: unknown }).tools;
  if (!Array.isArray(tools)) return [];

  const normalized: McpToolDescriptor[] = [];

  for (const tool of tools) {
    if (!tool || typeof tool !== "object") continue;
    const entry = tool as Record<string, unknown>;
    const name = typeof entry.name === "string" ? entry.name : "";
    if (!name) continue;
    normalized.push({
      name,
      description: typeof entry.description === "string" ? entry.description : undefined,
      inputSchema:
        entry.inputSchema && typeof entry.inputSchema === "object"
          ? (entry.inputSchema as Record<string, unknown>)
          : undefined,
    });
  }

  return normalized;
}

export async function connectMcpServer(
  serverUrl: string,
  authHeader?: string
): Promise<{
  serverInfo?: { name?: string; version?: string };
  tools: McpToolDescriptor[];
  importLog: McpImportLogEntry[];
}> {
  const log: McpImportLogEntry[] = [];
  const normalizedUrl = validateMcpServerUrl(serverUrl).toString();

  log.push(createLog("info", "Connecting to MCP server", normalizedUrl));

  const initResult = (await mcpRequest(
    normalizedUrl,
    "initialize",
    {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: CLIENT_INFO,
    },
    authHeader,
    log,
    1
  )) as { serverInfo?: { name?: string; version?: string } } | null;

  await mcpRequest(
    normalizedUrl,
    "notifications/initialized",
    {},
    authHeader,
    log,
    2
  ).catch(() => {
    log.push(createLog("info", "Server skipped notifications/initialized"));
  });

  const toolsResult = await mcpRequest(
    normalizedUrl,
    "tools/list",
    {},
    authHeader,
    log,
    3
  );

  const tools = normalizeTools(toolsResult);
  log.push(createLog("success", `Discovered ${tools.length} MCP tool(s)`));

  return {
    serverInfo: initResult?.serverInfo,
    tools,
    importLog: log,
  };
}

export async function pullMcpToolData(
  serverUrl: string,
  toolName: string,
  toolArgs: Record<string, unknown>,
  authHeader?: string
): Promise<{
  rawResult: unknown;
  importLog: McpImportLogEntry[];
}> {
  const log: McpImportLogEntry[] = [];
  const normalizedUrl = validateMcpServerUrl(serverUrl).toString();

  log.push(createLog("info", `Pulling data via MCP tool: ${toolName}`));

  await mcpRequest(
    normalizedUrl,
    "initialize",
    {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: CLIENT_INFO,
    },
    authHeader,
    log,
    1
  );

  await mcpRequest(
    normalizedUrl,
    "notifications/initialized",
    {},
    authHeader,
    log,
    2
  ).catch(() => {
    log.push(createLog("info", "Server skipped notifications/initialized"));
  });

  const rawResult = await mcpRequest(
    normalizedUrl,
    "tools/call",
    {
      name: toolName,
      arguments: toolArgs,
    },
    authHeader,
    log,
    3
  );

  log.push(createLog("success", `Received MCP tool result from ${toolName}`));

  return { rawResult, importLog: log };
}