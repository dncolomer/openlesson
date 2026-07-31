/**
 * Align TAPBench Stash/Submit flushes with human TAP thought-trace PoW so both
 * land in the same knowledge-config embedding / region-builder feature space.
 *
 * Human TAP stores tool_name = "tap-thought-trace". TAPBench uses tool_name =
 * "stash_submit_api" but the same thought-trace payload + metadata shape:
 *   tool_action = "system1:pause_finalize" | "system2:send" | …
 *   file payload = uncertain_systems_tap_thought_trace JSON with `text`
 *   metadata.text + metadata.trace_type + metadata.action (+ source_link_*)
 *
 * Content encoders read metadata.text (and related fields). Without this align,
 * agent tool blobs look empty in UI and under-contribute to content embeddings.
 */

import type { TapTraceType } from "@/lib/tap-score-traces";
import type { StashBufferedUnit, StashDecision, StashTapbenchContext } from "./stash-api";
import { TAPBENCH_POW_SOURCE } from "./tapbench";

/**
 * Agent Stash/Submit identity on PoW rows (distinct from human TAP's `tap-thought-trace`).
 * Trace shape / metadata.text / sys1|sys2 stay TAP-aligned for embeddings.
 */
export const TAPBENCH_ALIGNED_TOOL_NAME = "stash_submit_api" as const;

export type TapbenchAlignedAction = "pause_finalize" | "send";

export function tapbenchActionForDecision(decision: StashDecision): TapbenchAlignedAction {
  return decision === "stash" ? "pause_finalize" : "send";
}

function systemFlag(decision: StashDecision): 1 | 2 {
  return decision === "stash" ? 1 : 2;
}

function traceType(decision: StashDecision): TapTraceType {
  return decision === "stash" ? "system1" : "system2";
}

/**
 * Pull free-text thought content from a buffered unit (agent tool JSON, plain text, etc.).
 * Mirrors fields human TAP puts on metadata.text / thought payloads.
 */
export function extractThoughtTextFromStashUnit(unit: StashBufferedUnit): string {
  const mime = (unit.mime_type || "").toLowerCase();
  let decoded = "";
  try {
    decoded = Buffer.from(unit.data, "base64").toString("utf8");
  } catch {
    decoded = "";
  }

  if (!decoded.trim()) {
    return fallbackTextFromUnit(unit);
  }

  // Plain text payloads
  if (mime.startsWith("text/") && !mime.includes("json")) {
    return decoded.trim();
  }

  try {
    const parsed = JSON.parse(decoded) as unknown;
    const fromJson = extractTextFromUnknown(parsed);
    if (fromJson) return fromJson;
  } catch {
    // not JSON — treat raw as thought text when printable
    if (decoded.length < 20_000 && /[\w\s]/.test(decoded)) {
      return decoded.trim().slice(0, 16_000);
    }
  }

  return fallbackTextFromUnit(unit);
}

function fallbackTextFromUnit(unit: StashBufferedUnit): string {
  const parts = [
    unit.tool_name ? `tool:${unit.tool_name}` : null,
    unit.tool_action ? `action:${unit.tool_action}` : null,
    unit.type ? `type:${unit.type}` : null,
  ].filter(Boolean);
  return parts.join(" ") || "tapbench_thought";
}

