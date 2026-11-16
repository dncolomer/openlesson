/**
 * Unsys seed attached to a product flow (Solve / Verify / Calibrate).
 * The slow create wizard authors this seed; session prepare reads it first.
 */

import {
  authorUnsysSeedForPersist,
  normalizeAuthorUnsysModelSeed,
  serializeAuthorUnsysModelSeed,
  studentSessionModelFromAuthorSeed,
  type AuthorUnsysModelSeed,
} from "@/lib/author-unsys-model";
import type { SessionBranchModel } from "@/lib/session-branch-model";

export const FLOW_UNSYS_SEED_PATH = "/api/dashboard/flows/unsys-seed";

export function parseFlowUnsysSeed(raw: unknown): AuthorUnsysModelSeed | null {
  return normalizeAuthorUnsysModelSeed(raw);
}

export function serializeFlowUnsysSeed(raw: unknown): Record<string, unknown> | null {
  const seed = parseFlowUnsysSeed(raw);
  return seed ? serializeAuthorUnsysModelSeed(seed) : null;
}

export function flowUnsysSeedFromModel(
  model: SessionBranchModel | null | undefined,
): AuthorUnsysModelSeed | null {
  if (!model) return null;
  try {
    return authorUnsysSeedForPersist(model);
  } catch {
    return null;
  }
}

export function studentModelFromFlowSeed(raw: unknown): SessionBranchModel | null {
  return studentSessionModelFromAuthorSeed(raw);
}

export function nextFlowUnsysSeed(
  current: unknown,
  incoming: unknown,
): AuthorUnsysModelSeed | null {
  if (incoming === undefined) return parseFlowUnsysSeed(current);
  if (incoming === null) return null;
  return parseFlowUnsysSeed(incoming);
}
