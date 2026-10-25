/**
 * Pure Data Studio helpers: flow/run filters, learning play-copy scope,
 * inspect payloads (vector + raw + PoW/transcripts), and 2D projection.
 * Tests drive these functions — do not re-implement in tests.
 */

import {
  FLOW_EMBEDDING_CHANNELS,
  FLOW_EMBEDDING_MODEL_ID,
  FLOW_EMBEDDING_PATH_TEXT_MODEL_ID,
  flowEmbeddingChannelLabel,
  flowEmbeddingModelIdForChannel,
  parseFlowEmbeddingChannel,
  recoverFlowEmbeddingRaw,
  reembedFlowRaw,
  type FlowEmbeddingChannel,
  type FlowKind,
  type FlowPowRow,
} from "@/lib/flow-embedding";
import {
  buildStudioProjectionView,
  type StudioProjectionPoint,
  type StudioRegionOverlayView,
} from "@/lib/admin/data-studio";
import {
  cosineSimilarity,
  l2Distance,
  parseProjectionAlgorithmId,
  projectTrajectoryAndRegions,
  projectVectors2D,
  PROJECTION_ALGORITHM_IDS,
  type JointProjectionResult,
  type Point2D,
  type ProjectionAlgorithmId,
  type RegionCentroidInput,
  type ScreenRect,
} from "@/lib/knowledge-config";
import { workspaceProductShell } from "@/lib/workspace-kind";

export const DATA_STUDIO_PRODUCTS = [
  "verification",
  "calibration",
  "learning",
] as const;

export type DataStudioProduct = (typeof DATA_STUDIO_PRODUCTS)[number];

export const DATA_STUDIO_PROJECTION_ALGORITHMS: readonly ProjectionAlgorithmId[] =
  PROJECTION_ALGORITHM_IDS;

export const DATA_STUDIO_SPACES = FLOW_EMBEDDING_CHANNELS;

export const DATA_STUDIO_SPACE_OPTIONS: ReadonlyArray<{
  id: FlowEmbeddingChannel;
  label: string;
}> = FLOW_EMBEDDING_CHANNELS.map((id) => ({
  id,
  label: flowEmbeddingChannelLabel(id),
}));

export type DataStudioSpace = FlowEmbeddingChannel;

export function parseDataStudioSpace(value: unknown): DataStudioSpace {
  return parseFlowEmbeddingChannel(value);
}

export function dataStudioSpaceLabel(space: DataStudioSpace | string): string {
  return flowEmbeddingChannelLabel(space);
}

export type DataStudioEmbeddingRow = {
  id: string;
  workspace_id?: string | null;
  flow_kind?: FlowKind | string | null;
  flow_id?: string | null;
  run_id?: string | null;
  identity?: string | null;
  vector: number[];
  vector_path_text?: number[];
  raw?: unknown;
  embedding_model_id?: string | null;
  created_at?: string | null;
  source?: string | null;
  user_id?: string | null;
  is_play_copy?: boolean | null;
  owner_user_id?: string | null;
  original_workspace_id?: string | null;
  workspace_title?: string | null;
};

export type DataStudioFilter = {
  /** Empty / null = all flows together. */
  flowId?: string | null;
  /** Multi-select. Empty = all flows. Combined with `flowId` when both are set. */
  flowIds?: readonly string[] | null;
  /** Empty / null = all runs of the selected flow (or all runs). */
  runId?: string | null;
  /** Multi-select. Empty = all runs. Combined with `runId` when both are set. */
  runIds?: readonly string[] | null;
  workspaceId?: string | null;
};

export type StudioSelectOption = {
  id: string;
  label: string;
  keywords?: string;
};

export type StudioTranscriptKind = "speech" | "dictate" | "thought" | "other";

export type StudioTranscriptEntry = {
  text: string;
  kind: StudioTranscriptKind;
  tool_name: string | null;
  tool_action: string | null;
};

export type DataStudioInspectPayload = {
  id: string;
  identity: string | null;
  flow_id: string | null;
  run_id: string | null;
  flow_kind: string | null;
  workspace_id: string | null;
  workspace_title: string | null;
  source: string | null;
  created_at: string | null;
  space: DataStudioSpace;
  embedding_model_id: string;
  vector: number[];
  raw: unknown;
  pow: FlowPowRow[];
  transcripts: string[];
  speech: string[];
  thoughts: string[];
};

