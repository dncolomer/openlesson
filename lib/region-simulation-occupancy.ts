/**
 * Deterministic occupancy mapper for canvas-faithful simulation.
 */

import { hashUnit } from "@/lib/knowledge-config/math";
import {
  sessionBranchById,
  sessionBranchInferCandidates,
  type SessionBranch,
  type SessionBranchModel,
} from "@/lib/session-branch-model";
import type { ExplorationStrategy } from "@/lib/region-simulation";

function clip01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function tokens(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .split(/[^a-z0-9]+/i)
      .map((part) => part.trim())
      .filter((part) => part.length > 1),
  );
}

function jaccard(notes: readonly string[], branch: SessionBranch): number {
  const a = tokens(notes.join(" "));
  const b = tokens(`${branch.question} ${branch.observation} ${branch.title}`);
  if (!a.size || !b.size) return 0;
  let overlap = 0;
  for (const token of a) if (b.has(token)) overlap += 1;
  return overlap / new Set([...a, ...b]).size;
}

function edgePrice(parent: SessionBranch, childId: string): number {
  const edge = parent.edges.find((item) => item.toId === childId);
  return edge ? edge.price : 50;
}

export function preferScore(input: {
  strategy: ExplorationStrategy;
  parent: SessionBranch;
  candidate: SessionBranch;
  step: number;
}): number {
  const price = edgePrice(input.parent, input.candidate.id) / 100;
  switch (input.strategy.params.prefer) {
    case "cheap":
      return 1 - price;
    case "costly":
      return price;
    case "novel":
      return input.candidate.depth / 8;
    case "lineage":
      return input.step === 0 ? hashUnit(`lineage:${input.candidate.id}`) : 1 - price;
    case "balanced":
      return input.step < input.strategy.params.commitAfter ? price : 1 - price;
    default:
      return 1 - price;
  }
}

export function scoreOccupancyCandidate(input: {
  strategy: ExplorationStrategy;
  parent: SessionBranch;
  candidate: SessionBranch;
  visited: ReadonlySet<string>;
  noteTexts: readonly string[];
  seed: string;
  step: number;
}): number {
  return (
    0.45 * preferScore(input) +
    0.4 * jaccard(input.noteTexts, input.candidate) +
    0.1 * (input.visited.has(input.candidate.id) ? 0 : 1) +
    0.05 * hashUnit(`${input.seed}:${input.step}:${input.candidate.id}`)
  );
}

export function confidenceFromScore(score: number): number {
  return 0.55 + 0.4 * clip01(score);
}

export function inferOccupancyHid(input: {
  model: SessionBranchModel;
  hid: string | null;
  strategy: ExplorationStrategy;
  visited: ReadonlySet<string>;
  noteTexts: readonly string[];
  seed: string;
  step: number;
}): string | null {
  const hid = input.hid || input.model.rootId;
  const parent = sessionBranchById(input.model, hid) || sessionBranchById(input.model, input.model.rootId);
  if (!parent) return hid;
  const candidates = sessionBranchInferCandidates(input.model, hid);
  if (!candidates.length) return hid;
  let best = candidates[0]!;
  let bestScore = -Infinity;
  for (const candidate of candidates) {
    const score = scoreOccupancyCandidate({
      strategy: input.strategy,
      parent,
      candidate,
      visited: input.visited,
      noteTexts: input.noteTexts,
      seed: input.seed,
      step: input.step,
    });
    if (score > bestScore || (score === bestScore && candidate.id.localeCompare(best.id) < 0)) {
      best = candidate;
      bestScore = score;
    }
  }
  return best.id;
}
