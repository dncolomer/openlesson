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
import { SCIENCE_UNSYS_PATH } from "@/lib/science/hub";
import type { SessionBranchModel } from "@/lib/session-branch-model";

export const FLOW_UNSYS_SEED_PATH = "/api/dashboard/flows/unsys-seed";

export const FLOW_UNSYS_SCIENCE_HREF = SCIENCE_UNSYS_PATH;

export const FLOW_UNSYS_EXPLAINER = {
  lead:
    "This is the Unsys model for the flow: hidden states on a field, joined by priced edges. Learner work is read against it.",
  scienceLabel: "Science",
  modify:
    "Adapt it by prompting, attaching files (including PDFs) as prompt context, or selecting a node and adding a branch by hand. The graph shows titles and edge prices only.",
  question:
    "Question is the interrogative for a hidden state. Fill it in when you add or edit a branch.",
  observation:
    "Observation is what you would expect to see if the learner occupies that state.",
  reset: "Reset restores the default model generated from the Problem.",
} as const;

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
