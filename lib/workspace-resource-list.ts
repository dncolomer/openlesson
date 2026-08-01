/**
 * Pure builder for the unified Context notes + files + external sources list.
 * Order: external sources first, then notes, then files.
 */

import type { WorkspaceExternalResource } from "@/lib/workspace-external-resources";

export type WorkspaceFileListEntry = {
  id: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  created_at: string;
};

export type WorkspaceResourceListItem =
  | { kind: "external"; id: string; resource: WorkspaceExternalResource }
  | { kind: "notes"; id: "notes"; content: string }
  | ({ kind: "file" } & WorkspaceFileListEntry);

export type BuildWorkspaceResourceListOptions = {
  notes: string;
  files: readonly WorkspaceFileListEntry[];
  /** External sources (Dantes / add-link). Listed above notes. */
  externalResources?: readonly WorkspaceExternalResource[] | null;
  /** When false, omit the notes row (e.g. files-only mode). Default true. */
  includeNotes?: boolean;
  /** When false, omit file rows. Default true. */
  includeFiles?: boolean;
  /** When false, omit external rows. Default true. */
  includeExternal?: boolean;
};

/**
 * Build a single ordered list of resource items for the Context surface.
 * Order: external sources (when included), notes row, then files.
 */
export function buildWorkspaceResourceList(
  options: BuildWorkspaceResourceListOptions,
): WorkspaceResourceListItem[] {
  const includeNotes = options.includeNotes !== false;
  const includeFiles = options.includeFiles !== false;
  const includeExternal = options.includeExternal !== false;
  const items: WorkspaceResourceListItem[] = [];

  if (includeExternal) {
    for (const resource of options.externalResources || []) {
      if (!resource?.id) continue;
      items.push({
        kind: "external",
        id: resource.id,
        resource,
      });
    }
  }

  if (includeNotes) {
    items.push({
      kind: "notes",
      id: "notes",
      content: options.notes ?? "",
    });
  }

  if (includeFiles) {
    for (const file of options.files) {
      items.push({
        kind: "file",
        id: file.id,
        file_name: file.file_name,
        file_size: file.file_size,
        mime_type: file.mime_type,
        created_at: file.created_at,
      });
    }
  }

  return items;
}

/** Index of the first notes row (or -1). Used by tests for "external above notes". */
export function indexOfNotesInResourceList(
  items: readonly WorkspaceResourceListItem[],
): number {
  return items.findIndex((i) => i.kind === "notes");
}

/** True when every external item appears before the notes row (or notes omitted). */
export function externalResourcesAboveNotes(
  items: readonly WorkspaceResourceListItem[],
): boolean {
  const notesIdx = indexOfNotesInResourceList(items);
  if (notesIdx < 0) return true;
  for (let i = 0; i < items.length; i++) {
    if (items[i].kind === "external" && i > notesIdx) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Search + type filter (Context list)
// ---------------------------------------------------------------------------

export type WorkspaceResourceKind = WorkspaceResourceListItem["kind"];

/** Type filter for UI chips (files maps to kind "file"). */
export type WorkspaceResourceTypeFilter = "all" | "external" | "notes" | "files";

export const WORKSPACE_RESOURCE_TYPE_FILTERS: readonly WorkspaceResourceTypeFilter[] = [
  "all",
  "external",
  "notes",
  "files",
] as const;

/**
 * Normalize type filter from UI (files ↔ file kind).
 * Accepts "file" | "files" | "links" | "link" aliases.
 */
export function normalizeResourceTypeFilter(
  raw: unknown,
): WorkspaceResourceTypeFilter {
  const s = String(raw ?? "all")
    .toLowerCase()
    .trim();
  if (s === "external" || s === "link" || s === "links") return "external";
  if (s === "notes" || s === "note") return "notes";
  if (s === "file" || s === "files") return "files";
  return "all";
}

/** Primary searchable text for a list item. */
export function resourceListItemSearchText(item: WorkspaceResourceListItem): string {
  if (item.kind === "external") {
    const r = item.resource;
    return [r.title, r.url, r.description, r.resource_type, r.source]
      .filter(Boolean)
      .join(" ");
  }
  if (item.kind === "notes") {
    return ["notes", item.content].filter(Boolean).join(" ");
  }
  return [item.file_name, item.mime_type].filter(Boolean).join(" ");
}

function kindMatchesFilter(
  kind: WorkspaceResourceKind,
  filter: WorkspaceResourceTypeFilter,
): boolean {
  if (filter === "all") return true;
  if (filter === "files") return kind === "file";
  return kind === filter;
}

/**
 * Filter Context inventory by type + free-text query (case-insensitive substring).
 * Empty query does not restrict; type=all does not restrict.
 * Preserves input order.
 */
export function filterWorkspaceResourceList(
  items: readonly WorkspaceResourceListItem[],
  options: {
    query?: string | null;
    typeFilter?: WorkspaceResourceTypeFilter | string | null;
  } = {},
): WorkspaceResourceListItem[] {
  const query = String(options.query ?? "")
    .toLowerCase()
    .trim();
  const typeFilter = normalizeResourceTypeFilter(options.typeFilter);

  return items.filter((item) => {
    if (!kindMatchesFilter(item.kind, typeFilter)) return false;
    if (!query) return true;
    return resourceListItemSearchText(item).toLowerCase().includes(query);
  });
}

/** Cycle / set type filter from a chip id. */
export function nextResourceTypeFilter(
  current: WorkspaceResourceTypeFilter,
  clicked: unknown,
): WorkspaceResourceTypeFilter {
  const next = normalizeResourceTypeFilter(clicked);
  // Clicking the active filter again returns to all (except already all).
  if (next === current && next !== "all") return "all";
  return next;
}
