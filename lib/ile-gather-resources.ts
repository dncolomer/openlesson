/**
 * ILE Chapter "Gather resources": eligibility, consume, rate-limit, forage
 * input, job progress, and block-scoped planned-resource records.
 * Pure — tests drive these helpers with fixture PoW; no React/xAI client.
 */
import {
  countIlePowByType,
  emptyIlePowTypeCounts,
  ilePowCounterTotal,
  type IlePowCounterArtifact,
  type IlePowTypeCounts,
} from "@/lib/ile-pow-counters";
import {
  isValidHttpUrl,
  normalizeExternalResourceCreate,
  type ExternalResourceCreateInput,
  type WorkspaceExternalResource,
} from "@/lib/workspace-external-resources";

export const ILE_GATHER_RESOURCES_TOOL = "plan-resources" as const;

/**
 * Sessions store workspace_id on metadata, not a sessions.workspace_id column.
 * Gather persist must select this list — never `id, workspace_id`.
 */
export const ILE_GATHER_SESSION_PERSIST_SELECT = "id, metadata" as const;

/** Minimum available typed PoW. Video is never required (may be 0). */
export const ILE_GATHER_MIN_COUNTS: IlePowTypeCounts = {
  tool: 2,
  screen: 0,
  video: 0,
  eeg: 0,
};

/** Need a bit more than the tool floor so gather costs real work. */
export const ILE_GATHER_MIN_TOTAL = 3;

/** Base spend when a gather is allowed. Extra types spend 1 of the richest leftover. */
export const ILE_GATHER_CONSUME: IlePowTypeCounts = {
  tool: 2,
  screen: 0,
  video: 0,
  eeg: 0,
};

export const ILE_GATHER_RATE_LIMIT_MS = 90_000;
export const ILE_GATHER_MAX_PER_SESSION = 4;

export const ILE_GATHER_JOB_TOTAL_STEPS = 4;

export const ILE_GATHER_META_FLAG = "ile_gather";
export const ILE_GATHER_META_BLOCK_KEY = "block_id";
export const ILE_GATHER_POLICY_ID = "epistemic_edge" as const;

export const ILE_GATHER_FORAGE_POLICY =
  "Epistemic foraging: search for online resources at the edge of current work — information that reduces uncertainty about what the learner is doing, rather than chasing scores or repeating the same material.";

export const ILE_GATHER_INSUFFICIENT_POW_WARNING =
  "Not enough Proof of Work to gather resources. Work more PoW first — speak, use tools, capture screen or EEG — or forage manually inside the chapter tool as usual.";

export const ILE_GATHER_RATE_LIMIT_WARNING =
  "Gather resources was just used. Wait before foraging again, or forage manually inside the chapter tool as usual.";

export type IleGatherRefuseReason = "insufficient_pow" | "rate_limited";

export type IleGatherDecision = {
  allowed: boolean;
  reason: "ok" | IleGatherRefuseReason;
  warning: string | null;
  consume: IlePowTypeCounts;
  available: IlePowTypeCounts;
};

export type IleGatherForageInput = {
  blockId: string;
  chapterId: string;
  chapterDescription: string;
  promptModifier: string;
  powCounts: IlePowTypeCounts;
  powBaseline: Array<{
    type: string;
    tool_name?: string | null;
    tool_action?: string | null;
    chapter_id?: string | null;
  }>;
  policy: typeof ILE_GATHER_FORAGE_POLICY;
  policyId: typeof ILE_GATHER_POLICY_ID;
};

export type IleGatheredResourceDraft = {
  title: string;
  url: string;
  description: string;
  why_edge: string;
};

export type IleGatherJobStatus = "running" | "completed" | "error";

export type IleGatherJob = {
  id: string;
  status: IleGatherJobStatus;
  label: string;
  completed: number;
  total: number;
  blockId: string;
  openTool: typeof ILE_GATHER_RESOURCES_TOOL | null;
  error?: string | null;
};

export function availableIlePowCounts(
  total: IlePowTypeCounts,
  spent: IlePowTypeCounts,
): IlePowTypeCounts {
  return {
    tool: Math.max(0, total.tool - spent.tool),
    screen: Math.max(0, total.screen - spent.screen),
    video: Math.max(0, total.video - spent.video),
    eeg: Math.max(0, total.eeg - spent.eeg),
  };
}

export function ileGatherRateLimited(input: {
  lastGatherAt: number | null | undefined;
  gatherCount: number;
  now?: number;
}): boolean {
  const count = Math.max(0, Math.floor(input.gatherCount || 0));
  if (count >= ILE_GATHER_MAX_PER_SESSION) return true;
  const last = input.lastGatherAt;
  if (last == null || !Number.isFinite(last) || last <= 0) return false;
  const now = input.now ?? Date.now();
  return now - last < ILE_GATHER_RATE_LIMIT_MS;
}

