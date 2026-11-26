/**
 * Simulated session clock for region-simulation stubs.
 * Advances a tape clock. Never sleeps the process.
 */

import { hashUnit } from "@/lib/knowledge-config/math";
import { SESSION_POLICY_INFER_INTERVAL_MS } from "@/lib/session-policy-infer";

export type BoardClockGapKind =
  | "burst"
  | "rewrite"
  | "dwell"
  | "commit"
  | "openrouter";

export const BOARD_CLOCK_START_MS = 1;
export const BOARD_CLOCK_BURST_MIN_MS = 400;
export const BOARD_CLOCK_BURST_SPAN_MS = 800;
export const BOARD_CLOCK_REWRITE_MIN_MS = 1500;
export const BOARD_CLOCK_REWRITE_SPAN_MS = 2500;
export const BOARD_CLOCK_COMMIT_MIN_MS = 200;
export const BOARD_CLOCK_COMMIT_SPAN_MS = 600;
export const BOARD_CLOCK_OPENROUTER_MIN_MS = 300;
export const BOARD_CLOCK_OPENROUTER_MAX_MS = 45_000;

function seededSpan(seed: string, seq: number, min: number, span: number): number {
  const unit = hashUnit(`${seed}:clock:${seq}`);
  return min + Math.floor(unit * span);
}

export function boardClockGapMs(input: {
  kind: BoardClockGapKind;
  seed: string;
  seq: number;
  wallMs?: number;
  burstBias?: number;
}): number {
  const bias = Number.isFinite(input.burstBias) ? Number(input.burstBias) : 1;
  if (input.kind === "dwell") return SESSION_POLICY_INFER_INTERVAL_MS;
  if (input.kind === "openrouter") {
    const wall = Number(input.wallMs);
    const raw = Number.isFinite(wall) ? wall : BOARD_CLOCK_OPENROUTER_MIN_MS;
    return Math.min(
      BOARD_CLOCK_OPENROUTER_MAX_MS,
      Math.max(BOARD_CLOCK_OPENROUTER_MIN_MS, Math.round(raw)),
    );
  }
  if (input.kind === "rewrite") {
    return seededSpan(
      input.seed,
      input.seq,
      BOARD_CLOCK_REWRITE_MIN_MS,
      BOARD_CLOCK_REWRITE_SPAN_MS,
    );
  }
  if (input.kind === "commit") {
    return seededSpan(
      input.seed,
      input.seq,
      BOARD_CLOCK_COMMIT_MIN_MS,
      BOARD_CLOCK_COMMIT_SPAN_MS,
    );
  }
  const min = Math.max(80, Math.round(BOARD_CLOCK_BURST_MIN_MS * bias));
  return seededSpan(input.seed, input.seq, min, BOARD_CLOCK_BURST_SPAN_MS);
}

export function nextBoardClockMs(input: {
  clockMs: number;
  kind: BoardClockGapKind;
  seed: string;
  seq: number;
  wallMs?: number;
  burstBias?: number;
}): number {
  return input.clockMs + boardClockGapMs(input);
}
