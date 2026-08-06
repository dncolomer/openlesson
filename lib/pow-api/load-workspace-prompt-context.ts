/**
 * Load workspace materials for TAP / ILE / TAPBench prompt assembly.
 * Server-side helper used by mint + generate-exercise routes so every entry
 * path sees inventory, topology, notes, files, and block-local context.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeUnusableCells } from "@/lib/map-ground-rules";
import {
  parseBlockLocalContext,
  type BlockLocalContextInput,
  type PromptBlockInventoryItem,
  type PromptExternalResourceItem,
  type WorkspaceFileContextItem,
} from "@/lib/prompt-workspace-context";

export type LoadedWorkspacePromptContext = {
  workspaceId: string;
  workspaceTitle: string | null;
  rootTopic: string | null;
  workspaceGoal: string | null;
  workspaceDescription: string | null;
  notes: string | null;
  files: WorkspaceFileContextItem[];
  /** Workspace external links (title/url/description). */
  externalResources: PromptExternalResourceItem[];
  blocks: PromptBlockInventoryItem[];
  unusableCells: Array<{ row: number; col: number }>;
  focusedBlockId: string | null;
  focusedBlockTitle: string | null;
  focusedBlockDescription: string | null;
  blockLocalContext: BlockLocalContextInput | null;
};

/**
 * Load prompt-facing workspace context from DB.
 * Prefer this over ad-hoc selects so TAPBench mint and exercise generation stay aligned.
 */
export async function loadWorkspacePromptContext(
  supabase: SupabaseClient,
  workspaceId: string,
  options?: { focusedBlockId?: string | null; fileLimit?: number },
): Promise<LoadedWorkspacePromptContext | null> {
  const id = String(workspaceId || "").trim();
  if (!id) return null;

  const { data: workspace, error: wsError } = await supabase
    .from("workspaces")
    .select(
      "id, title, root_topic, workspace_goal, description, notes, unusable_cells",
    )
    .eq("id", id)
    .maybeSingle();

  if (wsError || !workspace) return null;

  const focusedBlockId =
    typeof options?.focusedBlockId === "string" && options.focusedBlockId.trim()
      ? options.focusedBlockId.trim()
      : null;

  const { data: blockRows } = await supabase
    .from("blocks")
    .select(
      "id, title, description, status, is_start, position_x, position_y, span_w, span_h, shape_cells, next_block_ids, lock_until_block_ids, local_context",
    )
    .eq("workspace_id", id)
    .order("created_at", { ascending: true });

  const blocks: PromptBlockInventoryItem[] = (blockRows || []).map((n) => ({
    id: n.id,
    title: String(n.title || ""),
    description: (n as { description?: string | null }).description ?? null,
    status: (n as { status?: string | null }).status ?? null,
    is_start: (n as { is_start?: boolean | null }).is_start ?? null,
    position_x: (n as { position_x?: number | null }).position_x ?? null,
    position_y: (n as { position_y?: number | null }).position_y ?? null,
    span_w: (n as { span_w?: number | null }).span_w ?? null,
    span_h: (n as { span_h?: number | null }).span_h ?? null,
    shape_cells:
      (n as { shape_cells?: Array<{ dr: number; dc: number }> | null }).shape_cells ??
      null,
    next_block_ids: (n as { next_block_ids?: string[] | null }).next_block_ids ?? null,
    lock_until_block_ids:
      (n as { lock_until_block_ids?: string[] | null }).lock_until_block_ids ?? null,
    local_context: parseBlockLocalContext(
      (n as { local_context?: unknown }).local_context,
    ),
  }));

  const fileLimit = options?.fileLimit ?? 12;
  let files: WorkspaceFileContextItem[] = [];
  try {
    const { data: fileRows } = await supabase
      .from("workspace_files")
      .select("file_name, mime_type")
      .eq("workspace_id", id)
      .order("created_at", { ascending: false })
      .limit(fileLimit);
    files = (fileRows || [])
      .map((f: { file_name?: string | null; mime_type?: string | null }) => ({
        name: typeof f.file_name === "string" ? f.file_name.trim() : "",
        mime_type: f.mime_type ?? null,
      }))
      .filter((f) => f.name);
  } catch {
    files = [];
  }

  let externalResources: PromptExternalResourceItem[] = [];
  try {
    const { data: extRows, error: extError } = await supabase
      .from("workspace_external_resources")
      .select("id, title, url, description")
      .eq("workspace_id", id)
      .order("sort_order", { ascending: true })
      .limit(24);
    if (extError) {
      const msg = extError.message || "";
      if (!/schema cache|does not exist|workspace_external_resources/i.test(msg)) {
        console.error("[load-workspace-prompt-context] external resources:", extError);
      }
    } else {
      externalResources = (extRows || []).map(
        (r: {
          id?: string;
          title?: string | null;
          url?: string | null;
          description?: string | null;
        }) => ({
          id: r.id ?? null,
          title: r.title ?? null,
          url: r.url ?? null,
          description: r.description ?? null,
        }),
      );
    }
  } catch {
    externalResources = [];
  }

  const focused =
    (focusedBlockId && blocks.find((b) => b.id === focusedBlockId)) || null;

  return {
    workspaceId: id,
    workspaceTitle: workspace.title ?? null,
    rootTopic: workspace.root_topic ?? null,
    workspaceGoal: (workspace as { workspace_goal?: string | null }).workspace_goal ?? null,
    workspaceDescription:
      (workspace as { description?: string | null }).description ?? null,
    notes: (workspace as { notes?: string | null }).notes ?? null,
    files,
    externalResources,
    blocks,
    unusableCells: normalizeUnusableCells(
      (workspace as { unusable_cells?: unknown }).unusable_cells,
    ),
    focusedBlockId: focused?.id ?? focusedBlockId,
    focusedBlockTitle: focused?.title ?? null,
    focusedBlockDescription: focused?.description ?? null,
    blockLocalContext: focused?.local_context ?? null,
  };
}

/**
 * Resolve workspace id from a session row (metadata.workspace_id).
 */
export function workspaceIdFromSessionMetadata(
  metadata: Record<string, unknown> | null | undefined,
): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const raw = metadata.workspace_id ?? metadata.workspaceId;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

export function blockIdFromSessionMetadata(
  metadata: Record<string, unknown> | null | undefined,
): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const raw = metadata.block_id ?? metadata.blockId ?? metadata.focus_block_id;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}