export const STUDIO_INSPECT_WIDTH_MIN = 280;
export const STUDIO_INSPECT_WIDTH_DEFAULT = 440;
export const STUDIO_INSPECT_WIDTH_MAX = 960;
export const DASHBOARD_DATA_STUDIO_RUN_PATH = "/api/dashboard/data-studio/run";

export type LearningStudioWorkspace = {
  id: string;
  owner_user_id?: string | null;
  user_id?: string | null;
  is_play_copy?: boolean | null;
  original_workspace_id?: string | null;
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function parseDataStudioProduct(value: unknown): DataStudioProduct | null {
  if (value === "verification" || value === "calibration" || value === "learning") {
    return value;
  }
  return null;
}

export function dataStudioFlowKind(product: DataStudioProduct): FlowKind {
  if (product === "verification") return "verify";
  if (product === "calibration") return "calibrate";
  return "learn";
}

export function dataStudioProductLabel(product: DataStudioProduct): string {
  if (product === "verification") return "Verification";
  if (product === "calibration") return "Calibration";
  return "Learning";
}

export function uniqueStudioIds(values: readonly unknown[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const id = text(value);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function studioFilterFlowIds(filter: DataStudioFilter = {}): string[] {
  return uniqueStudioIds([...(filter.flowIds ?? []), filter.flowId]);
}

export function studioFilterRunIds(filter: DataStudioFilter = {}): string[] {
  return uniqueStudioIds([...(filter.runIds ?? []), filter.runId]);
}

export function studioOptionMatchesQuery(
  option: Pick<StudioSelectOption, "id" | "label" | "keywords">,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = `${option.id} ${option.label} ${option.keywords ?? ""}`.toLowerCase();
  return hay.includes(q);
}

export function pruneStudioSelectedIds(
  selected: readonly string[],
  available: readonly string[],
): string[] {
  const allow = new Set(available);
  const next = selected.filter((id) => allow.has(id));
  if (
    next.length === selected.length &&
    next.every((id, index) => id === selected[index])
  ) {
    return selected as string[];
  }
  return next;
}

export function studioCountPhrase(count: number, plural: string): string {
  if (count === 1 && plural.endsWith("s") && !plural.endsWith("ss")) {
    return `1 ${plural.slice(0, -1)}`;
  }
  return `${count} ${plural}`;
}

export function studioMultiSelectSummary(
  selected: readonly string[],
  options: readonly StudioSelectOption[],
  emptyLabel: string,
  plural: string,
  allLabel?: string,
  compact = false,
): string {
  if (selected.length === 0) return emptyLabel;
  if (
    allLabel &&
    options.length > 0 &&
    selected.length === options.length &&
    options.every((option) => selected.includes(option.id))
  ) {
    return allLabel;
  }
  if (compact) return studioCountPhrase(selected.length, plural);
  if (selected.length === 1) {
    return options.find((option) => option.id === selected[0])?.label ?? selected[0];
  }
  return studioCountPhrase(selected.length, plural);
}

export function studioVisibleRegionIds(
  available: readonly string[],
  hidden: readonly string[],
): string[] {
  const hide = new Set(uniqueStudioIds(hidden));
  return uniqueStudioIds(available).filter((id) => !hide.has(id));
}

export function studioHiddenRegionIdsFromVisible(
  available: readonly string[],
  visible: readonly string[],
): string[] {
  const show = new Set(uniqueStudioIds(visible));
  return uniqueStudioIds(available).filter((id) => !show.has(id));
}

export function toggleStudioSelectedId(
  selected: readonly string[],
  id: string,
): string[] {
  const next = text(id);
  if (!next) return uniqueStudioIds(selected);
  if (selected.includes(next)) return selected.filter((item) => item !== next);
  return uniqueStudioIds([...selected, next]);
}

export function filterStudioEmbeddings(
  rows: readonly DataStudioEmbeddingRow[],
  filter: DataStudioFilter = {},
): DataStudioEmbeddingRow[] {
  const flowIds = studioFilterFlowIds(filter);
  const runIds = studioFilterRunIds(filter);
  const workspaceId = text(filter.workspaceId);
  const flowSet = flowIds.length ? new Set(flowIds) : null;
  const runSet = runIds.length ? new Set(runIds) : null;
  return rows.filter((row) => {
    if (flowSet && !flowSet.has(text(row.flow_id))) return false;
    if (runSet && !runSet.has(text(row.run_id))) return false;
    if (workspaceId && text(row.workspace_id) !== workspaceId) return false;
    return true;
  });
}

export function studioFlowOptions(
  rows: readonly DataStudioEmbeddingRow[],
): Array<{ flowId: string; runCount: number; identities: string[] }> {
  const byFlow = new Map<string, { runs: Set<string>; identities: Set<string> }>();
  for (const row of rows) {
    const flowId = text(row.flow_id);
    if (!flowId) continue;
    let entry = byFlow.get(flowId);
    if (!entry) {
      entry = { runs: new Set(), identities: new Set() };
      byFlow.set(flowId, entry);
    }
    const runId = text(row.run_id);
    if (runId) entry.runs.add(runId);
    else entry.runs.add(row.id);
    const identity = text(row.identity);
    if (identity) entry.identities.add(identity);
  }
  return Array.from(byFlow.entries())
    .map(([flowId, entry]) => ({
      flowId,
      runCount: entry.runs.size,
      identities: Array.from(entry.identities).sort(),
    }))
    .sort((a, b) => a.flowId.localeCompare(b.flowId));
}

export function studioRunOptions(
  rows: readonly DataStudioEmbeddingRow[],
  flowId?: string | readonly string[] | null,
): Array<{ runId: string; identity: string | null; flowId: string | null }> {
  const wantFlows = uniqueStudioIds(Array.isArray(flowId) ? flowId : [flowId]);
  const flowSet = wantFlows.length ? new Set(wantFlows) : null;
  const scoped = flowSet
    ? rows.filter((row) => flowSet.has(text(row.flow_id)))
    : rows.slice();
  const byRun = new Map<string, { identity: string | null; flowId: string | null }>();
  for (const row of scoped) {
    const runId = text(row.run_id);
    if (!runId) continue;
    if (!byRun.has(runId)) {
      byRun.set(runId, {
        identity: text(row.identity) || null,
        flowId: text(row.flow_id) || null,
      });
    }
  }
  return Array.from(byRun.entries())
    .map(([runId, meta]) => ({ runId, identity: meta.identity, flowId: meta.flowId }))
    .sort((a, b) => a.runId.localeCompare(b.runId));
}

export function studioTranscriptKind(
  row: Pick<FlowPowRow, "type" | "tool_name" | "tool_action">,
): StudioTranscriptKind {
  const name = text(row.tool_name).toLowerCase();
  const action = text(row.tool_action).toLowerCase();
  const type = text(row.type).toLowerCase();
  if (action === "dictate") return "dictate";
  if (
    type === "speech" ||
    name.includes("speech") ||
    name === "transcript" ||
    action.startsWith("speech_")
  ) {
    return "speech";
  }
  if (name.includes("thought") || action.includes("stash") || action.includes("pause_finalize")) {
    return "thought";
  }
  return "other";
}

function parseJsonValue(value: string): unknown {
  if (!(value.startsWith("{") || value.startsWith("["))) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function collectTranscriptStrings(
  value: unknown,
  into: string[],
  seen: Set<string>,
  depth = 0,
): void {
  if (depth > 6 || value == null) return;
  if (typeof value === "string") {
    const next = value.trim();
    if (!next) return;
    const parsed = parseJsonValue(next);
    if (parsed != null) {
      collectTranscriptStrings(parsed, into, seen, depth + 1);
      return;
    }
    if (seen.has(next)) return;
    seen.add(next);
    into.push(next);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectTranscriptStrings(item, into, seen, depth + 1);
    return;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.text === "string" || typeof record.transcript_snapshot === "string") {
      collectTranscriptStrings(record.transcript_snapshot, into, seen, depth + 1);
      collectTranscriptStrings(record.transcript, into, seen, depth + 1);
      collectTranscriptStrings(record.text, into, seen, depth + 1);
      return;
    }
    for (const key of ["transcript_snapshot", "transcript", "text", "prompt", "speech", "dictation"]) {
      if (key in record) collectTranscriptStrings(record[key], into, seen, depth + 1);
    }
  }
}

export function extractStudioTranscriptEntries(
  pow: readonly FlowPowRow[] | null | undefined,
): StudioTranscriptEntry[] {
  const entries: StudioTranscriptEntry[] = [];
  const seen = new Set<string>();
  for (const row of pow ?? []) {
    const kind = studioTranscriptKind(row);
    const bucket: string[] = [];
    const local = new Set<string>();
    const meta =
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? row.metadata
        : null;
    const voiceKeys = ["transcript_snapshot", "transcript", "speech", "dictation"] as const;
    const extraKeys = ["text", "prompt"] as const;
    if (meta) {
      for (const key of voiceKeys) collectTranscriptStrings(meta[key], bucket, local);
      if (kind !== "other") {
        for (const key of extraKeys) collectTranscriptStrings(meta[key], bucket, local);
      }
    }
    if (kind !== "other") {
      collectTranscriptStrings(row.payload, bucket, local);
    } else {
      const parsed = typeof row.payload === "string" ? parseJsonValue(row.payload) : null;
      if (parsed && typeof parsed === "object") {
        collectTranscriptStrings(parsed, bucket, local);
      }
    }
    for (const line of bucket) {
      if (seen.has(line)) continue;
      seen.add(line);
      entries.push({
        text: line,
        kind,
        tool_name: text(row.tool_name) || null,
        tool_action: text(row.tool_action) || null,
      });
    }
  }
  return entries;
}

export function extractStudioTranscripts(pow: readonly FlowPowRow[] | null | undefined): string[] {
  return extractStudioTranscriptEntries(pow).map((entry) => entry.text);
}

export function extractStudioSpeechTranscripts(
  pow: readonly FlowPowRow[] | null | undefined,
): string[] {
  return extractStudioTranscriptEntries(pow)
    .filter((entry) => entry.kind === "speech" || entry.kind === "dictate")
    .map((entry) => entry.text);
}

function inspectFromPow(
  base: Omit<DataStudioInspectPayload, "pow" | "transcripts" | "speech" | "thoughts">,
  pow: FlowPowRow[],
): DataStudioInspectPayload {
  const entries = extractStudioTranscriptEntries(pow);
  return {
    ...base,
    pow,
    transcripts: entries.map((entry) => entry.text),
    speech: entries
      .filter((entry) => entry.kind === "speech" || entry.kind === "dictate")
      .map((entry) => entry.text),
    thoughts: entries
      .filter((entry) => entry.kind === "thought")
      .map((entry) => entry.text),
  };
}

export function inspectStudioEmbedding(
  row: DataStudioEmbeddingRow | null | undefined,
  space: DataStudioSpace | string = "path",
): DataStudioInspectPayload | null {
  if (!row || !text(row.id)) return null;
  const channel = parseDataStudioSpace(space);
  const recovered = recoverFlowEmbeddingRaw(row.raw);
  const pow = recovered?.pow ?? [];
  return inspectFromPow(
    {
      id: row.id,
      identity: text(row.identity) || null,
      flow_id: text(row.flow_id) || null,
      run_id: text(row.run_id) || null,
      flow_kind: text(row.flow_kind) || recovered?.flowKind || null,
      workspace_id: text(row.workspace_id) || null,
      workspace_title: text(row.workspace_title) || null,
      source: text(row.source) || null,
      created_at: text(row.created_at) || null,
      space: channel,
      embedding_model_id: flowEmbeddingModelIdForChannel(channel),
      vector: studioEmbeddingVector(row, channel),
      raw: recovered ?? row.raw ?? null,
    },
    pow,
  );
}

export function flowPowFromWorkspaceRow(row: {
  proof_of_work_type?: string | null;
  type?: string | null;
  tool_name?: string | null;
  tool_action?: string | null;
  timestamp_ms?: number | null;
  metadata?: unknown;
  file_name?: string | null;
}): FlowPowRow {
  const metadata =
    row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : null;
  return {
    type: text(row.proof_of_work_type || row.type) || "tool",
    tool_name: text(row.tool_name) || null,
    tool_action: text(row.tool_action) || null,
    timestamp_ms: Number.isFinite(Number(row.timestamp_ms)) ? Number(row.timestamp_ms) : null,
    payload: text(row.file_name) || null,
    metadata,
  };
}

export function mergeStudioInspectPow(
  inspect: DataStudioInspectPayload,
  extraPow: readonly FlowPowRow[],
): DataStudioInspectPayload {
  const pow = [...inspect.pow, ...extraPow];
  return inspectFromPow(inspect, pow);
}

export function clampStudioInspectWidth(width: number, max = STUDIO_INSPECT_WIDTH_MAX): number {
  if (!Number.isFinite(width)) return STUDIO_INSPECT_WIDTH_DEFAULT;
  const ceiling = Math.max(STUDIO_INSPECT_WIDTH_MIN, max);
  return Math.min(ceiling, Math.max(STUDIO_INSPECT_WIDTH_MIN, Math.round(width)));
}

/**
 * Learning Data Studio is play copies the viewer added. Authored maps stay
 * on Build. A missing owner on a play copy still belongs to the listed
 * workspace; authored rows are always excluded.
 */
export function includeLearningStudioEmbedding(input: {
  viewerUserId: string;
  workspace?: LearningStudioWorkspace | null;
  embedding: Pick<
    DataStudioEmbeddingRow,
    "flow_kind" | "user_id" | "workspace_id" | "is_play_copy" | "owner_user_id"
  >;
}): boolean {
  const viewer = text(input.viewerUserId);
  if (!viewer) return false;
  if (text(input.embedding.flow_kind) !== "learn") return false;

  const workspace = input.workspace;
  const owner = text(
    workspace?.owner_user_id || workspace?.user_id || input.embedding.owner_user_id,
  );
  if (owner && owner !== viewer) return false;

  return Boolean(workspace?.is_play_copy ?? input.embedding.is_play_copy);
}

export function scopeLearningStudioEmbeddings(
  rows: readonly DataStudioEmbeddingRow[],
  input: {
    viewerUserId: string;
    workspaces?: readonly LearningStudioWorkspace[];
  },
): DataStudioEmbeddingRow[] {
  const byId = new Map<string, LearningStudioWorkspace>();
  for (const workspace of input.workspaces ?? []) {
    const id = text(workspace.id);
    if (id) byId.set(id, workspace);
  }
  return rows.filter((row) => {
    const workspaceId = text(row.workspace_id);
    const workspace =
      (workspaceId ? byId.get(workspaceId) : null) ??
      ({
        id: workspaceId,
        owner_user_id: row.owner_user_id,
        is_play_copy: row.is_play_copy,
        original_workspace_id: row.original_workspace_id,
      } satisfies LearningStudioWorkspace);
    return includeLearningStudioEmbedding({
      viewerUserId: input.viewerUserId,
      workspace,
      embedding: row,
    });
  });
}

export function presentDashboardDataStudio(input: {
  product: DataStudioProduct;
  viewerUserId: string;
  workspaces: readonly {
    id?: unknown;
    title?: unknown;
    root_topic?: unknown;
    user_id?: unknown;
    workspace_kind?: unknown;
    is_play_copy?: boolean | null;
    original_workspace_id?: unknown;
  }[];
  embeddings: readonly DataStudioEmbeddingRow[];
  regions?: readonly RegionCentroidInput[];
}): {
  product: DataStudioProduct;
  flowKind: FlowKind;
  workspaces: Array<{ id: string; title: string; is_play_copy: boolean }>;
  embeddings: DataStudioEmbeddingRow[];
  regions: RegionCentroidInput[];
} {
  const flowKind = dataStudioFlowKind(input.product);
  const workspaces = input.workspaces
    .map((workspace) => {
      const id = text(workspace.id);
      if (!id) return null;
      const shell = workspaceProductShell(workspace.workspace_kind);
      if (input.product === "learning") {
        if (shell !== "learning") return null;
        if (!Boolean(workspace.is_play_copy)) return null;
      } else if (shell !== input.product) {
        return null;
      }
      if (text(workspace.user_id) && text(workspace.user_id) !== text(input.viewerUserId)) {
        return null;
      }
      return {
        id,
        title: text(workspace.title) || text(workspace.root_topic) || "Workspace",
        is_play_copy: Boolean(workspace.is_play_copy),
        owner_user_id: text(workspace.user_id) || input.viewerUserId,
        original_workspace_id: text(workspace.original_workspace_id) || null,
      };
    })
    .filter((row): row is NonNullable<typeof row> => !!row);

  const workspaceIds = new Set(workspaces.map((row) => row.id));
  const titleById = new Map(workspaces.map((row) => [row.id, row.title]));
  let embeddings = input.embeddings.filter((row) => {
    if (text(row.flow_kind) && text(row.flow_kind) !== flowKind) return false;
    const workspaceId = text(row.workspace_id);
    if (workspaceId && !workspaceIds.has(workspaceId)) return false;
    return true;
  });

  if (input.product === "learning") {
    embeddings = scopeLearningStudioEmbeddings(embeddings, {
      viewerUserId: input.viewerUserId,
      workspaces,
    });
  }

  embeddings = embeddings.map((row) => ({
    ...row,
    workspace_title: row.workspace_title || titleById.get(text(row.workspace_id)) || null,
  }));

  const regions = input.product === "learning" ? [] : [...(input.regions ?? [])];

  return {
    product: input.product,
    flowKind,
    workspaces: workspaces.map((row) => ({
      id: row.id,
      title: row.title,
      is_play_copy: row.is_play_copy,
    })),
    embeddings,
    regions,
  };
}

export function studioVectors(rows: readonly DataStudioEmbeddingRow[]): number[][] {
  return rows.map((row) => (Array.isArray(row.vector) ? row.vector : []));
}

export function studioRegionsForSpace(
  regions: readonly RegionCentroidInput[] | null | undefined,
  space: DataStudioSpace | string,
): RegionCentroidInput[] {
  const channel = parseDataStudioSpace(space);
  return (regions ?? []).filter((region) => {
    const model = text(region.embedding_model_id);
    if (channel === "path_text") {
      return model === FLOW_EMBEDDING_PATH_TEXT_MODEL_ID;
    }
    return !model || model === FLOW_EMBEDDING_MODEL_ID;
  });
}

export function studioEmbeddingVector(
  row: DataStudioEmbeddingRow,
  space: DataStudioSpace | string = "path",
  extraPow: readonly FlowPowRow[] = [],
): number[] {
  const channel = parseDataStudioSpace(space);
  const recovered = recoverFlowEmbeddingRaw(row.raw);
  if (recovered) {
    const pow =
      channel === "path_text" && extraPow.length
        ? [...recovered.pow, ...extraPow]
        : recovered.pow;
    return reembedFlowRaw({ ...recovered, pow }, channel);
  }
  if (channel === "path_text" && Array.isArray(row.vector_path_text) && row.vector_path_text.length) {
    return row.vector_path_text;
  }
  return Array.isArray(row.vector) ? row.vector : [];
}

export function projectStudioEmbeddings(input: {
  embeddings: readonly DataStudioEmbeddingRow[];
  regions?: readonly RegionCentroidInput[];
  algorithm?: ProjectionAlgorithmId | string;
  space?: DataStudioSpace | string;
}): JointProjectionResult {
  const algorithm = parseProjectionAlgorithmId(input.algorithm, "pca");
  const space = parseDataStudioSpace(input.space);
  const points = input.embeddings.map((row, index) => ({
    t: text(row.created_at) || row.id || String(index),
    as_of_ms: Date.parse(text(row.created_at)) || index,
    vector: studioEmbeddingVector(row, space),
    confidence: 1,
  }));
  return projectTrajectoryAndRegions({
    points,
    regions: studioRegionsForSpace(input.regions, space),
    algorithm,
  });
}

export function projectStudioEmbeddings2D(
  embeddings: readonly DataStudioEmbeddingRow[],
  algorithm: ProjectionAlgorithmId | string = "pca",
  space: DataStudioSpace | string = "path",
): Point2D[] {
  const channel = parseDataStudioSpace(space);
  return projectVectors2D(
    embeddings.map((row) => studioEmbeddingVector(row, channel)),
    parseProjectionAlgorithmId(algorithm, "pca"),
  );
}

export function buildDataStudioProjectionView(input: {
  embeddings: readonly DataStudioEmbeddingRow[];
  regions?: readonly RegionCentroidInput[];
  algorithm?: ProjectionAlgorithmId | string;
  space?: DataStudioSpace | string;
  screen?: ScreenRect;
}): {
  algorithm: ProjectionAlgorithmId;
  frame_id: string;
  coords: Array<StudioProjectionPoint & { id: string; identity: string | null; run_id: string | null; flow_id: string | null }>;
  regionOverlays: StudioRegionOverlayView[];
} {
  const space = parseDataStudioSpace(input.space);
  const points = input.embeddings.map((row, index) => ({
    t: row.id || String(index),
    as_of_ms: Date.parse(text(row.created_at)) || index,
    vector: studioEmbeddingVector(row, space),
    confidence: 1,
  }));
  const view = buildStudioProjectionView({
    points,
    regions: studioRegionsForSpace(input.regions, space),
    algorithm: input.algorithm,
    displayMode: "trajectory",
    screen: input.screen,
  });
  return {
    algorithm: view.algorithm,
    frame_id: view.frame_id,
    coords: view.coords.map((coord, index) => {
      const row = input.embeddings[index];
      return {
        ...coord,
        id: row?.id || String(index),
        identity: text(row?.identity) || null,
        run_id: text(row?.run_id) || null,
        flow_id: text(row?.flow_id) || null,
      };
    }),
    regionOverlays: view.regionOverlays,
  };
}

export function formatStudioHighDimDistance(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (value === 0) return "0";
  if (value >= 10) return value.toFixed(2);
  if (value >= 1) return value.toFixed(3);
  return value.toFixed(4);
}

export function hiddenStudioRegionIdSet(
  hiddenIds: ReadonlySet<string> | readonly string[] | null | undefined,
): Set<string> {
  if (hiddenIds instanceof Set) return hiddenIds;
  const list: readonly string[] = Array.isArray(hiddenIds) ? hiddenIds : [];
  return new Set(list.filter((id) => Boolean(text(id))));
}

export function visibleStudioRegions<T extends { id: string }>(
  regions: readonly T[] | null | undefined,
  hiddenIds: ReadonlySet<string> | readonly string[] | null | undefined,
): T[] {
  const hidden = hiddenStudioRegionIdSet(hiddenIds);
  return (regions ?? []).filter((region) => region.id && !hidden.has(region.id));
}

export function toggleStudioHiddenId(hiddenIds: readonly string[], id: string): string[] {
  const key = text(id);
  if (!key) return [...hiddenIds];
  return hiddenIds.includes(key)
    ? hiddenIds.filter((item) => item !== key)
    : [...hiddenIds, key];
}

export const DATA_STUDIO_REGION_QUERY = "region";

export function parseStudioFocusRegionId(value: unknown): string {
  return text(value);
}

export function hiddenStudioRegionIdsForFocus(
  regionIds: readonly string[],
  focusId: string | null | undefined,
): string[] {
  const focus = parseStudioFocusRegionId(focusId);
  if (!focus) return [];
  return regionIds.filter((id) => text(id) && text(id) !== focus);
}

export function studioPointInsideHighDimRegion(
  vector: number[],
  region: Pick<RegionCentroidInput, "centroid" | "cosine_threshold">,
): boolean {
  const centroid = Array.isArray(region.centroid) ? region.centroid : [];
  if (!Array.isArray(vector) || vector.length === 0 || vector.length !== centroid.length) {
    return false;
  }
  const threshold =
    typeof region.cosine_threshold === "number" && Number.isFinite(region.cosine_threshold)
      ? region.cosine_threshold
      : 0.5;
  return cosineSimilarity(vector, centroid) >= threshold;
}

export type StudioPointRegionMembership = {
  pointId: string;
  inRegion: boolean;
  regionIds: string[];
};

export function studioHighDimRegionMembership(input: {
  embeddings: readonly DataStudioEmbeddingRow[];
  regions: readonly RegionCentroidInput[];
  space?: DataStudioSpace | string;
  hiddenRegionIds?: ReadonlySet<string> | readonly string[] | null;
}): Map<string, StudioPointRegionMembership> {
  const space = parseDataStudioSpace(input.space);
  const regions = visibleStudioRegions(input.regions, input.hiddenRegionIds);
  const out = new Map<string, StudioPointRegionMembership>();
  for (const row of input.embeddings) {
    const vector = studioEmbeddingVector(row, space);
    const regionIds = regions
      .filter((region) => studioPointInsideHighDimRegion(vector, region))
      .map((region) => region.id);
    out.set(row.id, {
      pointId: row.id,
      inRegion: regionIds.length > 0,
      regionIds,
    });
  }
  return out;
}

/** Phosphor fill for high-dim cosine membership (not the 2D disk). */
export const STUDIO_IN_REGION_FILL = "#00ffc2";
export const STUDIO_OUT_REGION_FILL = "rgba(255,255,255,0.16)";
export const STUDIO_IN_REGION_STROKE = "#031410";

export function workspaceStudioHrefForRegion(workspaceId: string, regionId: string): string {
  const id = String(workspaceId || "").trim();
  const region = parseStudioFocusRegionId(regionId);
  const params = new URLSearchParams({ section: "data_studio" });
  if (region) params.set(DATA_STUDIO_REGION_QUERY, region);
  return `/workspace/${id}?${params.toString()}`;
}

export type StudioRegionDistanceRay = {
  pointId: string;
  regionId: string;
  regionName: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  labelX: number;
  labelY: number;
  /** L2 in embedding space (flowcfg-d96), not the 2D projection. */
  highDimL2: number;
  /** Cosine membership vs the region's cosine_threshold. */
  inRegion: boolean;
  selected: boolean;
};

export function buildStudioRegionDistanceRays(input: {
  embeddings: readonly DataStudioEmbeddingRow[];
  coords: readonly { id: string; screenX: number; screenY: number }[];
  regionOverlays: readonly { id: string; name: string; screenX: number; screenY: number }[];
  regions: readonly RegionCentroidInput[];
  space?: DataStudioSpace | string;
  hiddenRegionIds?: ReadonlySet<string> | readonly string[] | null;
  selectedPointId?: string | null;
}): StudioRegionDistanceRay[] {
  const space = parseDataStudioSpace(input.space);
  const overlays = visibleStudioRegions(input.regionOverlays, input.hiddenRegionIds);
  const regionById = new Map((input.regions ?? []).map((region) => [region.id, region] as const));
  const embeddingById = new Map(input.embeddings.map((row) => [row.id, row] as const));
  const selected = text(input.selectedPointId);
  const rays: StudioRegionDistanceRay[] = [];
  for (const coord of input.coords) {
    const row = embeddingById.get(coord.id);
    if (!row) continue;
    const vector = studioEmbeddingVector(row, space);
    for (const overlay of overlays) {
      const region = regionById.get(overlay.id);
      const centroid = region?.centroid;
      if (!centroid) continue;
      const highDimL2 = l2Distance(vector, centroid);
      if (!Number.isFinite(highDimL2)) continue;
      const dx = overlay.screenX - coord.screenX;
      const dy = overlay.screenY - coord.screenY;
      const len = Math.hypot(dx, dy) || 1;
      rays.push({
        pointId: coord.id,
        regionId: overlay.id,
        regionName: overlay.name,
        x1: coord.screenX,
        y1: coord.screenY,
        x2: overlay.screenX,
        y2: overlay.screenY,
        labelX: (coord.screenX + overlay.screenX) / 2 + (-dy / len) * 8,
        labelY: (coord.screenY + overlay.screenY) / 2 + (dx / len) * 8,
        highDimL2: Math.round(highDimL2 * 1e6) / 1e6,
        inRegion: studioPointInsideHighDimRegion(vector, region),
        selected: selected ? coord.id === selected : false,
      });
    }
  }
  return rays;
}

export const DASHBOARD_DATA_STUDIO_PATH = "/api/dashboard/data-studio";

export {
  STUDIO_CAMERA_MIN_SCALE,
  STUDIO_CAMERA_MAX_SCALE,
  IDENTITY_STUDIO_CAMERA,
  clampStudioCameraScale,
  panStudioCamera,
  studioScreenToWorld,
  studioWorldToScreen,
  zoomStudioCamera,
  studioCameraTransform,
  studioNiceGridStep,
  studioGridLines,
  hitTestStudioPoint,
  type StudioCamera,
  type StudioGridLine,
} from "@/lib/data-studio-camera";
