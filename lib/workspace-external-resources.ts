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
