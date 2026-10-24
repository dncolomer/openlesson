/**
 * Pure helpers for Admin Data Studio: access, browse filters, and
 * projection/region analysis helpers.
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

// ---------- Session / guest-link paste lookup (TAP & TAP Learning) ----------

export type StudioSessionLinkKind = "tap" | "ile";

export type StudioSessionLinkParse = {
  token: string;
  /** When the path clearly indicates kind; null if bare token / ambiguous. */
  kind: StudioSessionLinkKind | null;
};

/**
 * Parse a TAP/TAP Learning share URL, path, or bare private token for Data Studio PoW lookup.
 * Accepts `/calibrate/session/{token}`, `/learn/session/{token}`, `/verify/session/{token}`,
 * legacy `/tap/session/{token}` / `/ile/session/{token}`, full URLs, or bare tokens.
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
    // …/{calibrate|verify|learn|tap|ile}/session/<token>
    const sessionIdx = parts.findIndex((p) => p === "session");
    if (sessionIdx >= 1 && parts[sessionIdx + 1]) {
      const product = parts[sessionIdx - 1]?.toLowerCase();
      const token = decodeURIComponent(parts[sessionIdx + 1]).trim();
      if (!token) return null;
      if (product === "tap" || product === "calibrate" || product === "verify") {
        return { token, kind: "tap" };
      }
      if (product === "ile" || product === "learn") {
        return { token, kind: "ile" };
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
  /** workspace_calibrate_sessions.id, workspace_verify_sessions.id, or workspace_learn_links.id */
  linkId: string;
  /** sessions.id when the link has started a session (TAP Learning often; TAP link id is often also the session). */
  sessionId: string | null;
  workspaceId: string | null;
};

/**
 * Whether a PoW row belongs to a resolved TAP/TAP Learning link/session.
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
  membershipRadius: number;
  membershipScreenRadius: number;
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
    const membershipRadius =
      typeof r.membershipRadius === "number" && Number.isFinite(r.membershipRadius)
        ? Math.max(0, r.membershipRadius)
        : 0;
    return {
      id: r.id,
      name: r.name,
      x: r.x,
      y: r.y,
      radius: r.radius,
      screenX: scr.x,
      screenY: scr.y,
      screenRadius,
      membershipRadius,
      membershipScreenRadius: view ? mapRadiusToScreen(membershipRadius, view, screen) : 0,
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
  "regions",
  "xai",
  "projections",
] as const;

export type DataStudioTab = (typeof DATA_STUDIO_TABS)[number];

export function parseDataStudioTab(value: string | null | undefined): DataStudioTab {
  if (value && (DATA_STUDIO_TABS as readonly string[]).includes(value)) {
    return value as DataStudioTab;
  }
  return "overview";
}
