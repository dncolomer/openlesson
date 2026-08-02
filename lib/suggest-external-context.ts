/**
 * Pure helpers: xAI internet / external-source suggestions → attachable
 * local-context external resources for Add / geometry create.
 */

import { isValidHttpUrl } from "@/lib/workspace-external-resources";
import {
  shapeContextSourceKey,
  type ShapeContextSourceOption,
} from "@/lib/shape-context-select";

export type ExternalContextSuggestion = {
  /** Stable client id before DB insert (url hash). */
  key: string;
  title: string;
  url: string;
  description: string | null;
  rationale: string | null;
};

export type AcceptExternalSuggestionResult = {
  /** Option for the shape-context picker. */
  option: ShapeContextSourceOption;
  /** Create payload for /api/workspace/external-resources. */
  createInput: {
    title: string;
    url: string;
    description: string | null;
    source: "create";
    resource_type: string | null;
  };
};

const TITLE_MAX = 240;
const DESC_MAX = 500;
const MAX_SUGGESTIONS = 8;

function clean(s: unknown): string {
  return String(s ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function clip(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1).trimEnd()}…`;
}

function suggestionKeyFromUrl(url: string): string {
  return `suggest:${url.toLowerCase()}`;
}

/**
 * Normalize raw model / API payload into validated suggestions.
 * Requires http(s) URL; de-dupes by URL; caps list size.
 */
export function normalizeExternalContextSuggestions(
  raw: unknown,
): ExternalContextSuggestion[] {
  let list: unknown[] = [];
  if (Array.isArray(raw)) {
    list = raw;
  } else if (raw && typeof raw === "object") {
    const rec = raw as Record<string, unknown>;
    if (Array.isArray(rec.suggestions)) list = rec.suggestions;
    else if (Array.isArray(rec.sources)) list = rec.sources;
    else if (Array.isArray(rec.resources)) list = rec.resources;
  }

  const out: ExternalContextSuggestion[] = [];
  const seenUrl = new Set<string>();

  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const urlRaw = clean(rec.url ?? rec.href ?? rec.link);
    if (!urlRaw || !isValidHttpUrl(urlRaw)) continue;
    let url = urlRaw;
    try {
      url = new URL(urlRaw).toString();
    } catch {
      continue;
    }
    const urlKey = url.toLowerCase();
    if (seenUrl.has(urlKey)) continue;
    seenUrl.add(urlKey);

    let title = clean(rec.title ?? rec.name ?? rec.label);
    if (!title) {
      try {
        title = new URL(url).hostname || url;
      } catch {
        title = url;
      }
    }
    title = clip(title, TITLE_MAX);
    const descriptionRaw = clean(
      rec.description ?? rec.summary ?? rec.snippet ?? "",
    );
    const rationaleRaw = clean(rec.rationale ?? rec.why ?? rec.reason ?? "");
    out.push({
      key: suggestionKeyFromUrl(url),
      title,
      url,
      description: descriptionRaw ? clip(descriptionRaw, DESC_MAX) : null,
      rationale: rationaleRaw ? clip(rationaleRaw, DESC_MAX) : null,
    });
    if (out.length >= MAX_SUGGESTIONS) break;
  }
  return out;
}

/**
 * Map a validated suggestion + persisted external resource id into picker option.
 */
export function externalSuggestionToContextOption(
  suggestion: ExternalContextSuggestion,
  resourceId: string,
): ShapeContextSourceOption {
  const id = clean(resourceId);
  const desc = [suggestion.description, suggestion.rationale]
    .filter(Boolean)
    .join(" — ");
  return {
    key: shapeContextSourceKey("external", id || suggestion.key),
    kind: "external",
    id: id || suggestion.key,
    label: suggestion.title,
    url: suggestion.url,
    excerpt: [
      suggestion.url ? `URL: ${suggestion.url}` : null,
      desc || null,
    ]
      .filter(Boolean)
      .join("\n") || null,
  };
}

/**
 * Prepare accept: create-input for external-resources API + pending option shape
 * (id filled after insert).
 */
export function acceptExternalContextSuggestion(
  suggestion: ExternalContextSuggestion,
): AcceptExternalSuggestionResult | null {
  if (!suggestion?.url || !isValidHttpUrl(suggestion.url)) return null;
  const title = clean(suggestion.title) || suggestion.url;
  const description =
    [suggestion.description, suggestion.rationale].filter(Boolean).join("\n") ||
    null;
  return {
    createInput: {
      title: clip(title, TITLE_MAX),
      url: suggestion.url,
      description: description ? clip(description, DESC_MAX) : null,
      source: "create",
      resource_type: "web",
    },
    option: {
      key: suggestionKeyFromUrl(suggestion.url),
      kind: "external",
      id: suggestion.key,
      label: clip(title, TITLE_MAX),
      url: suggestion.url,
      excerpt: description
        ? `URL: ${suggestion.url}\n${description}`
        : `URL: ${suggestion.url}`,
    },
  };
}

/**
 * After DB insert, re-key option to external:<id> and ensure selection list includes it.
 */
export function mergeAcceptedExternalIntoSelection(input: {
  selectedKeys: readonly string[];
  options: readonly ShapeContextSourceOption[];
  resourceId: string;
  suggestion: ExternalContextSuggestion;
}): {
  options: ShapeContextSourceOption[];
  selectedKeys: string[];
} {
  const option = externalSuggestionToContextOption(
    input.suggestion,
    input.resourceId,
  );
  const withoutDup = (input.options || []).filter(
    (o) =>
      o.key !== option.key &&
      !(o.kind === "external" && o.url && o.url === option.url),
  );
  const options = [option, ...withoutDup];
  const selectedKeys = input.selectedKeys.includes(option.key)
    ? [...input.selectedKeys]
    : [...input.selectedKeys, option.key];
  return { options, selectedKeys };
}

/** System + user message bodies for the xAI suggest call (server). */
export function buildSuggestExternalContextMessages(input: {
  topic: string;
  workspaceTitle?: string | null;
}): { system: string; user: string } {
  const topic = clean(input.topic) || "general learning topic";
  const ws = clean(input.workspaceTitle);
  return {
    system: `You suggest real, reputable internet learning resources for authors building an educational map.
Return ONLY valid JSON of the form:
{"suggestions":[{"title":"...","url":"https://...","description":"...","rationale":"..."}]}
Rules:
- 3 to 6 suggestions
- Only http(s) URLs from reputable sources (docs, universities, Wikipedia, standards bodies, major educational sites)
- Prefer primary / official sources over SEO spam
- description: one short sentence what the page covers
- rationale: why it helps as local context for this block
- No markdown fences, no prose outside JSON`,
    user: [
      `Block / topic to support: ${topic}`,
      ws ? `Workspace: ${ws}` : null,
      "Suggest external sources the author can attach as local context for generating this block.",
    ]
      .filter(Boolean)
      .join("\n"),
  };
}