function extractTextFromUnknown(value: unknown, depth = 0): string | null {
  if (depth > 6 || value == null) return null;
  if (typeof value === "string") {
    const t = value.trim();
    return t.length > 0 ? t.slice(0, 16_000) : null;
  }
  if (typeof value !== "object") return null;
  if (Array.isArray(value)) {
    const parts = value
      .map((v) => extractTextFromUnknown(v, depth + 1))
      .filter((s): s is string => Boolean(s));
    return parts.length ? parts.join("\n").slice(0, 16_000) : null;
  }

  const o = value as Record<string, unknown>;
  // Prefer TAP-shaped keys first
  const preferredKeys = [
    "text",
    "original_text",
    "learner_thought",
    "thought",
    "utterance",
    "content",
    "message",
    "answer",
    "summary",
    "reasoning",
  ];
  for (const key of preferredKeys) {
    if (!(key in o)) continue;
    const v = o[key];
    if (typeof v === "string" && v.trim()) return v.trim().slice(0, 16_000);
    if (Array.isArray(v)) {
      const joined = v
        .map((x) => (typeof x === "string" ? x : extractTextFromUnknown(x, depth + 1)))
        .filter((s): s is string => Boolean(s))
        .join("\n");
      if (joined.trim()) return joined.trim().slice(0, 16_000);
    }
    if (v && typeof v === "object") {
      const nested = extractTextFromUnknown(v, depth + 1);
      if (nested) return nested;
    }
  }

  // Common nested bags
  for (const key of ["payload", "answer", "data", "result", "body"]) {
    if (o[key] && typeof o[key] === "object") {
      const nested = extractTextFromUnknown(o[key], depth + 1);
      if (nested) return nested;
    }
  }

  return null;
}

export interface TapbenchAlignedPowUpload {
  type: "tool";
  mime_type: "application/json";
  data: string;
  file_name: string;
  tool_name: string;
  tool_action: string;
  metadata: Record<string, unknown>;
  block_id: string | null;
  timestamp_ms: number;
  /** Extracted thought text (same as metadata.text). */
  text: string;
}

/**
 * Convert a buffered stash unit into a human-TAP-comparable thought-trace PoW unit.
 */
export function alignStashUnitToTapThoughtTrace(
  unit: StashBufferedUnit,
  decision: StashDecision,
  tapbench: StashTapbenchContext,
): TapbenchAlignedPowUpload {
  const trace_type = traceType(decision);
  const action = tapbenchActionForDecision(decision);
  const system = systemFlag(decision);
  const text = extractThoughtTextFromStashUnit(unit);
  const blockId = unit.block_id ?? tapbench.block_id ?? null;
  const timestampMs = unit.timestamp_ms || Date.now();
  const thoughtId = unit.id;

  // File payload mirrors buildTapThoughtTracePayload (+ tapbench markers).
  const payload = {
    type: "uncertain_systems_tap_thought_trace" as const,
    trace_type,
    action,
    tap_session_id: tapbench.linkId,
    tapbench_link_id: tapbench.linkId,
    workspace_id: tapbench.workspace_id,
    block_id: blockId,
    thought_id: thoughtId,
    text,
    timestamp_ms: timestampMs,
    at: new Date(timestampMs).toISOString(),
    // Agent source markers (human TAP has no tapbench flag)
    tapbench: true,
    pow_source: TAPBENCH_POW_SOURCE,
    agentic_product: "stash_api",
    decision,
    exercise: tapbench.exercise,
  };

  const metadata: Record<string, unknown> = {
    // Preserve agent-provided tags, then overlay TAP-parity fields
    ...unit.metadata,
    // Human TAP parity (see app/api/workspace-tap-score/trace)
    tap_session_id: tapbench.linkId,
    trace_type,
    action,
    thought_id: thoughtId,
    text,
    selective_thought: true,
    thought_trace: true,
    system,
    system_n: system,
    stash: decision === "stash",
    submit: decision === "submit",
    decision,
    // TAPBench provenance (region builder filters)
    tapbench: true,
    pow_source: TAPBENCH_POW_SOURCE,
    source: TAPBENCH_POW_SOURCE,
    source_link_kind: TAPBENCH_POW_SOURCE,
    source_link_id: tapbench.linkId,
    tapbench_link_id: tapbench.linkId,
    agentic_product: "stash_api",
    block_id: blockId,
    guest_user_id: tapbench.guest_user_id,
  };

  return {
    type: "tool",
    mime_type: "application/json",
    data: Buffer.from(JSON.stringify(payload, null, 2), "utf8").toString("base64"),
    file_name: `tap-trace-${trace_type}-${action}-${thoughtId}.json`,
    tool_name: TAPBENCH_ALIGNED_TOOL_NAME,
    tool_action: `${trace_type}:${action}`,
    metadata,
    block_id: blockId,
    timestamp_ms: timestampMs,
    text,
  };
}
