/**
 * Pure author-facing overview of how a learner might interact with a workspace.
 * Workspace-level Simulation tab — distinct from per-block "Block Simulation" drawer.
 */

import {
  deriveBlockSimulation,
  partitionSimulationProbes,
  type SimulationProbe,
} from "@/lib/block-simulation";

export type WorkspaceSimulationBlockRef = {
  id: string;
  title?: string | null;
  description?: string | null;
  status?: string | null;
  is_start?: boolean | null;
  next_block_ids?: string[] | null;
  lock_until_block_ids?: string[] | null;
  planning_prompt?: string | null;
  local_context?: {
    notes?: string | null;
    local_files?: unknown[] | null;
    global_file_refs?: unknown[] | null;
    external_resource_ids?: unknown[] | null;
  } | null;
};

export type WorkspaceSimulationPathStep = {
  blockId: string;
  title: string;
  isStart: boolean;
  locked: boolean;
  lockUntilTitles: string[];
  practiceModes: string[];
};

export type WorkspaceSimulationOverview = {
  /** Total blocks on the map. */
  blockCount: number;
  /** Blocks marked is_start. */
  startCount: number;
  /** Blocks with lock_until prerequisites. */
  lockedCount: number;
  /** Blocks with attached local materials. */
  withLocalContextCount: number;
  /** High-level modes a learner can use in this workspace. */
  interactionModes: string[];
  /** Ordered sample path starting from start blocks (BFS via next_block_ids). */
  samplePaths: WorkspaceSimulationPathStep[][];
  /** Short author narrative of how a learner might move through the map. */
  journeySummary: string;
  /** Sample practice probes from start (or first) blocks for author preview. */
  sampleProbes: Array<{
    blockId: string;
    blockTitle: string;
    questions: SimulationProbe[];
    exercises: SimulationProbe[];
  }>;
};

function clean(s: unknown): string {
  return String(s ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function hasLocalMaterials(
  lc: WorkspaceSimulationBlockRef["local_context"],
): boolean {
  if (!lc || typeof lc !== "object") return false;
  if (typeof lc.notes === "string" && lc.notes.trim()) return true;
  if (Array.isArray(lc.local_files) && lc.local_files.length > 0) return true;
  if (Array.isArray(lc.global_file_refs) && lc.global_file_refs.length > 0) return true;
  if (
    Array.isArray(lc.external_resource_ids) &&
    lc.external_resource_ids.length > 0
  ) {
    return true;
  }
  return false;
}

function blockTitle(b: WorkspaceSimulationBlockRef): string {
  return clean(b.title) || "Untitled block";
}

/**
 * Build a BFS path from a start block following next_block_ids (max steps).
 */
export function buildSimulationPathFromStart(
  startId: string,
  byId: Map<string, WorkspaceSimulationBlockRef>,
  maxSteps = 8,
): WorkspaceSimulationPathStep[] {
  const path: WorkspaceSimulationPathStep[] = [];
  const seen = new Set<string>();
  let current: string | null = startId;
  while (current && path.length < maxSteps && !seen.has(current)) {
    seen.add(current);
    const b = byId.get(current);
    if (!b) break;
    const lockIds = (b.lock_until_block_ids || [])
      .map((id) => String(id || "").trim())
      .filter(Boolean);
    const lockUntilTitles = lockIds.map(
      (id) => blockTitle(byId.get(id) || { id, title: id }),
    );
    const locked = lockIds.length > 0;
    const modes = ["Explore (dialogue)", "Drill (solo exercise)"];
    if (b.is_start) modes.unshift("Start block");
    path.push({
      blockId: b.id,
      title: blockTitle(b),
      isStart: Boolean(b.is_start),
      locked,
      lockUntilTitles,
      practiceModes: modes,
    });
    const nexts = (b.next_block_ids || [])
      .map((id) => String(id || "").trim())
      .filter((id) => id && byId.has(id) && !seen.has(id));
    current = nexts[0] || null;
  }
  return path;
}

/**
 * Pure workspace-level simulation overview for course authors.
 */
export function deriveWorkspaceSimulationOverview(
  blocks: readonly WorkspaceSimulationBlockRef[],
): WorkspaceSimulationOverview {
  const list = (blocks || []).filter((b) => b && String(b.id || "").trim());
  const byId = new Map(list.map((b) => [String(b.id), b]));

  const starts = list.filter((b) => b.is_start);
  const lockedCount = list.filter(
    (b) => (b.lock_until_block_ids || []).filter(Boolean).length > 0,
  ).length;
  const withLocalContextCount = list.filter((b) =>
    hasLocalMaterials(b.local_context),
  ).length;

  const interactionModes = [
    "Map navigation",
    "Explore (dialogue)",
    "Drill (solo exercise)",
  ];
  if (starts.length > 0) interactionModes.unshift("Start from entry blocks");
  if (lockedCount > 0) interactionModes.push("Prerequisite gates (lock-until)");

  const samplePaths: WorkspaceSimulationPathStep[][] = [];
  const pathSources =
    starts.length > 0 ? starts : list.slice(0, Math.min(2, list.length));
  for (const s of pathSources.slice(0, 3)) {
    const path = buildSimulationPathFromStart(String(s.id), byId);
    if (path.length) samplePaths.push(path);
  }

  let journeySummary: string;
  if (list.length === 0) {
    journeySummary =
      "This workspace has no blocks yet. Learners need a map of topics before they can Explore or Drill.";
  } else if (starts.length === 0) {
    journeySummary = `There are ${list.length} block${list.length === 1 ? "" : "s"} but no starter. Learners may open any available block; mark at least one as a starter so paths are clear.`;
  } else {
    journeySummary = `A learner can begin at ${starts.length} starter block${starts.length === 1 ? "" : "s"}, then follow next-links through the map. Explore runs dialogue practice; Drill runs solo exercises. ${
      lockedCount > 0
        ? `${lockedCount} block${lockedCount === 1 ? "" : "s"} declare prerequisites that gate unlock order.`
        : "No lock-until gates are set — most blocks stay open once available."
    }`;
  }

  // Sample probes from starts (or first blocks) via existing pure derive.
  const probeSources =
    starts.length > 0 ? starts.slice(0, 2) : list.slice(0, 2);
  const sampleProbes = probeSources.map((b) => {
    const sim = deriveBlockSimulation({
      title: blockTitle(b),
      description: b.description,
      planningPrompt: b.planning_prompt,
      localNotes: b.local_context?.notes ?? null,
      hasLocalContext: hasLocalMaterials(b.local_context),
      hasPlanningPrompt: Boolean(clean(b.planning_prompt)),
      isStart: b.is_start,
      lockUntilTitles: (b.lock_until_block_ids || [])
        .map((id) => blockTitle(byId.get(String(id)) || { id, title: id }))
        .filter(Boolean),
    });
    const { questions, exercises } = partitionSimulationProbes(sim.probes);
    return {
      blockId: String(b.id),
      blockTitle: blockTitle(b),
      questions: questions.slice(0, 2),
      exercises: exercises.slice(0, 2),
    };
  });

  return {
    blockCount: list.length,
    startCount: starts.length,
    lockedCount,
    withLocalContextCount,
    interactionModes,
    samplePaths,
    journeySummary,
    sampleProbes,
  };
}
