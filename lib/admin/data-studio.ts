/**
 * Pure helpers for Admin Data Studio: access, browse filters, multi-workspace
 * bulk LWM Snapshot progress, and projection/region analysis helpers.
 * No I/O — unit-tested independently of Next/auth.
 */

import {
  computeProjectionFitBounds,
  dataToScreen,
  fitViewTransform,
  mapRadiusToScreen,
  selectProjectionDisplayPoints,
  type ProjectionDisplayMode,
  type ScreenRect,
  type ViewTransform,
} from "@/lib/knowledge-config/projection-view";
import {
  projectTrajectoryAndRegions,
  type ProjectionAlgorithmId,
  type RegionCentroidInput,
  type TrajectoryPointInput,
} from "@/lib/knowledge-config/project-2d";
import {
  computeKnowledgeDistance,
  scoreAgainstCustomVerificationModel,
  type CustomVerificationModelSpec,
} from "@/lib/knowledge-config/custom-verification-model";
import {
  labelForSnapshotSubject,
  type SnapshotAllSubjectResult,
  type SnapshotAllSubjectStatus,
} from "@/lib/pow-api/snapshot-all-progress";
import type { SnapshotSubjectRef } from "@/lib/pow-api/workspace-snapshot-subjects";

// ---------- Access ----------

export function isAdminProfile(profile: { is_admin?: boolean | null } | null | undefined): boolean {
  return Boolean(profile?.is_admin);
}

export type DataStudioAccessDecision =
  | { allowed: true }
  | { allowed: false; status: 401 | 403; error: string };

/** Pure access decision from auth presence + admin flag (mirrors requireAdmin outcomes). */
export function decideDataStudioAccess(input: {
  userId?: string | null;
  isAdmin?: boolean | null;
}): DataStudioAccessDecision {
  if (!input.userId) {
    return { allowed: false, status: 401, error: "Not authenticated" };
  }
  if (!input.isAdmin) {
    return { allowed: false, status: 403, error: "Admin access required" };
  }
  return { allowed: true };
}

// ---------- Pagination / filters ----------

export function clampPage(page: number, pageSize: number, total: number): number {
  const size = Math.max(1, pageSize);
  const totalPages = Math.max(1, Math.ceil(Math.max(0, total) / size));
  return Math.min(Math.max(1, Math.floor(page) || 1), totalPages);
}

export function paginateSlice<T>(items: T[], page: number, pageSize: number): {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
} {
  const size = Math.min(200, Math.max(1, Math.floor(pageSize) || 25));
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / size));
  const p = clampPage(page, size, total);
  const start = (p - 1) * size;
  return {
    items: items.slice(start, start + size),
    page: p,
    pageSize: size,
    total,
    totalPages,
  };
}

export function parsePositiveInt(value: string | null | undefined, fallback: number, max = 200): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(max, Math.floor(n));
}

export type StudioPowFilter = {
  workspaceId?: string | null;
  proofOfWorkType?: string | null;
  search?: string | null;
};

