/**
 * Pure helpers for Add-block Range / Density multi-create (cold-start).
 * Circle approximation around a center empty cell; density samples a subset.
 * Seedable so unit tests pin membership without React.
 */

export type AddExpandCell = { row: number; col: number };

export const ADD_RANGE_MIN = 0;
export const ADD_RANGE_MAX = 6;
export const ADD_DENSITY_MIN = 0;
export const ADD_DENSITY_MAX = 100;

function cellKey(c: AddExpandCell): string {
  return `${c.row}:${c.col}`;
}

/** Euclidean distance in grid units (circle approximation). */
export function gridEuclideanDistance(
  a: AddExpandCell,
  b: AddExpandCell,
): number {
  const dr = a.row - b.row;
  const dc = a.col - b.col;
  return Math.sqrt(dr * dr + dc * dc);
}

/**
 * Mulberry32 seeded PRNG — deterministic across runs for the same seed.
 */
export function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates shuffle with seed; does not mutate input. */
export function seedShuffleCells(
  cells: readonly AddExpandCell[],
  seed: number,
): AddExpandCell[] {
  const out = cells.map((c) => ({ row: c.row, col: c.col }));
  const rand = mulberry32(seed >>> 0);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

export function nextRandomizeSeed(seed: number): number {
  return (Math.imul(seed >>> 0, 1664525) + 1013904223) >>> 0;
}

/**
 * How many candidates to keep for a density in 0..100.
 * Always at least 1 when any candidates exist; max = all.
 */
export function countForDensity(
  candidateCount: number,
  density: number,
): number {
  if (candidateCount <= 0) return 0;
  const d = Math.min(
    ADD_DENSITY_MAX,
    Math.max(ADD_DENSITY_MIN, Number(density) || 0),
  );
  if (d >= ADD_DENSITY_MAX) return candidateCount;
  if (d <= ADD_DENSITY_MIN) return 1;
  return Math.max(1, Math.round((d / ADD_DENSITY_MAX) * candidateCount));
}

/**
 * Placeable empty cells within Euclidean radius `range` of center
 * (circle approximation on the integer grid). Center included first when placeable.
 * Occupied and unusable cells are excluded.
 */
export function cellsInRangeCircle(input: {
  center: AddExpandCell;
  range: number;
  occupiedKeys?: ReadonlySet<string> | readonly string[] | null;
  unusableKeys?: ReadonlySet<string> | readonly string[] | null;
}): AddExpandCell[] {
  const center = {
    row: Math.trunc(input.center.row),
    col: Math.trunc(input.center.col),
  };
  const range = Math.min(
    ADD_RANGE_MAX,
    Math.max(ADD_RANGE_MIN, Math.floor(Number(input.range) || 0)),
  );
  const occupied =
    input.occupiedKeys instanceof Set
      ? input.occupiedKeys
      : new Set(input.occupiedKeys || []);
  const unusable =
    input.unusableKeys instanceof Set
      ? input.unusableKeys
      : new Set(input.unusableKeys || []);

  const isPlaceable = (c: AddExpandCell) => {
    const k = cellKey(c);
    return !occupied.has(k) && !unusable.has(k);
  };

  const out: AddExpandCell[] = [];
  const seen = new Set<string>();

  const push = (c: AddExpandCell) => {
    const k = cellKey(c);
    if (seen.has(k)) return;
    if (!isPlaceable(c)) return;
    seen.add(k);
    out.push(c);
  };

  // Center first when placeable
  push(center);

  if (range <= 0) return out;

  for (let dr = -range; dr <= range; dr++) {
    for (let dc = -range; dc <= range; dc++) {
      if (dr === 0 && dc === 0) continue;
      const dist = Math.sqrt(dr * dr + dc * dc);
      if (dist > range + 1e-9) continue;
      push({ row: center.row + dr, col: center.col + dc });
    }
  }

  // Stable order by distance, then row, col (center already first)
  const rest = out.slice(1).sort((a, b) => {
    const da = gridEuclideanDistance(center, a);
    const db = gridEuclideanDistance(center, b);
    if (da !== db) return da - db;
    if (a.row !== b.row) return a.row - b.row;
    return a.col - b.col;
  });
  return [out[0], ...rest].filter(Boolean);
}

/**
 * Density-sample candidates: always keeps center (first element) when present;
 * remaining slots filled from a seed-shuffled copy of the rest.
 * density 100 → all candidates in stable order (center first, then distance order).
 */
export function sampleCellsByDensity(input: {
  candidates: readonly AddExpandCell[];
  density: number;
  seed: number;
}): AddExpandCell[] {
  const candidates = input.candidates.map((c) => ({ row: c.row, col: c.col }));
  if (candidates.length === 0) return [];
  const n = countForDensity(candidates.length, input.density);
  if (n >= candidates.length) return candidates;

  const [center, ...rest] = candidates;
  if (n <= 1) return [center];

  const shuffled = seedShuffleCells(rest, input.seed >>> 0);
  return [center, ...shuffled.slice(0, n - 1)];
}

/**
 * Full pipeline: center + range → candidates → density/seed sample.
 */
export function resolveAddExpandSelection(input: {
  center: AddExpandCell;
  range: number;
  density: number;
  seed: number;
  occupiedKeys?: ReadonlySet<string> | readonly string[] | null;
  unusableKeys?: ReadonlySet<string> | readonly string[] | null;
}): {
  candidates: AddExpandCell[];
  selected: AddExpandCell[];
} {
  const candidates = cellsInRangeCircle({
    center: input.center,
    range: input.range,
    occupiedKeys: input.occupiedKeys,
    unusableKeys: input.unusableKeys,
  });
  const selected = sampleCellsByDensity({
    candidates,
    density: input.density,
    seed: input.seed,
  });
  return { candidates, selected };
}

// ---------------------------------------------------------------------------
// Multi-slot create run: freeze selection, progress, abort between slots
// ---------------------------------------------------------------------------

export type AddExpandCreateProgress = {
  completed: number;
  total: number;
};

/**
 * Ordered slot list for a multi-create run: center first, then remaining
 * selected cells in selection order (no re-sample). Snapshot at submit time
 * so mid-run occupancy changes cannot reshuffle membership.
 */
export function snapshotAddExpandSlots(input: {
  center: AddExpandCell;
  selected: readonly AddExpandCell[];
}): AddExpandCell[] {
  const center = {
    row: Math.trunc(input.center.row),
    col: Math.trunc(input.center.col),
  };
  const seen = new Set<string>([cellKey(center)]);
  const out: AddExpandCell[] = [{ row: center.row, col: center.col }];
  for (const raw of input.selected || []) {
    const c = { row: Math.trunc(raw.row), col: Math.trunc(raw.col) };
    const k = cellKey(c);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(c);
  }
  return out;
}

/** 0..1 fill fraction for progress bar (safe for total 0). */
export function addExpandProgressFraction(
  progress: AddExpandCreateProgress,
): number {
  const total = Math.max(0, Math.floor(Number(progress.total) || 0));
  if (total <= 0) return 0;
  const completed = Math.max(0, Math.floor(Number(progress.completed) || 0));
  return Math.min(1, completed / total);
}

/**
 * Preview cells still pending for a frozen run after `completed` successes.
 * Membership stays fixed; only the tail shrinks as slots finish.
 */
export function remainingAddExpandPreview(
  frozenSlots: readonly AddExpandCell[],
  completed: number,
): AddExpandCell[] {
  const done = Math.max(0, Math.floor(Number(completed) || 0));
  return frozenSlots.slice(done).map((c) => ({ row: c.row, col: c.col }));
}

/**
 * Whether the sequential create loop should create the slot at `nextIndex`
 * (0-based). Stop after abort or when the index is past the frozen list.
 * Does not cancel an in-flight HTTP request — only skips remaining slots.
 */
export function shouldCreateNextAddExpandSlot(input: {
  nextIndex: number;
  total: number;
  aborted: boolean;
}): boolean {
  if (input.aborted) return false;
  const i = Math.floor(Number(input.nextIndex) || 0);
  const total = Math.max(0, Math.floor(Number(input.total) || 0));
  return i >= 0 && i < total;
}

/**
 * Advance progress after one slot finishes successfully.
 * Clamps completed to total.
 */
export function advanceAddExpandProgress(
  progress: AddExpandCreateProgress,
): AddExpandCreateProgress {
  const total = Math.max(0, Math.floor(Number(progress.total) || 0));
  const completed = Math.min(
    total,
    Math.max(0, Math.floor(Number(progress.completed) || 0) + 1),
  );
  return { completed, total };
}

/**
 * Pure multi-create loop driver for tests / shared host logic.
 * Calls `createSlot` for each frozen slot until abort or completion.
 * Checks abort before each slot (not mid-request).
 */
export async function runAddExpandCreateLoop(input: {
  frozenSlots: readonly AddExpandCell[];
  isAborted: () => boolean;
  createSlot: (
    slot: AddExpandCell,
    index: number,
  ) => Promise<void>;
  onProgress?: (progress: AddExpandCreateProgress) => void;
}): Promise<{
  completed: number;
  total: number;
  stopped: boolean;
}> {
  const total = input.frozenSlots.length;
  let completed = 0;
  input.onProgress?.({ completed: 0, total });
  for (let i = 0; i < total; i++) {
    if (
      !shouldCreateNextAddExpandSlot({
        nextIndex: i,
        total,
        aborted: Boolean(input.isAborted()),
      })
    ) {
      return { completed, total, stopped: true };
    }
    await input.createSlot(input.frozenSlots[i], i);
    completed = advanceAddExpandProgress({ completed, total }).completed;
    input.onProgress?.({ completed, total });
  }
  return { completed, total, stopped: false };
}

// ---------------------------------------------------------------------------
// Host-owned concurrent expand jobs (async; progress under minimap)
// ---------------------------------------------------------------------------

export type AddExpandJobStatus = "running" | "completed" | "stopped" | "error";

/** One background multi-create job (frozen slots + progress + independent abort). */
export type AddExpandJob = {
  id: string;
  frozenSlots: AddExpandCell[];
  completed: number;
  total: number;
  aborted: boolean;
  status: AddExpandJobStatus;
  /** Short label for minimap chrome (e.g. truncated prompt). */
  label?: string;
  error?: string;
};

/** Stable id for a new job (pure when seed provided). */
export function createAddExpandJobId(seed: string | number): string {
  return `expand-job-${String(seed)}`;
}

/** Snapshot slots into a new running job record. */
export function createAddExpandJob(input: {
  id: string;
  frozenSlots: readonly AddExpandCell[];
  label?: string | null;
}): AddExpandJob {
  const frozenSlots = (input.frozenSlots || []).map((c) => ({
    row: Math.trunc(c.row),
    col: Math.trunc(c.col),
  }));
  const labelRaw = typeof input.label === "string" ? input.label.trim() : "";
  return {
    id: String(input.id || "").trim() || createAddExpandJobId("anon"),
    frozenSlots,
    completed: 0,
    total: frozenSlots.length,
    aborted: false,
    status: "running",
    label: labelRaw ? labelRaw.slice(0, 48) : undefined,
  };
}

/** Append a job (dedupes by id — replace if same id). */
export function upsertAddExpandJob(
  jobs: readonly AddExpandJob[],
  job: AddExpandJob,
): AddExpandJob[] {
  const id = job.id;
  const without = (jobs || []).filter((j) => j.id !== id);
  return [...without, job];
}

/** Patch one job by id; no-op if missing. */
export function patchAddExpandJob(
  jobs: readonly AddExpandJob[],
  jobId: string,
  patch: Partial<
    Pick<AddExpandJob, "completed" | "aborted" | "status" | "error" | "label">
  >,
): AddExpandJob[] {
  return (jobs || []).map((j) => {
    if (j.id !== jobId) return j;
    const next: AddExpandJob = { ...j, ...patch };
    if (typeof patch.completed === "number") {
      next.completed = Math.min(
        next.total,
        Math.max(0, Math.floor(patch.completed)),
      );
    }
    return next;
  });
}

/** Mark job aborted; does not remove it (stop finishes current slot then ends). */
export function abortAddExpandJob(
  jobs: readonly AddExpandJob[],
  jobId: string,
): AddExpandJob[] {
  return patchAddExpandJob(jobs, jobId, { aborted: true });
}

/** Remove a job from the list (e.g. after complete/stop cleanup). */
export function removeAddExpandJob(
  jobs: readonly AddExpandJob[],
  jobId: string,
): AddExpandJob[] {
  return (jobs || []).filter((j) => j.id !== jobId);
}

/** Jobs still in flight (running, not finished). */
export function activeAddExpandJobs(
  jobs: readonly AddExpandJob[],
): AddExpandJob[] {
  return (jobs || []).filter((j) => j.status === "running");
}

/**
 * Remaining preview cells across all running jobs (frozen membership per job).
 * Used so map highlight reflects every concurrent expand without re-sampling.
 */
export function mergeActiveExpandJobPreviews(
  jobs: readonly AddExpandJob[],
): AddExpandCell[] {
  const out: AddExpandCell[] = [];
  const seen = new Set<string>();
  for (const job of activeAddExpandJobs(jobs)) {
    for (const c of remainingAddExpandPreview(job.frozenSlots, job.completed)) {
      const k = cellKey(c);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ row: c.row, col: c.col });
    }
  }
  return out;
}

