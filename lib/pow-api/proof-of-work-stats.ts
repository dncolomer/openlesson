import type { SupabaseClient } from "@supabase/supabase-js";
import {
  WORKSPACE_PROOF_OF_WORK_TYPES,
  type WorkspaceProofOfWorkType,
} from "@/lib/pow-api/workspace-proof-of-work";
import {
  classifyPowQuality,
  matchesPowQualityFilter,
  type PowQualityFilter,
} from "@/lib/pow-api/pow-quality";

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
  metadata?: unknown;
  user_id?: string | null;
  guest_user_id?: string | null;
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
  quality: "scored" | "practice" | "impure" | "invalidated";
}

export interface ProofOfWorkSubjectBreakdown {
  /** Stable key for UI filter: `user:<id>`, `guest:<id>`, or `unknown`. */
  key: string;
  user_id: string | null;
  guest_user_id: string | null;
  label: string;
  count: number;
}

export interface WorkspaceProofOfWorkStats {
  workspace_id: string;
  generated_at: string;
  total_artifacts: number;
  sampled_artifacts: number;
  sample_capped: boolean;
  /** Sample counts by quality (before subject/quality UI filter). */
  scored_artifacts: number;
  practice_artifacts: number;
  impure_artifacts: number;
  /** Manually invalidated (metadata.invalidated) — not counted as impure. */
  invalidated_artifacts: number;
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
  subjects: ProofOfWorkSubjectBreakdown[];
  /** Echo of filters used for the detail aggregates (quality breakdown always unfiltered sample). */
  filters: {
    quality: PowQualityFilter;
    subject_key: string;
    block_id?: string | null;
  };
}

export type ProofOfWorkStatsFilters = {
  quality?: PowQualityFilter;
  /** Subject key from subjects[], or "all". */
  subjectKey?: string;
  /** When subjectKey is "me", match this authenticated user id. */
  currentUserId?: string | null;
  /** Optional: only artifacts for this block (learner Progress drawer). */
  blockId?: string | null;
};

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

export function subjectKeyForRow(row: {
  user_id?: string | null;
  guest_user_id?: string | null;
}): string {
  if (row.guest_user_id) return `guest:${row.guest_user_id}`;
  if (row.user_id) return `user:${row.user_id}`;
  return "unknown";
}

export function subjectLabelForRow(row: {
  user_id?: string | null;
  guest_user_id?: string | null;
}): string {
  if (row.guest_user_id) {
    const short = row.guest_user_id.slice(0, 8);
    return `Guest ${short}`;
  }
  if (row.user_id) {
    const short = row.user_id.slice(0, 8);
    return `User ${short}`;
  }
  return "Unknown subject";
}

function matchesSubjectFilter(
  row: ProofOfWorkStatsRow,
  subjectKey: string,
  currentUserId?: string | null,
): boolean {
  if (!subjectKey || subjectKey === "all") return true;
  if (subjectKey === "me") {
    if (!currentUserId) return false;
    return row.user_id === currentUserId && !row.guest_user_id;
  }
  return subjectKeyForRow(row) === subjectKey;
}

export function aggregateProofOfWorkStats(
  workspaceId: string,
  totalArtifacts: number,
  rows: ProofOfWorkStatsRow[],
  filters: ProofOfWorkStatsFilters = {},
): WorkspaceProofOfWorkStats {
  const qualityFilter: PowQualityFilter = filters.quality || "all";
  const subjectKey = filters.subjectKey || "all";

  let scored_artifacts = 0;
  let practice_artifacts = 0;
  let impure_artifacts = 0;
  let invalidated_artifacts = 0;
  const subjectMap = new Map<string, ProofOfWorkSubjectBreakdown>();

  for (const row of rows) {
    const quality = classifyPowQuality(row.metadata);
    if (quality === "scored") scored_artifacts += 1;
    else if (quality === "practice") practice_artifacts += 1;
    else if (quality === "invalidated") invalidated_artifacts += 1;
    else impure_artifacts += 1;

    const key = subjectKeyForRow(row);
    const existing = subjectMap.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      subjectMap.set(key, {
        key,
        user_id: row.user_id ?? null,
        guest_user_id: row.guest_user_id ?? null,
        label: subjectLabelForRow(row),
        count: 1,
      });
    }
  }

  const blockId =
    typeof filters.blockId === "string" && filters.blockId.trim()
      ? filters.blockId.trim()
      : null;

  const filtered = rows.filter(
    (row) =>
      matchesPowQualityFilter(row.metadata, qualityFilter) &&
      matchesSubjectFilter(row, subjectKey, filters.currentUserId) &&
      (!blockId || row.block_id === blockId),
  );

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

  for (const row of filtered) {
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

  const recent = [...filtered]
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
      quality: classifyPowQuality(row.metadata),
    }));

  const subjects = Array.from(subjectMap.values()).sort(
    (a, b) => b.count - a.count || a.label.localeCompare(b.label),
  );

  return {
    workspace_id: workspaceId,
    generated_at: new Date().toISOString(),
    total_artifacts: totalArtifacts,
    sampled_artifacts: rows.length,
    sample_capped: totalArtifacts > rows.length,
    scored_artifacts,
    practice_artifacts,
    impure_artifacts,
    invalidated_artifacts,
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
    subjects,
    filters: {
      quality: qualityFilter,
      subject_key: subjectKey,
      block_id: blockId,
    },
  };
}

export async function loadWorkspaceProofOfWorkStats(
  supabase: SupabaseClient,
  workspaceId: string,
  options?: {
    userId?: string | null;
    restrictToUser?: boolean;
    quality?: PowQualityFilter;
    subjectKey?: string;
    currentUserId?: string | null;
    blockId?: string | null;
  },
): Promise<WorkspaceProofOfWorkStats> {
  const blockId =
    typeof options?.blockId === "string" && options.blockId.trim()
      ? options.blockId.trim()
      : null;

  let countQuery = supabase
    .from("workspace_proof_of_work")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId);

  let rowsQuery = supabase
    .from("workspace_proof_of_work")
    .select(
      "proof_of_work_type, tool_name, tool_action, block_id, session_id, file_size, mime_type, device_name, timestamp_ms, created_at, metadata, user_id, guest_user_id",
    )
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(POW_STATS_SAMPLE_LIMIT);

  if (options?.restrictToUser && options.userId) {
    countQuery = countQuery.eq("user_id", options.userId);
    rowsQuery = rowsQuery.eq("user_id", options.userId);
  }
  if (blockId) {
    countQuery = countQuery.eq("block_id", blockId);
    rowsQuery = rowsQuery.eq("block_id", blockId);
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
    (rowsRes.data || []) as ProofOfWorkStatsRow[],
    {
      quality: options?.quality,
      subjectKey: options?.subjectKey,
      currentUserId: options?.currentUserId ?? options?.userId,
      blockId,
    },
  );
}

export function formatProofOfWorkBytes(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
