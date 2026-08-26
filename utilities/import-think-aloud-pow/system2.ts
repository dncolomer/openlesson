import {
  composeIleEndOfChainOfThoughtEvent,
  ILE_END_OF_CHAIN_OF_THOUGHT_ACTION,
} from "@/lib/ile-im-done-answering";
import { sortIleSoloTimeline } from "./timeline";
import type { IleSoloThoughtEvent, IleSoloTimelineEvent, System2Inference } from "./types";

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => asString(item)).filter(Boolean);
}

/**
 * Parse an xAI-shaped inference payload. Unknown / partial JSON becomes empty inference
 * (all thoughts stay System 1) rather than throwing.
 */
export function parseSystem2Inference(raw: unknown): System2Inference {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { promotions: [], end_of_chain: null };
  }
  const record = raw as Record<string, unknown>;
  const promotionsRaw = Array.isArray(record.promotions) ? record.promotions : [];
  const promotions = promotionsRaw
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const thoughtId =
        asString((item as Record<string, unknown>).thought_id) ||
        asString((item as Record<string, unknown>).thoughtId);
      return thoughtId ? { thought_id: thoughtId } : null;
    })
    .filter((item): item is { thought_id: string } => Boolean(item));

  const endRaw = record.end_of_chain ?? record.endOfChain ?? null;
  if (!endRaw || typeof endRaw !== "object" || Array.isArray(endRaw)) {
    return { promotions, end_of_chain: null };
  }
  const endRecord = endRaw as Record<string, unknown>;
  const thoughtIds =
    asStringArray(endRecord.thought_ids).length > 0
      ? asStringArray(endRecord.thought_ids)
      : asStringArray(endRecord.thoughtIds);
  if (thoughtIds.length === 0) {
    return { promotions, end_of_chain: null };
  }
  const text = asString(endRecord.text) || undefined;
  return { promotions, end_of_chain: { thought_ids: thoughtIds, text } };
}

function system1Thoughts(events: IleSoloTimelineEvent[]): IleSoloThoughtEvent[] {
  return events.filter(
    (event): event is IleSoloThoughtEvent =>
      event.kind === "thought" && event.traceType === "system1",
  );
}

/**
 * Apply inferred Solo System 2 on top of an S1 timeline.
 * Promotions become `system2:send` (solution-stack promote). Optional I'm-done
 * becomes `end_of_chain_of_thought`. Original S1 stashes stay. No Helios chat.
 */
export function applySystem2Inference(
  events: IleSoloTimelineEvent[],
  inference: System2Inference,
): IleSoloTimelineEvent[] {
  const stashes = system1Thoughts(events);
  const byId = new Map(stashes.map((thought) => [thought.thoughtId, thought]));
  const extra: IleSoloTimelineEvent[] = [];
  const seenPromote = new Set<string>();

  for (const promotion of inference.promotions) {
    const stash = byId.get(promotion.thought_id);
    if (!stash || seenPromote.has(stash.thoughtId)) continue;
    seenPromote.add(stash.thoughtId);
    extra.push({
      kind: "thought",
      timestampMs: stash.timestampMs + 1,
      thoughtId: stash.thoughtId,
      chainId: stash.chainId,
      text: stash.text,
      traceType: "system2",
      action: "send",
    });
  }

  const end = inference.end_of_chain;
  if (end) {
    const resolved = end.thought_ids
      .map((id) => byId.get(id))
      .filter((thought): thought is IleSoloThoughtEvent => Boolean(thought));
    if (resolved.length > 0) {
      const composed = composeIleEndOfChainOfThoughtEvent({
        ids: resolved.map((thought) => thought.thoughtId),
        text: end.text?.trim() || resolved.map((thought) => thought.text).join("\n"),
        includesForming: false,
      });
      const maxTs = Math.max(...resolved.map((thought) => thought.timestampMs));
      extra.push({
        kind: "thought",
        timestampMs: maxTs + 2,
        thoughtId: composed.thoughtId || resolved[0].thoughtId,
        thoughtIds: composed.thoughtIds,
        chainId: resolved[resolved.length - 1].chainId,
        text: composed.text,
        traceType: "system2",
        action: ILE_END_OF_CHAIN_OF_THOUGHT_ACTION,
        combined: composed.combined,
      });
    }
  }

  return sortIleSoloTimeline([...events, ...extra]);
}
