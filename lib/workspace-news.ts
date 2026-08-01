/**
 * Pure helpers for workspace-topic news widget (empty map right pane).
 * Query assembly + response normalization — API route calls xAI.
 */

export type WorkspaceNewsContext = {
  workspaceTitle?: string | null;
  rootTopic?: string | null;
  workspaceGoal?: string | null;
  workspaceDescription?: string | null;
  notes?: string | null;
};

export type WorkspaceNewsItem = {
  title: string;
  summary: string;
  url: string;
  source?: string | null;
};

/** Build the xAI user prompt for recent news about the workspace topic/context. */
export function buildWorkspaceNewsQuery(ctx: WorkspaceNewsContext): string {
  const topic =
    clean(ctx.rootTopic) ||
    clean(ctx.workspaceTitle) ||
    "general knowledge and learning";
  const goal = clean(ctx.workspaceGoal);
  const description = clean(ctx.workspaceDescription);
  const notes = clean(ctx.notes);

  const lines = [
    `Find recent news and developments related to this learning workspace topic: "${topic}".`,
    goal ? `Workspace goal: ${goal}` : null,
    description ? `Workspace description: ${description.slice(0, 400)}` : null,
    notes ? `Builder notes (context only): ${notes.slice(0, 280)}` : null,
    "",
    "Return 3–5 concise news items as JSON with fields:",
    '- title: headline',
    '- summary: 1–2 sentences',
    '- url: full https URL to the original source article (must be a real public URL)',
    '- source: publisher or site name',
    "",
    "Prefer reputable sources. Focus on the last ~30–90 days when possible.",
    "Do not invent paywalled or fake URLs; use well-known outlets or official docs when uncertain.",
  ];
  return lines.filter((l) => l !== null).join("\n");
}

function clean(raw: unknown): string {
  return String(raw || "")
    .replace(/\s+/g, " ")
    .trim();
}

function isHttpUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const t = value.trim();
  if (!/^https?:\/\//i.test(t)) return false;
  try {
    const u = new URL(t);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Normalize model/API output into UI-ready news items with new-tab-safe links.
 * Drops entries without a valid http(s) URL.
 */
export function normalizeWorkspaceNewsItems(raw: unknown): WorkspaceNewsItem[] {
  let list: unknown[] = [];
  if (Array.isArray(raw)) {
    list = raw;
  } else if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    if (Array.isArray(o.items)) list = o.items;
    else if (Array.isArray(o.news)) list = o.news;
    else if (Array.isArray(o.results)) list = o.results;
  }

  const out: WorkspaceNewsItem[] = [];
  for (const entry of list) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    const title = clean(e.title || e.headline);
    const summary = clean(e.summary || e.description || e.snippet || "");
    const url = isHttpUrl(e.url)
      ? String(e.url).trim()
      : isHttpUrl(e.link)
        ? String(e.link).trim()
        : isHttpUrl(e.source_url)
          ? String(e.source_url).trim()
          : "";
    if (!title || !url) continue;
    out.push({
      title,
      summary: summary || title,
      url,
      source: clean(e.source || e.publisher || e.site) || null,
    });
    if (out.length >= 5) break;
  }
  return out;
}

/** JSON schema fragment description for xAI structured output. */
export const WORKSPACE_NEWS_JSON_SCHEMA = {
  name: "workspace_news",
  schema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            summary: { type: "string" },
            url: { type: "string" },
            source: { type: "string" },
          },
          required: ["title", "summary", "url", "source"],
          additionalProperties: false,
        },
      },
    },
    required: ["items"],
    additionalProperties: false,
  },
} as const;
