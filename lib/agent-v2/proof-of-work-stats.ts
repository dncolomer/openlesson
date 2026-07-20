import type { SupabaseClient } from "@supabase/supabase-js";
import {
  WORKSPACE_PROOF_OF_WORK_TYPES,
  type WorkspaceProofOfWorkType,
} from "@/lib/agent-v2/workspace-proof-of-work";

/** Max rows scanned for breakdowns. Exact total still uses a head count. */
export const POW_STATS_SAMPLE_LIMIT = 2000;

export interface ProofOfWorkStatsRow {
  proof_of_work_type: string | null;
  tool_name: string | null;
  tool_action: string | null;
  block_id: string | null;
  session_id: string | null;
  file_size: number | null;
  mime_type: string | null;
  device_name: string | null;
  timestamp_ms: number | null;
  created_at: string;
}

export interface ProofOfWorkTypeBreakdown {
  type: WorkspaceProofOfWorkType | "other";
  count: number;
}

export interface ProofOfWorkToolBreakdown {
  tool_name: string;
  count: number;
}

export interface ProofOfWorkRecentEvent {
  type: string;
  tool_name: string | null;
  tool_action: string | null;
  block_id: string | null;
  session_id: string | null;
  file_size: number | null;
  created_at: string;
  timestamp_ms: number | null;
}

export interface WorkspaceProofOfWorkStats {
  workspace_id: string;
  generated_at: string;
  total_artifacts: number;
  sampled_artifacts: number;
  sample_capped: boolean;
  by_type: ProofOfWorkTypeBreakdown[];
  unique_sessions: number;
  unique_blocks: number;
  unique_tools: number;
  with_block: number;
  without_block: number;
  total_bytes: number;
  avg_bytes: number | null;
  first_at: string | null;
  last_at: string | null;
  last_24h: number;
  last_7d: number;
  top_tools: ProofOfWorkToolBreakdown[];
  recent: ProofOfWorkRecentEvent[];
}

function emptyByType(): ProofOfWorkTypeBreakdown[] {
  return WORKSPACE_PROOF_OF_WORK_TYPES.map((type) => ({ type, count: 0 }));
}

function asTypeKey(value: string | null | undefined): WorkspaceProofOfWorkType | "other" {
  if (value && (WORKSPACE_PROOF_OF_WORK_TYPES as readonly string[]).includes(value)) {
    return value as WorkspaceProofOfWorkType;
  }
  return "other";
}

