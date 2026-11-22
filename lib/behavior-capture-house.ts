import { quantizeCoord } from "@/lib/behavior-capture";
import { behaviorBoardSampler } from "@/lib/behavior-capture-pointer";
import { speechBehaviorFields } from "@/lib/learn-thought-traces";

const MAX_LASER_POINTS = 32;

export function compactLaserPoints(
  points: readonly { x: number; y: number }[],
  max = MAX_LASER_POINTS,
): { x: number; y: number }[] {
  if (points.length <= max) {
    return points.map((p) => ({ x: quantizeCoord(p.x), y: quantizeCoord(p.y) }));
  }
  const out: { x: number; y: number }[] = [];
  const last = points.length - 1;
  for (let i = 0; i < max; i++) {
    const idx = i === max - 1 ? last : Math.round((i * last) / (max - 1));
    const p = points[idx]!;
    out.push({ x: quantizeCoord(p.x), y: quantizeCoord(p.y) });
  }
  return out;
}

export function laserBehaviorClass(
  kind: string,
  command?: string | null,
): "unknown" | "simplify" | "concepts" | "breakdown" {
  if (command === "simplify" || command === "concepts" || command === "breakdown") return command;
  if (kind === "question-mark") return "simplify";
  if (kind === "line") return "concepts";
  return "unknown";
}

export function recordLaserStroke(input: {
  points: readonly { x: number; y: number }[];
  kind: string;
  command?: string | null;
  t?: number;
}): void {
  const sampler = behaviorBoardSampler();
  if (!sampler) return;
  sampler.record(
    "laser",
    {
      class: laserBehaviorClass(input.kind, input.command),
      n: input.points.length,
      pts: compactLaserPoints(input.points),
    },
    input.t,
  );
}

export function recordCommandAttempt(input: {
  command_id: string;
  path: "tile" | "alt" | "slash" | "laser" | "dictate_run";
  ok: boolean;
  reason?: string | null;
  t?: number;
}): void {
  behaviorBoardSampler()?.record(
    "command_attempt",
    {
      command_id: input.command_id,
      path: input.path,
      ok: input.ok,
      ...(input.reason ? { reason: input.reason } : {}),
    },
    input.t,
  );
}

export function recordChrome(input: { surface: string; t?: number }): void {
  behaviorBoardSampler()?.record("chrome", { surface: input.surface }, input.t);
}

let lastHid: string | null | undefined;

export function recordUnsys(input: { hid: string | null; t?: number }): void {
  if (input.hid === lastHid) return;
  lastHid = input.hid;
  const sampler = behaviorBoardSampler();
  if (!sampler) return;
  sampler.setHid(input.hid);
  sampler.record("unsys", { hid: input.hid }, input.t);
}

export function recordIdle(input: { ms: number; t?: number }): void {
  behaviorBoardSampler()?.record("idle", { ms: input.ms }, input.t);
}

export function recordFocus(input: { visible: boolean; t?: number }): void {
  behaviorBoardSampler()?.record("focus", { visible: input.visible }, input.t);
}

export function recordSpeech(input: {
  text: string;
  isFinal: boolean;
  confidence?: number | null;
  lang?: string | null;
  durationMs?: number | null;
  silenceGapMs?: number | null;
  error?: string | null;
  t?: number;
}): void {
  behaviorBoardSampler()?.record("speech", speechBehaviorFields(input), input.t);
}