export function matchesStudioPowFilter(
  row: {
    workspace_id?: string | null;
    proof_of_work_type?: string | null;
    file_name?: string | null;
    tool_name?: string | null;
    device_name?: string | null;
  },
  filter: StudioPowFilter,
): boolean {
  if (filter.workspaceId && row.workspace_id !== filter.workspaceId) return false;
  if (filter.proofOfWorkType && (row.proof_of_work_type || "") !== filter.proofOfWorkType) {
    return false;
  }
  const q = (filter.search || "").trim().toLowerCase();
  if (!q) return true;
  const hay = [row.file_name, row.tool_name, row.device_name, row.proof_of_work_type]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

// ---------- Session / guest-link paste lookup (TAP & ILE) ----------

export type StudioSessionLinkKind = "tap" | "ile" | "tapbench";

export type StudioSessionLinkParse = {
  token: string;
  /** When the path clearly indicates kind; null if bare token / ambiguous. */
  kind: StudioSessionLinkKind | null;
};

/**
 * Parse a TAP/ILE/TAPBench share URL, path, or bare private token for Data Studio PoW lookup.
 * Accepts `/tap/session/{token}`, `/ile/session/{token}`, `/tapbench/{token}`, full URLs, or bare tokens.
 */
export function parseStudioSessionLinkInput(
  input: string | null | undefined,
): StudioSessionLinkParse | null {
  const raw = (input || "").trim();
  if (!raw) return null;

  // Bare token (no path/scheme)
  if (!/[\s/]/.test(raw) && raw.length >= 8 && !raw.includes("://")) {
    return { token: raw, kind: null };
  }

  try {
    const withScheme = raw.includes("://")
      ? raw
      : `https://placeholder.local${raw.startsWith("/") ? "" : "/"}${raw}`;
    const url = new URL(withScheme);
    const parts = url.pathname.split("/").filter(Boolean);
    // …/tapbench/<token>
    const tbIdx = parts.findIndex((p) => p.toLowerCase() === "tapbench");
    if (tbIdx >= 0 && parts[tbIdx + 1]) {
      const token = decodeURIComponent(parts[tbIdx + 1]).trim();
      if (token) return { token, kind: "tapbench" };
    }
    // …/tap/session/<token> or …/ile/session/<token>
    const sessionIdx = parts.findIndex((p) => p === "session");
    if (sessionIdx >= 1 && parts[sessionIdx + 1]) {
      const product = parts[sessionIdx - 1]?.toLowerCase();
      const token = decodeURIComponent(parts[sessionIdx + 1]).trim();
      if (!token) return null;
      if (product === "tap" || product === "ile") {
        return { token, kind: product };
      }
      return { token, kind: null };
    }
    const last = parts[parts.length - 1];
    if (last && last.length >= 8) {
      const token = decodeURIComponent(last).trim();
      if (token) return { token, kind: null };
    }
  } catch {
    // fall through
  }

  const cleaned = raw.split(/[?#]/)[0].replace(/\/+$/, "");
  const seg = cleaned.split("/").filter(Boolean).pop();
  if (seg && seg.length >= 8) {
    const token = decodeURIComponent(seg).trim();
    return token ? { token, kind: null } : null;
  }
  return null;
}

/** Resolved guest-link / session identity used to match PoW rows. */
export type StudioResolvedSessionLink = {
  kind: StudioSessionLinkKind;
  /** workspace_tap_sessions.id, workspace_ile_links.id, or workspace_tapbench_links.id */
  linkId: string;
  /** sessions.id when the link has started a session (ILE often; TAP link id is often also the session). */
  sessionId: string | null;
  workspaceId: string | null;
};

/**
 * Whether a PoW row belongs to a resolved TAP/ILE link/session.
 * Matches session_id, source_link_* metadata, and legacy tap_session_id / ile_link_id.
 */
export function matchesStudioPowToSessionLink(
  row: {
    session_id?: string | null;
    metadata?: Record<string, unknown> | null;
  },
  resolved: StudioResolvedSessionLink,
): boolean {
  const linkId = (resolved.linkId || "").trim();
  const sessionId = (resolved.sessionId || "").trim();
  if (!linkId && !sessionId) return false;

  const sid = typeof row.session_id === "string" ? row.session_id.trim() : "";
  if (sessionId && sid && sid === sessionId) return true;
  // TAP: link id is often the same as historical session / PoW session_id
  if (linkId && sid && sid === linkId) return true;

  const meta =
    row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? row.metadata
      : {};

  const sourceKind = meta.source_link_kind;
  const sourceId =
    typeof meta.source_link_id === "string" ? meta.source_link_id.trim() : "";
  if (sourceId && sourceId === linkId) {
    if (sourceKind === "tap" || sourceKind === "ile") {
      return sourceKind === resolved.kind || !resolved.kind;
    }
    return true;
  }

  if (resolved.kind === "tap") {
    const tapId =
      typeof meta.tap_session_id === "string" ? meta.tap_session_id.trim() : "";
    if (tapId && (tapId === linkId || (sessionId && tapId === sessionId))) return true;
  }
  if (resolved.kind === "ile") {
    const ileId = typeof meta.ile_link_id === "string" ? meta.ile_link_id.trim() : "";
    if (ileId && ileId === linkId) return true;
  }
  if (resolved.kind === "tapbench") {
    const tbId =
      typeof meta.tapbench_link_id === "string"
        ? meta.tapbench_link_id.trim()
        : typeof meta.tap_session_id === "string"
          ? meta.tap_session_id.trim()
          : "";
    if (tbId && tbId === linkId) return true;
    if (sourceKind === "tapbench" && sourceId === linkId) return true;
  }

  return false;
}

// ---------- Table sorting ----------

export type StudioSortDirection = "asc" | "desc";

export type StudioSortState = {
  column: string;
  direction: StudioSortDirection;
};

export function parseStudioSortDirection(
  value: string | null | undefined,
  fallback: StudioSortDirection = "desc",
): StudioSortDirection {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (raw === "asc" || raw === "ascending") return "asc";
  if (raw === "desc" || raw === "descending") return "desc";
  return fallback;
}

export function toggleStudioSort(
  current: StudioSortState | null,
  column: string,
  defaultDirection: StudioSortDirection = "desc",
): StudioSortState {
  if (!current || current.column !== column) {
    return { column, direction: defaultDirection };
  }
  return {
    column,
    direction: current.direction === "asc" ? "desc" : "asc",
  };
}

function studioSortComparable(value: unknown): string | number {
  if (value == null) return "";
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "string") {
    const asNum = Number(value);
    if (value.trim() !== "" && Number.isFinite(asNum) && /^-?\d+(\.\d+)?$/.test(value.trim())) {
      return asNum;
    }
    // ISO timestamps sort lexicographically when normalized
    return value.toLowerCase();
  }
  return String(value).toLowerCase();
}

/**
 * Stable multi-type sort for Data Studio list rows.
 * `getColumn` returns the value for the active sort column.
 */
export function sortStudioRows<T>(
  rows: readonly T[],
  sort: StudioSortState | null | undefined,
  getColumn: (row: T, column: string) => unknown,
): T[] {
  if (!sort?.column) return [...rows];
  const dir = sort.direction === "asc" ? 1 : -1;
  const indexed = rows.map((row, index) => ({ row, index }));
  indexed.sort((a, b) => {
    const av = studioSortComparable(getColumn(a.row, sort.column));
    const bv = studioSortComparable(getColumn(b.row, sort.column));
    if (av === "" && bv !== "") return 1;
    if (bv === "" && av !== "") return -1;
    if (typeof av === "number" && typeof bv === "number") {
      if (av !== bv) return av < bv ? -dir : dir;
    } else {
      const as = String(av);
      const bs = String(bv);
      if (as !== bs) return as < bs ? -dir : dir;
    }
    return a.index - b.index;
  });
  return indexed.map((x) => x.row);
}

// ---------- Overview aggregation ----------

export type StudioOverviewCounts = {
  proofOfWork: number;
  knowledgeConfigSnapshots: number;
  evalRunHistory: number;
  customRegions: number;
  workspaces: number;
  organizationsWithXaiKey: number;
  organizationsWithXaiCollection: number;
};

export function emptyStudioOverviewCounts(): StudioOverviewCounts {
  return {
    proofOfWork: 0,
    knowledgeConfigSnapshots: 0,
    evalRunHistory: 0,
    customRegions: 0,
    workspaces: 0,
    organizationsWithXaiKey: 0,
    organizationsWithXaiCollection: 0,
  };
}

export function summarizeXaiOrgRows(
  orgs: Array<{
    xai_api_key_status?: string | null;
    xai_collection_status?: string | null;
  }>,
): Pick<StudioOverviewCounts, "organizationsWithXaiKey" | "organizationsWithXaiCollection"> {
  let organizationsWithXaiKey = 0;
  let organizationsWithXaiCollection = 0;
  for (const org of orgs) {
    if (org.xai_api_key_status === "ready") organizationsWithXaiKey += 1;
    if (org.xai_collection_status === "ready") organizationsWithXaiCollection += 1;
  }
  return { organizationsWithXaiKey, organizationsWithXaiCollection };
}

// ---------- Bulk platform snapshot ----------

export type BulkSnapshotWorkspaceRef = {
  id: string;
  title?: string | null;
  root_topic?: string | null;
  user_id?: string | null;
  organization_id?: string | null;
  status?: string | null;
};

export type BulkSnapshotJob = {
  workspace_id: string;
  workspace_label: string;
  subject: SnapshotSubjectRef;
  subject_label: string;
};

export function workspaceBulkLabel(ws: BulkSnapshotWorkspaceRef): string {
  return (ws.title || ws.root_topic || ws.id.slice(0, 8)).trim() || ws.id;
}

/**
 * Select workspaces for platform bulk snapshot.
 * - If workspaceIds is non-empty, only those ids (intersection with eligible).
 * - Else all eligible when `all` is true.
 * Eligible = not archived (unless includeArchived).
 */
export function selectWorkspacesForBulkSnapshot(
  workspaces: BulkSnapshotWorkspaceRef[],
  options: {
    workspaceIds?: string[] | null;
    all?: boolean;
    includeArchived?: boolean;
  } = {},
): BulkSnapshotWorkspaceRef[] {
  const eligible = workspaces.filter((w) => {
    if (!w.id) return false;
    if (options.includeArchived) return true;
    return (w.status || "active") !== "archived";
  });

  const ids = (options.workspaceIds || []).map((id) => id.trim()).filter(Boolean);
  if (ids.length > 0) {
    const set = new Set(ids);
    return eligible.filter((w) => set.has(w.id));
  }
  if (options.all) return eligible;
  return [];
}

export function buildBulkSnapshotJobs(input: {
  workspaces: BulkSnapshotWorkspaceRef[];
  subjectsByWorkspace: Record<string, SnapshotSubjectRef[]>;
  currentUserId?: string | null;
}): BulkSnapshotJob[] {
  const jobs: BulkSnapshotJob[] = [];
  for (const ws of input.workspaces) {
    const subjects = input.subjectsByWorkspace[ws.id] || [];
    const wsLabel = workspaceBulkLabel(ws);
    for (const subject of subjects) {
      jobs.push({
        workspace_id: ws.id,
        workspace_label: wsLabel,
        subject,
        subject_label: labelForSnapshotSubject(subject, {
          currentUserId: input.currentUserId,
        }),
      });
    }
  }
  return jobs;
}

export type PlatformBulkSnapshotEvent =
  | {
      type: "start";
      total_workspaces: number;
      total_jobs: number;
      label?: string;
    }
  | {
      type: "workspace_start";
      workspace_id: string;
      workspace_label?: string;
      workspace_index: number; // 1-based
      total_workspaces: number;
      subject_count: number;
    }
  | {
      type: "job_start";
      index: number; // 1-based global
      total: number;
      workspace_id: string;
      workspace_label?: string;
      user_id: string | null;
      guest_user_id: string | null;
      label?: string;
    }
  | {
      type: "job";
      index: number;
      total: number;
      workspace_id: string;
      workspace_label?: string;
      user_id: string | null;
      guest_user_id: string | null;
      status: "ok" | "skipped" | "failed";
      error?: string;
      code?: string;
      eval_run_history_id?: string | null;
      label?: string;
    }
  | {
      type: "workspace_complete";
      workspace_id: string;
      workspace_label?: string;
      succeeded: number;
      skipped: number;
      failed: number;
      total: number;
    }
  | {
      type: "complete";
      total_workspaces: number;
      total_jobs: number;
      succeeded: number;
      skipped: number;
      failed: number;
      label?: string;
    }
  | { type: "error"; error: string };

export type PlatformBulkJobResult = SnapshotAllSubjectResult & {
  workspace_id: string;
  workspace_label?: string;
};

export type PlatformBulkSnapshotState = {
  phase: "idle" | "running" | "complete" | "error";
  total_workspaces: number;
  total_jobs: number;
  completed: number;
  succeeded: number;
  skipped: number;
  failed: number;
  currentIndex: number | null;
  currentLabel: string | null;
  currentWorkspaceId: string | null;
  currentWorkspaceLabel: string | null;
  results: PlatformBulkJobResult[];
  workspaceSummaries: Array<{
    workspace_id: string;
    workspace_label?: string;
    succeeded: number;
    skipped: number;
    failed: number;
    total: number;
  }>;
  summary: string | null;
  error: string | null;
};

export function initialPlatformBulkSnapshotProgress(): PlatformBulkSnapshotState {
  return {
    phase: "idle",
    total_workspaces: 0,
    total_jobs: 0,
    completed: 0,
    succeeded: 0,
    skipped: 0,
    failed: 0,
    currentIndex: null,
    currentLabel: null,
    currentWorkspaceId: null,
    currentWorkspaceLabel: null,
    results: [],
    workspaceSummaries: [],
    summary: null,
    error: null,
  };
}

export function formatPlatformBulkSnapshotProgress(state: PlatformBulkSnapshotState): string {
  if (state.phase === "idle") return "";
  if (state.phase === "error") {
    return state.error ? `Platform bulk snapshot failed: ${state.error}` : "Platform bulk snapshot failed";
  }
  if (state.phase === "complete") {
    return (
      state.summary ||
      `Bulk complete: ${state.succeeded} ok, ${state.skipped} skipped, ${state.failed} failed (${state.total_jobs} jobs · ${state.total_workspaces} workspaces).`
    );
  }
  if (state.total_jobs <= 0) return "Starting platform bulk snapshot…";
  const ws = state.currentWorkspaceLabel ? ` · ${state.currentWorkspaceLabel}` : "";
  const cur = state.currentLabel ? ` · ${state.currentLabel}` : "";
  return `Bulk snapshot: ${state.completed}/${state.total_jobs} done${ws}${cur} (${state.succeeded} ok, ${state.skipped} skipped, ${state.failed} failed)`;
}

export function reducePlatformBulkSnapshotProgress(
  state: PlatformBulkSnapshotState,
  event: PlatformBulkSnapshotEvent,
): PlatformBulkSnapshotState {
  switch (event.type) {
    case "start":
      return {
        ...initialPlatformBulkSnapshotProgress(),
        phase: "running",
        total_workspaces: Math.max(0, event.total_workspaces),
        total_jobs: Math.max(0, event.total_jobs),
      };
    case "workspace_start":
      return {
        ...state,
        phase: "running",
        currentWorkspaceId: event.workspace_id,
        currentWorkspaceLabel: event.workspace_label || event.workspace_id,
        total_workspaces:
          event.total_workspaces > 0 ? event.total_workspaces : state.total_workspaces,
      };
    case "job_start":
      return {
        ...state,
        phase: "running",
        total_jobs: event.total > 0 ? event.total : state.total_jobs,
        currentIndex: event.index,
        currentLabel: event.label || null,
        currentWorkspaceId: event.workspace_id,
        currentWorkspaceLabel: event.workspace_label || state.currentWorkspaceLabel,
      };
    case "job": {
      const result: PlatformBulkJobResult = {
        workspace_id: event.workspace_id,
        workspace_label: event.workspace_label,
        user_id: event.user_id,
        guest_user_id: event.guest_user_id,
        status: event.status as SnapshotAllSubjectStatus,
        error: event.error,
        code: event.code,
        eval_run_history_id: event.eval_run_history_id,
        label: event.label,
      };
      return {
        ...state,
        phase: "running",
        total_jobs: event.total > 0 ? event.total : state.total_jobs,
        completed: state.completed + 1,
        succeeded: state.succeeded + (event.status === "ok" ? 1 : 0),
        skipped: state.skipped + (event.status === "skipped" ? 1 : 0),
        failed: state.failed + (event.status === "failed" ? 1 : 0),
        currentIndex: null,
        currentLabel: null,
        results: [...state.results, result],
      };
    }
    case "workspace_complete":
      return {
        ...state,
        workspaceSummaries: [
          ...state.workspaceSummaries,
          {
            workspace_id: event.workspace_id,
            workspace_label: event.workspace_label,
            succeeded: event.succeeded,
            skipped: event.skipped,
            failed: event.failed,
            total: event.total,
          },
        ],
      };
    case "complete": {
      const total_jobs = event.total_jobs > 0 ? event.total_jobs : state.total_jobs;
      const summary = `Bulk complete: ${event.succeeded} ok, ${event.skipped} skipped, ${event.failed} failed (${total_jobs} jobs · ${event.total_workspaces} workspaces).`;
      return {
        ...state,
        phase: "complete",
        total_workspaces: event.total_workspaces,
        total_jobs,
        completed: total_jobs,
        succeeded: event.succeeded,
        skipped: event.skipped,
        failed: event.failed,
        currentIndex: null,
        currentLabel: null,
        currentWorkspaceId: null,
        currentWorkspaceLabel: null,
        summary,
        error: null,
      };
    }
    case "error":
      return {
        ...state,
        phase: "error",
        currentIndex: null,
        currentLabel: null,
        error: event.error,
        summary: null,
      };
    default:
      return state;
  }
}

export function parsePlatformBulkProgressLine(line: string): PlatformBulkSnapshotEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  try {
    const raw = JSON.parse(trimmed) as Record<string, unknown>;
    const type = raw.type;
    if (type === "start") {
      return {
        type: "start",
        total_workspaces: Number(raw.total_workspaces) || 0,
        total_jobs: Number(raw.total_jobs) || 0,
        label: typeof raw.label === "string" ? raw.label : undefined,
      };
    }
    if (type === "workspace_start") {
      if (typeof raw.workspace_id !== "string") return null;
      return {
        type: "workspace_start",
        workspace_id: raw.workspace_id,
        workspace_label: typeof raw.workspace_label === "string" ? raw.workspace_label : undefined,
        workspace_index: Number(raw.workspace_index) || 0,
        total_workspaces: Number(raw.total_workspaces) || 0,
        subject_count: Number(raw.subject_count) || 0,
      };
    }
    if (type === "job_start") {
      if (typeof raw.workspace_id !== "string") return null;
      return {
        type: "job_start",
        index: Number(raw.index) || 0,
        total: Number(raw.total) || 0,
        workspace_id: raw.workspace_id,
        workspace_label: typeof raw.workspace_label === "string" ? raw.workspace_label : undefined,
        user_id: (raw.user_id as string | null) ?? null,
        guest_user_id: (raw.guest_user_id as string | null) ?? null,
        label: typeof raw.label === "string" ? raw.label : undefined,
      };
    }
    if (type === "job") {
      const status = raw.status;
      if (status !== "ok" && status !== "skipped" && status !== "failed") return null;
      if (typeof raw.workspace_id !== "string") return null;
      return {
        type: "job",
        index: Number(raw.index) || 0,
        total: Number(raw.total) || 0,
        workspace_id: raw.workspace_id,
        workspace_label: typeof raw.workspace_label === "string" ? raw.workspace_label : undefined,
        user_id: (raw.user_id as string | null) ?? null,
        guest_user_id: (raw.guest_user_id as string | null) ?? null,
        status,
        error: typeof raw.error === "string" ? raw.error : undefined,
        code: typeof raw.code === "string" ? raw.code : undefined,
        eval_run_history_id:
          raw.eval_run_history_id === null
            ? null
            : typeof raw.eval_run_history_id === "string"
              ? raw.eval_run_history_id
              : undefined,
        label: typeof raw.label === "string" ? raw.label : undefined,
      };
    }
    if (type === "workspace_complete") {
      if (typeof raw.workspace_id !== "string") return null;
      return {
        type: "workspace_complete",
        workspace_id: raw.workspace_id,
        workspace_label: typeof raw.workspace_label === "string" ? raw.workspace_label : undefined,
        succeeded: Number(raw.succeeded) || 0,
        skipped: Number(raw.skipped) || 0,
        failed: Number(raw.failed) || 0,
        total: Number(raw.total) || 0,
      };
    }
    if (type === "complete") {
      return {
        type: "complete",
        total_workspaces: Number(raw.total_workspaces) || 0,
        total_jobs: Number(raw.total_jobs) || 0,
        succeeded: Number(raw.succeeded) || 0,
        skipped: Number(raw.skipped) || 0,
        failed: Number(raw.failed) || 0,
        label: typeof raw.label === "string" ? raw.label : undefined,
      };
    }
    if (type === "error") {
      return {
        type: "error",
        error: typeof raw.error === "string" ? raw.error : "Unknown error",
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function consumePlatformBulkNdjson(
  buffer: string,
  chunk: string,
): { events: PlatformBulkSnapshotEvent[]; rest: string } {
  const combined = buffer + chunk;
  const parts = combined.split("\n");
  const rest = parts.pop() ?? "";
  const events: PlatformBulkSnapshotEvent[] = [];
  for (const part of parts) {
    const ev = parsePlatformBulkProgressLine(part);
    if (ev) events.push(ev);
  }
  return { events, rest };
}

// ---------- Projection + region studio helpers ----------

export type StudioProjectionPoint = {
  x: number;
  y: number;
  screenX: number;
  screenY: number;
  as_of_ms?: number;
  confidence?: number;
};

export type StudioRegionOverlayView = {
  id: string;
  name: string;
  x: number;
  y: number;
  radius: number;
  screenX: number;
  screenY: number;
  screenRadius: number;
  cosine_threshold?: number;
};

/**
 * Build a studio-ready projection layout: joint project + fit + screen mapping.
 * Pure — used by the Data Studio projection panel and unit tests.
 */
export function buildStudioProjectionView(input: {
  points: TrajectoryPointInput[];
  regions?: RegionCentroidInput[];
  algorithm?: ProjectionAlgorithmId | string;
  displayMode?: ProjectionDisplayMode;
  screen?: ScreenRect;
}): {
  algorithm: ProjectionAlgorithmId;
  frame_id: string;
  bounds: ReturnType<typeof computeProjectionFitBounds>;
  view: ViewTransform | null;
  coords: StudioProjectionPoint[];
  regionOverlays: StudioRegionOverlayView[];
  displayMode: ProjectionDisplayMode;
} {
  const displayMode = input.displayMode ?? "trajectory";
  const screen = input.screen ?? { width: 640, height: 400, margin: 40 };
  const joint = projectTrajectoryAndRegions({
    points: input.points,
    regions: input.regions,
    algorithm: input.algorithm as ProjectionAlgorithmId | undefined,
  });

  const displayCoords = selectProjectionDisplayPoints(joint.coords, displayMode);
  const regionDisks = joint.regionOverlays.map((r) => ({
    x: r.x,
    y: r.y,
    radius: r.radius,
  }));
  const bounds = computeProjectionFitBounds(displayCoords, regionDisks, displayMode);
  const innerW = Math.max(1, screen.width - 2 * screen.margin);
  const innerH = Math.max(1, screen.height - 2 * screen.margin);
  const view = bounds
    ? fitViewTransform(bounds, { aspectRatio: innerW / innerH })
    : null;

  const coords: StudioProjectionPoint[] = displayCoords.map((c) => {
    const scr = view ? dataToScreen(c.x, c.y, view, screen) : { x: 0, y: 0 };
    return {
      x: c.x,
      y: c.y,
      screenX: scr.x,
      screenY: scr.y,
      as_of_ms: c.as_of_ms,
      confidence: c.confidence,
    };
  });

  const regionOverlays: StudioRegionOverlayView[] = joint.regionOverlays.map((r) => {
    const scr = view ? dataToScreen(r.x, r.y, view, screen) : { x: 0, y: 0 };
    const screenRadius = view ? mapRadiusToScreen(r.radius, view, screen) : 0;
    return {
      id: r.id,
      name: r.name,
      x: r.x,
      y: r.y,
      radius: r.radius,
      screenX: scr.x,
      screenY: scr.y,
      screenRadius,
      cosine_threshold: r.cosine_threshold,
    };
  });

  return {
    algorithm: joint.algorithm,
    frame_id: joint.frame_id,
    bounds,
    view,
    coords,
    regionOverlays,
    displayMode,
  };
}

/** Exercise region membership / knowledge-distance geometry for studio analysis. */
export function evaluateStudioRegionGeometry(input: {
  model: CustomVerificationModelSpec;
  vector: number[];
}): {
  score: ReturnType<typeof scoreAgainstCustomVerificationModel>;
  knowledge_distance: ReturnType<typeof computeKnowledgeDistance>;
} {
  const score = scoreAgainstCustomVerificationModel(input.vector, input.model);
  const knowledge_distance = computeKnowledgeDistance(input.vector, input.model);
  return { score, knowledge_distance };
}

export const DATA_STUDIO_TABS = [
  "overview",
  "pow",
  "snapshots",
  "regions",
  "xai",
  "bulk",
  "projections",
] as const;

export type DataStudioTab = (typeof DATA_STUDIO_TABS)[number];

export function parseDataStudioTab(value: string | null | undefined): DataStudioTab {
  if (value && (DATA_STUDIO_TABS as readonly string[]).includes(value)) {
    return value as DataStudioTab;
  }
  return "overview";
}
