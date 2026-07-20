/**
 * Pure builder for the unified Workspace notes+files list.
 * Notes is a single list entry; each file is its own row — one scannable stream.
 */

export type WorkspaceFileListEntry = {
  id: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  created_at: string;
};

export type WorkspaceResourceListItem =
  | { kind: "notes"; id: "notes"; content: string }
  | ({ kind: "file" } & WorkspaceFileListEntry);

export type BuildWorkspaceResourceListOptions = {
  notes: string;
  files: readonly WorkspaceFileListEntry[];
  /** When false, omit the notes row (e.g. files-only mode). Default true. */
  includeNotes?: boolean;
  /** When false, omit file rows. Default true. */
  includeFiles?: boolean;
};

/**
 * Build a single ordered list of resource items for the Workspace section.
 * Order: notes row first (when included), then files in given order.
 */
export function buildWorkspaceResourceList(
  options: BuildWorkspaceResourceListOptions,
): WorkspaceResourceListItem[] {
  const includeNotes = options.includeNotes !== false;
  const includeFiles = options.includeFiles !== false;
  const items: WorkspaceResourceListItem[] = [];

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