/**
 * Apply progress tick to a job list; marks completed/stopped when done.
 * Pure transition used by hosts after each slot.
 */
export function applyAddExpandJobProgress(
  jobs: readonly AddExpandJob[],
  jobId: string,
  progress: AddExpandCreateProgress,
  opts?: { stopped?: boolean; error?: string },
): AddExpandJob[] {
  return (jobs || []).map((j) => {
    if (j.id !== jobId) return j;
    const total = Math.max(j.total, Math.floor(Number(progress.total) || j.total));
    const completed = Math.min(
      total,
      Math.max(0, Math.floor(Number(progress.completed) || 0)),
    );
    let status: AddExpandJobStatus = j.status;
    if (opts?.error) status = "error";
    else if (opts?.stopped || j.aborted) {
      status = completed >= total && total > 0 ? "completed" : "stopped";
      if (completed < total && (opts?.stopped || j.aborted)) status = "stopped";
    } else if (completed >= total && total > 0) {
      status = "completed";
    } else {
      status = "running";
    }
    return {
      ...j,
      completed,
      total,
      status,
      error: opts?.error ?? j.error,
    };
  });
}

/**
 * Whether aborting job A leaves job B running (concurrent independence).
 * Pure predicate for tests — uses list state only.
 */
export function abortIsJobLocal(
  jobs: readonly AddExpandJob[],
  abortedJobId: string,
  otherJobId: string,
): boolean {
  const next = abortAddExpandJob(jobs, abortedJobId);
  const a = next.find((j) => j.id === abortedJobId);
  const b = next.find((j) => j.id === otherJobId);
  return Boolean(a?.aborted && b && !b.aborted && b.status === "running");
}

