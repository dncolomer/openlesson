import type { McpSimulationEvent } from "./mcp-simulation-types";

const RECORD_ARRAY_KEYS = [
  "workspaces",
  "blocks",
  "ghl_links",
  "events",
  "activities",
  "records",
  "items",
  "data",
  "results",
  "entries",
  "logs",
] as const;

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
}

export function parseMcpToolResultPayload(result: unknown): unknown {
  if (!result || typeof result !== "object") return result;

  const record = result as Record<string, unknown>;
  if (!Array.isArray(record.content)) return result;

  const textBlock = record.content.find(
    (block) =>
      block &&
      typeof block === "object" &&
      (block as Record<string, unknown>).type === "text" &&
      typeof (block as Record<string, unknown>).text === "string"
  ) as { text: string } | undefined;

  if (!textBlock) return result;

  try {
    return JSON.parse(textBlock.text);
  } catch {
    return { text: textBlock.text };
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function extractRecords(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) return parsed;

  const record = asRecord(parsed);
  if (!record) return [];

  for (const key of RECORD_ARRAY_KEYS) {
    const candidate = record[key];
    if (Array.isArray(candidate) && candidate.length > 0) {
      return candidate;
    }
  }

  return [];
}

function inferLabel(record: unknown, toolName: string, index: number): string {
  const obj = asRecord(record);
  if (!obj) {
    return `${toolName} result ${index + 1}`;
  }

  const candidates = ["title", "name", "label", "event", "action", "verb", "id", "status"];
  for (const key of candidates) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return `${toolName} record ${index + 1}`;
}

function inferDescription(record: unknown, toolDescription?: string): string {
  const obj = asRecord(record);
  if (!obj) {
    return toolDescription || "Imported MCP tool result.";
  }

  const candidates = ["description", "summary", "message", "detail", "status"];
  for (const key of candidates) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return toolDescription || "Imported MCP tool result.";
}

function inferTimestamp(record: unknown): string {
  const obj = asRecord(record);
  if (!obj) return new Date().toISOString();

  const candidates = ["timestamp", "created_at", "updated_at", "started_at", "completed_at"];
  for (const key of candidates) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return new Date(value).toISOString();
    }
  }

  return new Date().toISOString();
}

function inferOutcome(record: unknown): McpSimulationEvent["outcome"] {
  const obj = asRecord(record);
  if (!obj) return "success";

  const status = typeof obj.status === "string" ? obj.status.toLowerCase() : "";
  if (status.includes("fail") || status.includes("error")) return "failure";
  if (status.includes("partial") || status.includes("pending")) return "partial";
  if (status.includes("struggle")) return "struggle";
  return "success";
}

function createEvent(
  toolName: string,
  toolDescription: string | undefined,
  record: unknown,
  index: number,
  total: number
): McpSimulationEvent {
  const baseVerb = slugify(toolName) || "mcp_event";
  const verb = total > 1 ? `${baseVerb}_${index + 1}` : baseVerb;
  const recordData = asRecord(record) ?? { value: record };

  return {
    id: crypto.randomUUID(),
    verb,
    label: inferLabel(record, toolName, index),
    description: inferDescription(record, toolDescription),
    timestamp: inferTimestamp(record),
    mcpTool: toolName,
    outcome: inferOutcome(record),
    sourceData: { ...recordData, mcp_import: true },
    status: "pending",
  };
}

export function translateMcpResultToEvents(
  toolName: string,
  toolDescription: string | undefined,
  rawResult: unknown
): McpSimulationEvent[] {
  const parsed = parseMcpToolResultPayload(rawResult);
  const records = extractRecords(parsed);

  if (records.length === 0) {
    return [createEvent(toolName, toolDescription, parsed, 0, 1)];
  }

  return records.map((record, index) =>
    createEvent(toolName, toolDescription, record, index, records.length)
  );
}