function eventTimeMs(row: ProofOfWorkStatsRow): number {
  if (typeof row.timestamp_ms === "number" && Number.isFinite(row.timestamp_ms)) {
    return row.timestamp_ms;
  }
  const parsed = Date.parse(row.created_at);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function aggregateProofOfWorkStats(
  workspaceId: string,
  totalArtifacts: number,
  rows: ProofOfWorkStatsRow[]
): WorkspaceProofOfWorkStats {
  const byTypeMap = new Map<WorkspaceProofOfWorkType | "other", number>();
  for (const type of WORKSPACE_PROOF_OF_WORK_TYPES) byTypeMap.set(type, 0);

  const sessions = new Set<string>();
  const blocks = new Set<string>();
  const tools = new Map<string, number>();
  let withBlock = 0;
  let withoutBlock = 0;
  let totalBytes = 0;
  let sizeCount = 0;
  let firstMs: number | null = null;
  let lastMs: number | null = null;
  let firstAt: string | null = null;
  let lastAt: string | null = null;

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  let last24h = 0;
  let last7d = 0;

  for (const row of rows) {
    const typeKey = asTypeKey(row.proof_of_work_type);
    byTypeMap.set(typeKey, (byTypeMap.get(typeKey) || 0) + 1);

    if (row.session_id) sessions.add(row.session_id);
    if (row.block_id) {
      blocks.add(row.block_id);
      withBlock += 1;
    } else {
      withoutBlock += 1;
    }

    if (row.tool_name?.trim()) {
      const name = row.tool_name.trim();
      tools.set(name, (tools.get(name) || 0) + 1);
    }

    if (typeof row.file_size === "number" && Number.isFinite(row.file_size) && row.file_size >= 0) {
      totalBytes += row.file_size;
      sizeCount += 1;
    }

    const t = eventTimeMs(row);
    if (t > 0) {
      if (firstMs === null || t < firstMs) {
        firstMs = t;
        firstAt = new Date(t).toISOString();
      }
      if (lastMs === null || t > lastMs) {
        lastMs = t;
        lastAt = new Date(t).toISOString();
      }
      if (now - t <= dayMs) last24h += 1;
      if (now - t <= 7 * dayMs) last7d += 1;
    }
  }

  const by_type: ProofOfWorkTypeBreakdown[] = [
    ...emptyByType().map((entry) => ({
      type: entry.type,
      count: byTypeMap.get(entry.type) || 0,
    })),
  ];
  const otherCount = byTypeMap.get("other") || 0;
  if (otherCount > 0) by_type.push({ type: "other", count: otherCount });

  const top_tools = Array.from(tools.entries())
    .map(([tool_name, count]) => ({ tool_name, count }))
    .sort((a, b) => b.count - a.count || a.tool_name.localeCompare(b.tool_name))
    .slice(0, 8);

  const recent = [...rows]
    .sort((a, b) => eventTimeMs(b) - eventTimeMs(a))
    .slice(0, 12)
    .map((row) => ({
      type: row.proof_of_work_type || "unknown",
      tool_name: row.tool_name,
      tool_action: row.tool_action,
      block_id: row.block_id,
      session_id: row.session_id,
      file_size: row.file_size,
      created_at: row.created_at,
      timestamp_ms: row.timestamp_ms,
    }));

  return {
    workspace_id: workspaceId,
    generated_at: new Date().toISOString(),
    total_artifacts: totalArtifacts,
    sampled_artifacts: rows.length,
    sample_capped: totalArtifacts > rows.length,
    by_type,
    unique_sessions: sessions.size,
    unique_blocks: blocks.size,
    unique_tools: tools.size,
    with_block: withBlock,
    without_block: withoutBlock,
    total_bytes: totalBytes,
    avg_bytes: sizeCount > 0 ? Math.round(totalBytes / sizeCount) : null,
    first_at: firstAt,
    last_at: lastAt,
    last_24h: last24h,
    last_7d: last7d,
    top_tools,
    recent,
  };
}

export async function loadWorkspaceProofOfWorkStats(
  supabase: SupabaseClient,
  workspaceId: string,
  options?: { userId?: string | null; restrictToUser?: boolean }
): Promise<WorkspaceProofOfWorkStats> {
  let countQuery = supabase
    .from("workspace_proof_of_work")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId);

  let rowsQuery = supabase
    .from("workspace_proof_of_work")
    .select(
      "proof_of_work_type, tool_name, tool_action, block_id, session_id, file_size, mime_type, device_name, timestamp_ms, created_at"
    )
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(POW_STATS_SAMPLE_LIMIT);

  if (options?.restrictToUser && options.userId) {
    countQuery = countQuery.eq("user_id", options.userId);
    rowsQuery = rowsQuery.eq("user_id", options.userId);
  }

  const [countRes, rowsRes] = await Promise.all([countQuery, rowsQuery]);

  if (countRes.error) {
    throw new Error(countRes.error.message || "Failed to count proof of work");
  }
  if (rowsRes.error) {
    throw new Error(rowsRes.error.message || "Failed to load proof of work");
  }

  return aggregateProofOfWorkStats(
    workspaceId,
    countRes.count ?? 0,
    (rowsRes.data || []) as ProofOfWorkStatsRow[]
  );
}

export function formatProofOfWorkBytes(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
