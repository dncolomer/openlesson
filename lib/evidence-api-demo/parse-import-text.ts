import { parseSkillFrontmatter } from "@/lib/agent-v2/integration-skill";

export type ImportSource = "skill" | "mcp";

export const IMPORT_TEXT_MIN_LENGTH = 120;
export const IMPORT_TEXT_MAX_LENGTH = 50000;

export interface ParsedMcpTool {
  name: string;
  description?: string;
}

export interface ParsedImportHints {
  source: ImportSource;
  skillName?: string;
  skillDescription?: string;
  integrationName?: string;
  evalDefinition?: string;
  eventVerbs: string[];
  endpoints: string[];
  mcpTools: ParsedMcpTool[];
  goals: string[];
  excerpt: string;
}

function uniqueStrings(values: string[], limit = 24): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
    if (out.length >= limit) break;
  }
  return out;
}

function extractIntegrationName(text: string, skillName?: string): string | undefined {
  const explicit =
    text.match(/integration_name["\s:]+["']?([a-z0-9_-]+)/i)?.[1] ||
    text.match(/"integration_name"\s*:\s*"([^"]+)"/i)?.[1];
  if (explicit?.trim()) return explicit.trim().slice(0, 120);

  if (skillName) {
    const slug = skillName
      .replace(/-openlesson.*$/i, "")
      .replace(/-evidence.*$/i, "")
      .trim();
    if (slug) return slug;
  }

  const heading = text.match(/^#\s+(.+?)(?:\s+—|\s+-\s+OpenLesson|$)/m)?.[1]?.trim();
  if (heading) {
    return heading
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 120);
  }

  return undefined;
}

function extractEvalDefinition(text: string): string | undefined {
  const purpose = text.match(/##\s*Purpose\s*\n+([\s\S]*?)(?=\n##|\n---|$)/i)?.[1];
  if (purpose?.trim()) return purpose.trim().slice(0, 2000);

  const evalBlock =
    text.match(/eval(?:uation)?[_\s-]*definition["\s:]+["']?([\s\S]*?)(?:"|,|\n\n)/i)?.[1] ||
    text.match(/Evaluation definition[^"]*"""([\s\S]*?)"""/i)?.[1];
  if (evalBlock?.trim()) return evalBlock.trim().slice(0, 2000);

  return undefined;
}

function extractEventVerbs(text: string): string[] {
  const verbs: string[] = [];

  const jsonMatch = text.match(/"event_verbs"\s*:\s*\[([\s\S]*?)\]/i);
  if (jsonMatch) {
    const inner = jsonMatch[1];
    for (const match of inner.matchAll(/"([^"]+)"/g)) {
      verbs.push(match[1]);
    }
  }

  for (const match of text.matchAll(/`([a-z][a-z0-9_]{2,48})`/g)) {
    if (match[1].includes("_")) verbs.push(match[1]);
  }

  for (const match of text.matchAll(/"goal"\s*:\s*"([^"]+)"/g)) {
    verbs.push(match[1]);
  }

  return uniqueStrings(verbs);
}

function extractEndpoints(text: string): string[] {
  const endpoints: string[] = [];

  for (const match of text.matchAll(
    /\|\s*(GET|POST|PUT|PATCH|DELETE)\s*\|\s*(`?[^|\n`]+`?)\s*\|/gi
  )) {
    endpoints.push(`${match[1].toUpperCase()} ${match[2].replace(/`/g, "").trim()}`);
  }

  for (const match of text.matchAll(
    /(GET|POST|PUT|PATCH|DELETE)\s+(\/[\w./{}:-]+)/gi
  )) {
    endpoints.push(`${match[1].toUpperCase()} ${match[2]}`);
  }

  return uniqueStrings(endpoints, 16);
}

function extractGoals(text: string): string[] {
  const goals: string[] = [];
  for (const match of text.matchAll(/"goal"\s*:\s*"([^"]+)"/g)) {
    goals.push(match[1]);
  }
  for (const match of text.matchAll(/-\s*`"goal":\s*"([^"]+)"`/g)) {
    goals.push(match[1]);
  }
  return uniqueStrings(goals, 12);
}

function parseMcpToolsFromJson(text: string): ParsedMcpTool[] {
  try {
    const parsed = JSON.parse(text) as unknown;
    const candidates: unknown[] = [];

    if (Array.isArray(parsed)) {
      candidates.push(...parsed);
    } else if (parsed && typeof parsed === "object") {
      const record = parsed as Record<string, unknown>;
      if (Array.isArray(record.tools)) candidates.push(...record.tools);
      if (Array.isArray(record.mcp_tools)) candidates.push(...record.mcp_tools);
      if (record.tool && typeof record.tool === "object") candidates.push(record.tool);
    }

    const tools: ParsedMcpTool[] = [];
    for (const item of candidates) {
      if (!item || typeof item !== "object") continue;
      const tool = item as Record<string, unknown>;
      const name =
        typeof tool.name === "string"
          ? tool.name
          : typeof tool.tool_name === "string"
            ? tool.tool_name
            : "";
      if (!name.trim()) continue;
      const description =
        typeof tool.description === "string"
          ? tool.description
          : typeof tool.summary === "string"
            ? tool.summary
            : undefined;
      tools.push({
        name: name.trim(),
        description: description?.trim().slice(0, 500),
      });
    }
    return tools.slice(0, 24);
  } catch {
    return [];
  }
}

function parseMcpToolsFromMarkdown(text: string): ParsedMcpTool[] {
  const tools: ParsedMcpTool[] = [];

  for (const match of text.matchAll(/(?:^|\n)(?:###?\s+)?`?([a-z][a-z0-9_/-]{2,64})`?\s*(?:\n|$)/gim)) {
    const name = match[1];
    if (name.includes("http") || name.includes(".")) continue;
    tools.push({ name });
  }

  for (const match of text.matchAll(
    /"name"\s*:\s*"([a-zA-Z][a-zA-Z0-9_/-]{2,64})"[\s\S]{0,400}?"description"\s*:\s*"([^"]+)"/g
  )) {
    tools.push({ name: match[1], description: match[2].slice(0, 500) });
  }

  const deduped = new Map<string, ParsedMcpTool>();
  for (const tool of tools) {
    if (!deduped.has(tool.name)) deduped.set(tool.name, tool);
  }
  return Array.from(deduped.values()).slice(0, 24);
}

export function detectImportSource(text: string): ImportSource {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) return "mcp";
      if (parsed && typeof parsed === "object") {
        const record = parsed as Record<string, unknown>;
        if (Array.isArray(record.tools) || Array.isArray(record.mcp_tools)) return "mcp";
      }
    } catch {
      // fall through
    }
  }

  if (/^---\r?\n[\s\S]*?\r?\n---/m.test(trimmed)) return "skill";
  if (/##\s*(Purpose|Endpoints|Authentication)/i.test(trimmed)) return "skill";
  if (/\bMCP\b|model context protocol|inputSchema|list_tools/i.test(trimmed)) return "mcp";

  return "skill";
}

export function parseImportText(text: string, source: ImportSource): ParsedImportHints {
  const trimmed = text.trim().slice(0, IMPORT_TEXT_MAX_LENGTH);
  const frontmatter = source === "skill" ? parseSkillFrontmatter(trimmed) : null;
  const mcpTools =
    source === "mcp"
      ? [...parseMcpToolsFromJson(trimmed), ...parseMcpToolsFromMarkdown(trimmed)]
      : [];

  const dedupedTools = new Map<string, ParsedMcpTool>();
  for (const tool of mcpTools) {
    if (!dedupedTools.has(tool.name)) dedupedTools.set(tool.name, tool);
  }

  return {
    source,
    skillName: frontmatter?.name,
    skillDescription: frontmatter?.description,
    integrationName: extractIntegrationName(trimmed, frontmatter?.name),
    evalDefinition: extractEvalDefinition(trimmed),
    eventVerbs: extractEventVerbs(trimmed),
    endpoints: extractEndpoints(trimmed),
    mcpTools: Array.from(dedupedTools.values()).slice(0, 24),
    goals: extractGoals(trimmed),
    excerpt: trimmed.slice(0, 12000),
  };
}

export function formatImportHintsForPrompt(hints: ParsedImportHints): string {
  const lines: string[] = [
    `Import source: ${hints.source}`,
    hints.skillName ? `Skill name: ${hints.skillName}` : "",
    hints.skillDescription ? `Skill description: ${hints.skillDescription}` : "",
    hints.integrationName ? `Integration name (hint): ${hints.integrationName}` : "",
    hints.evalDefinition ? `Eval definition (hint):\n${hints.evalDefinition}` : "",
    hints.eventVerbs.length ? `Event verbs (hint): ${hints.eventVerbs.join(", ")}` : "",
    hints.goals.length ? `Serialized goals (hint): ${hints.goals.join(", ")}` : "",
    hints.endpoints.length ? `Endpoints:\n${hints.endpoints.map((e) => `- ${e}`).join("\n")}` : "",
    hints.mcpTools.length
      ? `MCP tools:\n${hints.mcpTools
          .map((t) => `- ${t.name}${t.description ? `: ${t.description}` : ""}`)
          .join("\n")}`
      : "",
  ].filter(Boolean);

  return `${lines.join("\n\n")}\n\nFull pasted document:\n"""\n${hints.excerpt}\n"""`;
}