/**
 * Spend: always the configured tool amount (when available), plus one extra
 * unit of the richest leftover non-required type (screen / eeg / video).
 */
export function computeIleGatherConsume(available: IlePowTypeCounts): IlePowTypeCounts {
  const consume = emptyIlePowTypeCounts();
  consume.tool = Math.min(ILE_GATHER_CONSUME.tool, Math.max(0, available.tool));
  const extras: Array<{ type: "screen" | "eeg" | "video"; leftover: number }> = [
    { type: "screen", leftover: Math.max(0, available.screen - ILE_GATHER_CONSUME.screen) },
    { type: "eeg", leftover: Math.max(0, available.eeg - ILE_GATHER_CONSUME.eeg) },
    { type: "video", leftover: Math.max(0, available.video - ILE_GATHER_CONSUME.video) },
  ];
  extras.sort((a, b) => b.leftover - a.leftover);
  const richest = extras[0];
  if (richest && richest.leftover > 0) {
    consume[richest.type] += 1;
  }
  return consume;
}

export function formatIleGatherInsufficientWarning(input: {
  reason: IleGatherRefuseReason;
}): string {
  if (input.reason === "rate_limited") return ILE_GATHER_RATE_LIMIT_WARNING;
  return ILE_GATHER_INSUFFICIENT_POW_WARNING;
}

export function decideIleGatherResources(input: {
  artifacts?: readonly IlePowCounterArtifact[] | null;
  counts?: IlePowTypeCounts | null;
  spent?: IlePowTypeCounts | null;
  lastGatherAt?: number | null;
  gatherCount?: number;
  now?: number;
}): IleGatherDecision {
  const total =
    input.counts ?? countIlePowByType(input.artifacts ?? []);
  const spent = input.spent ?? emptyIlePowTypeCounts();
  const available = availableIlePowCounts(total, spent);
  const rateLimited = ileGatherRateLimited({
    lastGatherAt: input.lastGatherAt,
    gatherCount: input.gatherCount ?? 0,
    now: input.now,
  });
  if (rateLimited) {
    return {
      allowed: false,
      reason: "rate_limited",
      warning: formatIleGatherInsufficientWarning({ reason: "rate_limited" }),
      consume: emptyIlePowTypeCounts(),
      available,
    };
  }
  const totalAvailable = ilePowCounterTotal(available);
  const enoughTypes = available.tool >= ILE_GATHER_MIN_COUNTS.tool;
  const enoughTotal = totalAvailable >= ILE_GATHER_MIN_TOTAL;
  if (!enoughTypes || !enoughTotal) {
    return {
      allowed: false,
      reason: "insufficient_pow",
      warning: formatIleGatherInsufficientWarning({ reason: "insufficient_pow" }),
      consume: emptyIlePowTypeCounts(),
      available,
    };
  }
  const consume = computeIleGatherConsume(available);
  if (consume.tool < ILE_GATHER_CONSUME.tool) {
    return {
      allowed: false,
      reason: "insufficient_pow",
      warning: formatIleGatherInsufficientWarning({ reason: "insufficient_pow" }),
      consume: emptyIlePowTypeCounts(),
      available,
    };
  }
  return {
    allowed: true,
    reason: "ok",
    warning: null,
    consume,
    available,
  };
}

export function applyIleGatherSpend(
  spent: IlePowTypeCounts,
  consume: IlePowTypeCounts,
): IlePowTypeCounts {
  return {
    tool: spent.tool + consume.tool,
    screen: spent.screen + consume.screen,
    video: spent.video + consume.video,
    eeg: spent.eeg + consume.eeg,
  };
}

export function refundIleGatherSpend(
  spent: IlePowTypeCounts,
  consume: IlePowTypeCounts,
): IlePowTypeCounts {
  return availableIlePowCounts(spent, consume);
}

export function describeIleGatherForagePolicy(): string {
  return ILE_GATHER_FORAGE_POLICY;
}

export function buildIleGatherForageInput(input: {
  artifacts?: readonly IlePowCounterArtifact[] | null;
  counts?: IlePowTypeCounts | null;
  promptModifier?: string | null;
  chapter: { id: string; description?: string | null };
  blockId: string;
}): IleGatherForageInput {
  const artifacts = input.artifacts ?? [];
  const powCounts = input.counts ?? countIlePowByType(artifacts);
  const baseline = artifacts.slice(0, 24).map((row) => ({
    type: String(row.type || row.proof_of_work_type || row.kind || "unknown"),
    tool_name: row.tool_name ?? null,
    tool_action: row.tool_action ?? null,
    chapter_id: row.chapter_id ?? null,
  }));
  return {
    blockId: String(input.blockId || "").trim(),
    chapterId: String(input.chapter.id || "").trim(),
    chapterDescription: String(input.chapter.description || "").trim(),
    promptModifier: String(input.promptModifier || "").trim(),
    powCounts,
    powBaseline: baseline,
    policy: ILE_GATHER_FORAGE_POLICY,
    policyId: ILE_GATHER_POLICY_ID,
  };
}

