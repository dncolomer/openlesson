/**
 * Pure model + normalize helpers for workspace external sources (Context tab).
 * Free of React/DB — unit tests drive create/update/delete field shapes.
 */

export type ExternalResourceSource = "link" | "dantes" | "create";

export interface WorkspaceExternalResource {
  id: string;
  workspace_id: string;
  title: string;
  url: string;
  resource_type: string | null;
  description: string | null;
  source: ExternalResourceSource;
  dantes_topic_slug: string | null;
  meta: Record<string, unknown>;
  sort_order: number;
  created_at: string;
  updated_at?: string | null;
}

/** Input shape for create (Dantes pick, add-link form, or create-flow). */
export interface ExternalResourceCreateInput {
  title?: string | null;
  url?: string | null;
  resource_type?: string | null;
  description?: string | null;
  source?: ExternalResourceSource | string | null;
  dantes_topic_slug?: string | null;
  meta?: Record<string, unknown> | null;
  sort_order?: number | null;
}

export interface ExternalResourceUpdateInput {
  title?: string | null;
  url?: string | null;
  resource_type?: string | null;
  description?: string | null;
  meta?: Record<string, unknown> | null;
  sort_order?: number | null;
}

const URL_MAX = 2_048;
const TITLE_MAX = 240;
const DESC_MAX = 2_000;