// ---------------------------------------------------------------------------
// Click-lock while radius/density expand jobs are generating blocks
// ---------------------------------------------------------------------------

/**
 * All grid cells that belong to any **running** expand job (full frozen
 * membership — already-created slots for that job and still-pending ones).
 * Blocks occupying these cells must not be clickable until the job ends.
 */
export function activeExpandJobLockedCellKeys(
  jobs: readonly AddExpandJob[] | null | undefined,
): Set<string> {
  const keys = new Set<string>();
  for (const job of activeAddExpandJobs(jobs || [])) {
    for (const c of job.frozenSlots || []) {
      keys.add(cellKey({ row: Math.trunc(c.row), col: Math.trunc(c.col) }));
    }
  }
  return keys;
}

/**
 * True when any of the block's occupied cells is under an active expand job.
 */
export function isOccupiedCellsGenerationLocked(
  occupiedCells: readonly AddExpandCell[] | null | undefined,
  lockedCellKeys: ReadonlySet<string> | readonly string[] | null | undefined,
): boolean {
  if (!occupiedCells?.length) return false;
  const locked =
    lockedCellKeys instanceof Set
      ? lockedCellKeys
      : new Set(lockedCellKeys || []);
  if (locked.size === 0) return false;
  for (const c of occupiedCells) {
    if (locked.has(cellKey({ row: Math.trunc(c.row), col: Math.trunc(c.col) }))) {
      return true;
    }
  }
  return false;
}

/**
 * Convenience: block generation-locked from jobs + occupied footprint.
 */
export function isBlockGenerationLocked(input: {
  occupiedCells: readonly AddExpandCell[] | null | undefined;
  jobs: readonly AddExpandJob[] | null | undefined;
}): boolean {
  return isOccupiedCellsGenerationLocked(
    input.occupiedCells,
    activeExpandJobLockedCellKeys(input.jobs),
  );
}
