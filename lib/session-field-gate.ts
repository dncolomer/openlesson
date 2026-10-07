/**
 * Shared decisions for the prepared action tree.
 * The canvas stays closed until the tree is ready.
 * Prices and the lowest-cost mark are a Learn-only view of the same actions.
 */

import type { SessionBranchModel } from "@/lib/session-branch-model";
import type { SessionMarkMode } from "@/lib/session-marks";

export type SessionFieldSlotStatus = "idle" | "preparing" | "ready" | "failed";

export type SessionFieldSlot = {
  status: SessionFieldSlotStatus;
  model: SessionBranchModel | null;
};

/** True only when a prepared tree is in hand. Missing, preparing, and refused stay closed. */
export function sessionCanvasMayOpen(
  slot: { status?: SessionFieldSlotStatus | null; model?: SessionBranchModel | null } | null | undefined,
): boolean {
  return slot?.status === "ready" && slot.model != null;
}

/** Learn shows prices and which action is lowest cost. Calibrate and Verification do not. */
export function sessionActionPricesVisible(mode: SessionMarkMode | string | null | undefined): boolean {
  return mode === "learn";
}

const FIELD_LOAD_STAGES = [
  { at: 0, label: "Reading the session material." },
  { at: 4_000, label: "Writing the regions." },
  { at: 12_000, label: "Writing the avenues." },
  { at: 24_000, label: "Writing the inquiries." },
] as const;

/** Progress while the single field request is in flight. Ready is 100. Failed names the refusal. */
export function sessionFieldLoadProgress(input: {
  status: SessionFieldSlotStatus | null | undefined;
  elapsedMs?: number | null;
  error?: string | null;
}): { percent: number; label: string } {
  if (input.status === "ready") {
    return { percent: 100, label: "The field is ready." };
  }
  if (input.status === "failed") {
    const label = input.error?.trim() || "The field could not be prepared.";
    return { percent: 100, label };
  }
  const elapsed = Math.max(0, input.elapsedMs ?? 0);
  let label: string = FIELD_LOAD_STAGES[0].label;
  for (const stage of FIELD_LOAD_STAGES) {
    if (elapsed >= stage.at) label = stage.label;
  }
  const percent = Math.min(92, Math.round((elapsed / 45_000) * 92));
  return { percent, label };
}