export function isValidHttpUrl(raw: string): boolean {
  try {
    const u = new URL(raw.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function normalizeExternalResourceSource(
  raw: unknown,
): ExternalResourceSource {
  const s = String(raw || "").toLowerCase().trim();
  if (s === "dantes" || s === "create" || s === "link") return s;
  return "link";
}

/**
 * Normalize a create payload for API insert / pure tests.
 * Returns null when URL is missing/invalid.
 */
export function normalizeExternalResourceCreate(
  input: ExternalResourceCreateInput,
): {
  title: string;
  url: string;
  resource_type: string | null;
  description: string | null;
  source: ExternalResourceSource;
  dantes_topic_slug: string | null;
  meta: Record<string, unknown>;
  sort_order: number;
} | null {
  const url = typeof input.url === "string" ? input.url.trim().slice(0, URL_MAX) : "";
  if (!url || !isValidHttpUrl(url)) return null;

  let title =
    typeof input.title === "string" ? input.title.replace(/\s+/g, " ").trim() : "";
  if (!title) {
    try {
      title = new URL(url).hostname || url;
    } catch {
      title = url;
    }
  }
  title = title.slice(0, TITLE_MAX);

  const descriptionRaw =
    typeof input.description === "string" ? input.description.trim() : "";
  const description = descriptionRaw
    ? descriptionRaw.slice(0, DESC_MAX)
    : null;
  const resource_type =
    typeof input.resource_type === "string" && input.resource_type.trim()
      ? input.resource_type.trim().slice(0, 64)
      : null;
  const source = normalizeExternalResourceSource(input.source);
  const dantes_topic_slug =
    typeof input.dantes_topic_slug === "string" && input.dantes_topic_slug.trim()
      ? input.dantes_topic_slug.trim().slice(0, 120)
      : null;
  const meta =
    input.meta && typeof input.meta === "object" && !Array.isArray(input.meta)
      ? (input.meta as Record<string, unknown>)
      : {};
  const sort_order =
    typeof input.sort_order === "number" && Number.isFinite(input.sort_order)
      ? Math.floor(input.sort_order)
      : 0;

  return {
    title,
    url,
    resource_type,
    description,
    source,
    dantes_topic_slug,
    meta,
    sort_order,
  };
}

/** Normalize a Dantes API resource into a create payload. */
export function externalResourceFromDantes(input: {
  title?: string | null;
  url?: string | null;
  type?: string | null;
  description?: string | null;
  difficulty?: string | null;
  topicSlug?: string | null;
  source?: ExternalResourceSource;
}): ExternalResourceCreateInput {
  return {
    title: input.title,
    url: input.url,
    resource_type: input.type ?? null,
    description: input.description ?? null,
    source: input.source ?? "dantes",
    dantes_topic_slug: input.topicSlug ?? null,
    meta: {
      difficulty: input.difficulty ?? null,
    },
  };
}

/** Normalize DB/API row. */
export function normalizeExternalResourceRow(
  raw: unknown,
): WorkspaceExternalResource | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id : "";
  const workspace_id =
    typeof r.workspace_id === "string"
      ? r.workspace_id
      : typeof r.workspaceId === "string"
        ? r.workspaceId
        : "";
  const title = typeof r.title === "string" ? r.title.trim() : "";
  const url = typeof r.url === "string" ? r.url.trim() : "";
  if (!id || !workspace_id || !title || !url) return null;
  return {
    id,
    workspace_id,
    title,
    url,
    resource_type:
      typeof r.resource_type === "string"
        ? r.resource_type
        : typeof r.resourceType === "string"
          ? r.resourceType
          : null,
    description: typeof r.description === "string" ? r.description : null,
    source: normalizeExternalResourceSource(r.source),
    dantes_topic_slug:
      typeof r.dantes_topic_slug === "string"
        ? r.dantes_topic_slug
        : typeof r.dantesTopicSlug === "string"
          ? r.dantesTopicSlug
          : null,
    meta:
      r.meta && typeof r.meta === "object" && !Array.isArray(r.meta)
        ? (r.meta as Record<string, unknown>)
        : {},
    sort_order:
      typeof r.sort_order === "number"
        ? r.sort_order
        : typeof r.sortOrder === "number"
          ? r.sortOrder
          : 0,
    created_at:
      typeof r.created_at === "string"
        ? r.created_at
        : typeof r.createdAt === "string"
          ? r.createdAt
          : new Date(0).toISOString(),
    updated_at:
      typeof r.updated_at === "string"
        ? r.updated_at
        : typeof r.updatedAt === "string"
          ? r.updatedAt
          : null,
  };
}

export function normalizeExternalResourceList(
  rows: unknown,
): WorkspaceExternalResource[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .map(normalizeExternalResourceRow)
    .filter((r): r is WorkspaceExternalResource => r != null)
    .sort((a, b) => {
      if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
      return a.created_at.localeCompare(b.created_at);
    });
}

// ── Local absorb + JIT URL bias (pure) ──────────────────────────────────

/** Marker prefix for absorbed external sources in local_context.notes. */
export const EXTERNAL_ABSORB_MARKER = "### External source";

/** Minimal link row for absorb / prompt bias (no DB required). */
export type ExternalLinkAbsorbInput = {
  title?: string | null;
  url?: string | null;
  description?: string | null;
  id?: string | null;
  /**
   * Fetched page/body substance from the linked URL (when available).
   * Preferred over description for generation + durable absorb excerpts.
   */
  body?: string | null;
};

/** Max chars of fetched link body kept for generation / absorb. */
export const LINK_BODY_MAX_CHARS = 4_000;

/**
 * Strip tags / scripts from HTML-ish input → plain text for generation.
 * Pure (no DOM); best-effort for server-fetched pages.
 */
export function htmlToPlainText(html: string): string {
  let s = String(html || "");
  // Drop script/style/noscript blocks entirely
  s = s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ");
  s = s.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ");
  s = s.replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ");
  // Prefer main / article content when present
  const main =
    s.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ||
    s.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1] ||
    s;
  s = main
    .replace(/<\/(p|div|h[1-6]|li|tr|br|section|header|footer)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  // Decode a few common entities
  s = s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => {
      const code = Number(n);
      return Number.isFinite(code) && code > 0 && code < 0x110000
        ? String.fromCodePoint(code)
        : " ";
    });
  return s
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/**
 * Normalize raw fetched page text (HTML or plain) into clipped plain body.
 * Empty / junk → empty string.
 */
export function normalizeLinkBodyText(
  raw: string | null | undefined,
  maxChars: number = LINK_BODY_MAX_CHARS,
): string {
  const input = typeof raw === "string" ? raw : "";
  if (!input.trim()) return "";
  const looksHtml = /<\/?[a-z][\s\S]*>/i.test(input);
  const plain = looksHtml ? htmlToPlainText(input) : input.replace(/\s+/g, " ").trim();
  if (!plain) return "";
  // Drop ultra-thin results (login walls, empty shells)
  if (plain.length < 40) return plain.length >= 20 ? plain : "";
  if (plain.length <= maxChars) return plain;
  return `${plain.slice(0, maxChars - 1).trimEnd()}…`;
}

/**
 * Merge fetched body into an existing option excerpt (URL + summary + body).
 */
export function mergeLinkBodyIntoExcerpt(
  existing: string | null | undefined,
  body: string | null | undefined,
  url?: string | null,
): string {
  const bodyText = normalizeLinkBodyText(body);
  const base = cleanAbsorbText(existing);
  const urlLine =
    url && isValidHttpUrl(url) ? `URL: ${url}` : base.match(/^URL:\s*\S+/i)?.[0] || null;
  const parts: string[] = [];
  if (urlLine) parts.push(urlLine);
  // Keep non-URL lines from existing as summary (not duplicate body)
  if (base) {
    const rest = base
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !/^URL:\s*/i.test(l) && !/^Content:\s*/i.test(l));
    if (rest.length) parts.push(rest.join("\n"));
  }
  if (bodyText) parts.push(`Content:\n${bodyText}`);
  return parts.join("\n").trim();
}

function cleanAbsorbText(s: unknown): string {
  return typeof s === "string" ? s.replace(/\s+/g, " ").trim() : "";
}

/**
 * Format one external link as durable local-notes text (title + URL + summary).
 * Returns null when URL is missing/invalid.
 */
export function formatAbsorbedExternalNoteBlock(
  input: ExternalLinkAbsorbInput,
): string | null {
  const urlRaw = cleanAbsorbText(input.url);
  if (!urlRaw || !isValidHttpUrl(urlRaw)) return null;
  let url = urlRaw;
  try {
    url = new URL(urlRaw).toString();
  } catch {
    /* keep raw */
  }
  let title = cleanAbsorbText(input.title);
  if (!title) {
    try {
      title = new URL(url).hostname || url;
    } catch {
      title = url;
    }
  }
  title = title.slice(0, TITLE_MAX);
  const desc = cleanAbsorbText(input.description).slice(0, DESC_MAX);
  const body = normalizeLinkBodyText(input.body, LINK_BODY_MAX_CHARS);
  const lines = [
    `${EXTERNAL_ABSORB_MARKER}: ${title}`,
    `URL: ${url}`,
  ];
  if (desc) lines.push(`Summary: ${desc}`);
  if (body) {
    lines.push(`Content:\n${body}`);
  } else {
    lines.push(
      "Absorbed locally as block context — consult this URL for domain substance when needed.",
    );
  }
  return lines.join("\n");
}

/** True when notes already contain this URL (case-insensitive). */
export function localNotesContainExternalUrl(
  notes: string | null | undefined,
  url: string,
): boolean {
  const n = cleanAbsorbText(notes).toLowerCase();
  const u = cleanAbsorbText(url).toLowerCase();
  if (!n || !u) return false;
  if (n.includes(u)) return true;
  // Also match without trailing slash
  const stripped = u.replace(/\/$/, "");
  return stripped.length > 8 && n.includes(stripped);
}

/**
 * Append absorbed note blocks for each resource not already present by URL.
 * Preserves existing notes structure (newlines); does not rewrite unrelated text.
 */
export function mergeAbsorbedExternalNotes(
  existingNotes: string | null | undefined,
  resources: readonly ExternalLinkAbsorbInput[],
): string | null {
  // Preserve paragraph structure in existing notes (do not collapse whitespace).
  let notes =
    typeof existingNotes === "string" ? existingNotes.replace(/\s+$/g, "").replace(/^\s+/g, "") : "";
  for (const r of resources || []) {
    const block = formatAbsorbedExternalNoteBlock(r);
    if (!block) continue;
    const url = cleanAbsorbText(r.url);
    if (url && localNotesContainExternalUrl(notes, url)) continue;
    notes = notes ? `${notes}\n\n${block}` : block;
  }
  return notes || null;
}

/**
 * Local-files stub for an external link (used alongside external_resource_ids).
 */
export function formatAbsorbedExternalLocalFile(input: ExternalLinkAbsorbInput): {
  name: string;
  excerpt: string;
} | null {
  const block = formatAbsorbedExternalNoteBlock(input);
  if (!block) return null;
  const title = cleanAbsorbText(input.title) || cleanAbsorbText(input.url) || "link";
  return {
    name: `[external] ${title.slice(0, 80)}`,
    excerpt: block,
  };
}

/**
 * Build a prompt snippet that lists URLs and instructs the model to consult
 * them just-in-time for domain substance (no live fetch required).
 */
export function buildExternalUrlJitBiasSnippet(
  resources: readonly ExternalLinkAbsorbInput[],
): string | null {
  const lines: string[] = [];
  const seen = new Set<string>();
  for (const r of resources || []) {
    const url = cleanAbsorbText(r.url);
    if (!url || !isValidHttpUrl(url)) continue;
    const key = url.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const title = cleanAbsorbText(r.title) || url;
    const desc = cleanAbsorbText(r.description);
    const body = normalizeLinkBodyText(r.body, 800);
    lines.push(
      desc
        ? `- ${title} — ${url} (${desc.slice(0, 160)})`
        : `- ${title} — ${url}`,
    );
    if (body) {
      lines.push(`  Body excerpt: ${body.slice(0, 500)}${body.length > 500 ? "…" : ""}`);
    }
    if (lines.length >= 24) break;
  }
  if (!lines.length) return null;
  return [
    "## External URL resources — consult just-in-time",
    "When you need domain substance, examples, definitions, or facts for this workspace/block, **use the fetched body excerpts below when present**, otherwise look into / consult these provided URLs (prefer them over inventing details). Use titles and summaries as hints; treat the linked pages as authoritative context for generation.",
    ...lines,
  ].join("\n");
}

/**
 * Absorb external resources into a block local_context:
 * - structured notes (title + URL + summary)
 * - [external] local_files stubs with the same text
 * - external_resource_ids when ids are provided
 * Does not touch block title/description (caller preserves those).
 */
export function absorbExternalResourcesIntoLocalContext(
  existing: {
    notes?: string | null;
    local_files?: Array<{ name: string; excerpt?: string | null }> | null;
    global_file_refs?: string[] | null;
    external_resource_ids?: string[] | null;
  } | null | undefined,
  resources: readonly ExternalLinkAbsorbInput[],
): {
  notes: string | null;
  local_files: Array<{ name: string; excerpt?: string | null }> | null;
  global_file_refs: string[] | null;
  external_resource_ids: string[] | null;
} {
  const notes = mergeAbsorbedExternalNotes(existing?.notes, resources);
  const files = [...(existing?.local_files || [])];
  const seenNames = new Set(files.map((f) => f.name.toLowerCase()));
  for (const r of resources || []) {
    const stub = formatAbsorbedExternalLocalFile(r);
    if (!stub) continue;
    const key = stub.name.toLowerCase();
    if (seenNames.has(key)) {
      // Refresh excerpt if URL was already attached with thinner text
      const idx = files.findIndex((f) => f.name.toLowerCase() === key);
      if (idx >= 0 && (!files[idx].excerpt || files[idx].excerpt!.length < stub.excerpt.length)) {
        files[idx] = stub;
      }
      continue;
    }
    seenNames.add(key);
    files.push(stub);
  }
  const ids = [...(existing?.external_resource_ids || [])];
  const seenIds = new Set(ids);
  for (const r of resources || []) {
    const id = cleanAbsorbText(r.id);
    if (!id || seenIds.has(id)) continue;
    seenIds.add(id);
    ids.push(id);
  }
  const refs = [...(existing?.global_file_refs || [])].filter(Boolean);
  return {
    notes,
    local_files: files.length ? files : null,
    global_file_refs: refs.length ? refs : null,
    external_resource_ids: ids.length ? ids : null,
  };
}

/**
 * Apply a partial update onto an existing resource (pure).
 * Invalid URL returns null.
 */
export function applyExternalResourceUpdate(
  existing: WorkspaceExternalResource,
  patch: ExternalResourceUpdateInput,
): WorkspaceExternalResource | null {
  const nextUrl =
    typeof patch.url === "string" ? patch.url.trim().slice(0, URL_MAX) : existing.url;
  if (!isValidHttpUrl(nextUrl)) return null;
  const nextTitle =
    typeof patch.title === "string" && patch.title.trim()
      ? patch.title.replace(/\s+/g, " ").trim().slice(0, TITLE_MAX)
      : existing.title;
  const nextDesc =
    patch.description === undefined
      ? existing.description
      : typeof patch.description === "string" && patch.description.trim()
        ? patch.description.trim().slice(0, DESC_MAX)
        : null;
  const nextType =
    patch.resource_type === undefined
      ? existing.resource_type
      : typeof patch.resource_type === "string" && patch.resource_type.trim()
        ? patch.resource_type.trim().slice(0, 64)
        : null;
  const nextMeta =
    patch.meta && typeof patch.meta === "object" && !Array.isArray(patch.meta)
      ? patch.meta
      : existing.meta;
  const nextSort =
    typeof patch.sort_order === "number" && Number.isFinite(patch.sort_order)
      ? Math.floor(patch.sort_order)
      : existing.sort_order;

  return {
    ...existing,
    title: nextTitle,
    url: nextUrl,
    description: nextDesc,
    resource_type: nextType,
    meta: nextMeta,
    sort_order: nextSort,
  };
}

/** Remove by id (pure list). */
export function deleteExternalResourceFromList(
  list: readonly WorkspaceExternalResource[],
  id: string,
): WorkspaceExternalResource[] {
  return list.filter((r) => r.id !== id);
}

/** Insert/replace by id (pure list). */
export function upsertExternalResourceInList(
  list: readonly WorkspaceExternalResource[],
  item: WorkspaceExternalResource,
): WorkspaceExternalResource[] {
  const without = list.filter((r) => r.id !== item.id);
  return normalizeExternalResourceList([...without, item]);
}