export function ileGatherForageSystemPrompt(): string {
  return `${ILE_GATHER_FORAGE_POLICY}

Return JSON: { "resources": [ { "title": "...", "url": "https://...", "description": "...", "why_edge": "..." } ] } with 3 to 5 https resources.
Each resource must sit at the epistemic edge of the learner's current Proof of Work — adjacent and useful, not the same page they already covered, not a quiz or score chase.`;
}

export function ileGatherForageUserPrompt(input: IleGatherForageInput): string {
  const modifier = input.promptModifier
    ? `\nLearner modifier: ${input.promptModifier}`
    : "";
  const baseline = input.powBaseline
    .map((row) => {
      const bits = [row.type, row.tool_name, row.tool_action, row.chapter_id].filter(Boolean);
      return `- ${bits.join(" / ")}`;
    })
    .join("\n");
  return `Block: ${input.blockId}
Chapter (${input.chapterId}): ${input.chapterDescription || "(untitled)"}
Proof of Work counts: tool=${input.powCounts.tool} screen=${input.powCounts.screen} video=${input.powCounts.video} eeg=${input.powCounts.eeg}
Policy: ${input.policy}
${baseline ? `Recent PoW baseline:\n${baseline}` : "Recent PoW baseline: (none)"}${modifier}

Find online resources at the edge of this work.`;
}

export function parseIleGatherForageResponse(data: unknown): IleGatheredResourceDraft[] {
  const root =
    data && typeof data === "object" ? (data as { resources?: unknown }) : null;
  const rows = Array.isArray(root?.resources) ? root.resources : [];
  const out: IleGatheredResourceDraft[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const url = typeof r.url === "string" ? r.url.trim() : "";
    if (!url || !isValidHttpUrl(url)) continue;
    const titleRaw = typeof r.title === "string" ? r.title.replace(/\s+/g, " ").trim() : "";
    let title = titleRaw;
    if (!title) {
      try {
        title = new URL(url).hostname || url;
      } catch {
        title = url;
      }
    }
    const description =
      typeof r.description === "string" ? r.description.trim() : "";
    const why =
      typeof r.why_edge === "string"
        ? r.why_edge.trim()
        : typeof r.whyEdge === "string"
          ? r.whyEdge.trim()
          : "";
    out.push({
      title: title.slice(0, 240),
      url,
      description: [description, why].filter(Boolean).join(" — ").slice(0, 2_000),
      why_edge: why.slice(0, 500),
    });
  }
  return out;
}

/**
 * Persist target for gathered resources. Reads metadata.workspace_id (or
 * workspaceId) and optional request body — never a sessions.workspace_id column.
 */
export function resolveIleGatherPersistWorkspaceId(input: {
  sessionRow?: { metadata?: unknown } | null;
  bodyWorkspaceId?: string | null;
}): string {
  const meta = input.sessionRow?.metadata;
  if (meta && typeof meta === "object" && !Array.isArray(meta)) {
    const rec = meta as Record<string, unknown>;
    const raw = rec.workspace_id ?? rec.workspaceId;
    if (typeof raw === "string" && raw.trim()) return raw.trim();
  }
  const body =
    typeof input.bodyWorkspaceId === "string" ? input.bodyWorkspaceId.trim() : "";
  return body;
}

export function ileGatherResourceMeta(input: {
  blockId: string;
  jobId: string;
  chapterId?: string | null;
}): Record<string, unknown> {
  return {
    [ILE_GATHER_META_FLAG]: true,
    [ILE_GATHER_META_BLOCK_KEY]: String(input.blockId || "").trim(),
    forage: ILE_GATHER_POLICY_ID,
    job_id: String(input.jobId || "").trim(),
    ...(input.chapterId ? { chapter_id: input.chapterId } : {}),
  };
}

export function toIleGatherExternalCreate(
  draft: IleGatheredResourceDraft,
  meta: Record<string, unknown>,
): ExternalResourceCreateInput | null {
  const normalized = normalizeExternalResourceCreate({
    title: draft.title,
    url: draft.url,
    description: draft.description || draft.why_edge || null,
    source: "link",
    resource_type: "ile_gather",
    meta,
  });
  if (!normalized) return null;
  return normalized;
}

export function isIleGatherResource(resource: {
  meta?: Record<string, unknown> | null;
  resource_type?: string | null;
}): boolean {
  if (resource.meta && resource.meta[ILE_GATHER_META_FLAG] === true) return true;
  return resource.resource_type === "ile_gather";
}

export function ileGatherResourceBlockId(resource: {
  meta?: Record<string, unknown> | null;
}): string | null {
  const raw = resource.meta?.[ILE_GATHER_META_BLOCK_KEY];
  if (typeof raw !== "string") return null;
  const id = raw.trim();
  return id || null;
}

/**
 * ILE planned-resources: only gather rows for this block.
 * Workspace (no block id): all rows, including persisted gather results.
 */
export function filterPlannedResourcesForIleBlock(
  resources: readonly WorkspaceExternalResource[],
  blockId: string | null | undefined,
): WorkspaceExternalResource[] {
  const bid = typeof blockId === "string" ? blockId.trim() : "";
  if (!bid) return [...resources];
  return resources.filter((row) => ileGatherResourceBlockId(row) === bid);
}

export function mergeIleGatherPlannedResources(input: {
  fetched: readonly WorkspaceExternalResource[];
  local: readonly WorkspaceExternalResource[];
  blockId: string | null | undefined;
}): WorkspaceExternalResource[] {
  const byId = new Map<string, WorkspaceExternalResource>();
  for (const row of [...input.fetched, ...input.local]) {
    if (!row?.id) continue;
    byId.set(row.id, row);
  }
  return filterPlannedResourcesForIleBlock([...byId.values()], input.blockId);
}

export function buildIleGatherPowArtifact(input: {
  jobId: string;
  blockId: string;
  chapterId?: string | null;
  consume: IlePowTypeCounts;
}): IlePowCounterArtifact {
  return {
    type: "tool",
    tool_name: "gather-resources",
    tool_action: "epistemic-forage",
    block_id: input.blockId,
    chapter_id: input.chapterId ?? null,
    metadata: {
      consume: input.consume,
      policy: ILE_GATHER_POLICY_ID,
      job_id: input.jobId,
    },
  };
}

export function createIleGatherJobId(seed: string | number): string {
  return `ile-gather-${String(seed)}`;
}

export function createIleGatherJob(input: {
  id: string;
  blockId: string;
  label?: string | null;
}): IleGatherJob {
  const labelRaw = typeof input.label === "string" ? input.label.trim() : "";
  return {
    id: String(input.id || "").trim() || createIleGatherJobId("anon"),
    status: "running",
    label: labelRaw ? labelRaw.slice(0, 48) : "Gathering resources…",
    completed: 0,
    total: ILE_GATHER_JOB_TOTAL_STEPS,
    blockId: String(input.blockId || "").trim(),
    openTool: null,
    error: null,
  };
}

export function upsertIleGatherJob(
  jobs: readonly IleGatherJob[],
  job: IleGatherJob,
): IleGatherJob[] {
  const without = (jobs || []).filter((j) => j.id !== job.id);
  return [...without, job];
}

export function patchIleGatherJob(
  jobs: readonly IleGatherJob[],
  jobId: string,
  patch: Partial<
    Pick<IleGatherJob, "completed" | "status" | "error" | "label" | "openTool">
  >,
): IleGatherJob[] {
  return (jobs || []).map((j) => {
    if (j.id !== jobId) return j;
    const next: IleGatherJob = { ...j, ...patch };
    if (typeof patch.completed === "number") {
      next.completed = Math.min(
        next.total,
        Math.max(0, Math.floor(patch.completed)),
      );
    }
    return next;
  });
}

export function ileGatherProgressFraction(job: {
  completed: number;
  total: number;
}): number {
  const total = Math.max(1, job.total);
  return Math.max(0, Math.min(1, job.completed / total));
}

export function ileGatherJobShowsFinishLink(job: Pick<IleGatherJob, "status" | "openTool">): boolean {
  return job.status === "completed" && job.openTool === ILE_GATHER_RESOURCES_TOOL;
}

export function ileGatherFinishOpensTool(): typeof ILE_GATHER_RESOURCES_TOOL {
  return ILE_GATHER_RESOURCES_TOOL;
}

export function completeIleGatherJob(
  jobs: readonly IleGatherJob[],
  jobId: string,
): IleGatherJob[] {
  return patchIleGatherJob(jobs, jobId, {
    status: "completed",
    completed: ILE_GATHER_JOB_TOTAL_STEPS,
    openTool: ILE_GATHER_RESOURCES_TOOL,
    label: "Resources ready",
    error: null,
  });
}
