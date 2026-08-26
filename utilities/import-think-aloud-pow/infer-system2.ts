import { callXaiJSON } from "@/lib/xai-client";
import { ILE_IMPORT_SESSION_MODE_LABEL } from "./constants";
import { parseSystem2Inference } from "./system2";
import type { IleSoloThoughtEvent, IleSoloTimelineEvent, System2Inference } from "./types";

function system1Stashes(events: IleSoloTimelineEvent[]): IleSoloThoughtEvent[] {
  return events.filter(
    (event): event is IleSoloThoughtEvent =>
      event.kind === "thought" && event.traceType === "system1",
  );
}

export async function inferIleSoloSystem2(
  events: IleSoloTimelineEvent[],
): Promise<System2Inference> {
  const stashes = system1Stashes(events);
  if (stashes.length === 0) {
    return { promotions: [], end_of_chain: null };
  }

  const listing = stashes
    .map(
      (thought) =>
        `- ${thought.thoughtId} @${thought.timestampMs}ms [${thought.action}]: ${thought.text}`,
    )
    .join("\n");

  const response = await callXaiJSON<{
    promotions?: { thought_id?: string }[];
    end_of_chain?: { thought_ids?: string[]; text?: string } | null;
  }>(
    [
      {
        role: "system",
        content: `You label System 2 actions for an ILE ${ILE_IMPORT_SESSION_MODE_LABEL} think-aloud.
This is NOT TAP and NOT Helios chat. There are no dialogue sends.
Every listed item is already a System 1 stash (thought memory).
System 2 means: promote a stash onto the Solo solution stack (promotions → system2:send), and/or close with I'm-done answering (end_of_chain).
Only promote utterances that are committed answers, conclusions, or explicit "I'm done" / final-answer language.
Do not invent thought ids or rewrite text. Prefer sparse promotions. Remaining stashes stay System 1.
Return JSON: { "promotions": [{ "thought_id": "t0" }], "end_of_chain": { "thought_ids": ["t0"], "text": "..." } | null }`,
      },
      {
        role: "user",
        content: `Stashed thoughts:\n${listing}\n\nReturn promotions (thought_id values from the list) and optional end_of_chain.`,
      },
    ],
    {
      maxTokens: 800,
      temperature: 0,
      reasoningEffort: "low",
    },
  );

  if (!response.success || !response.data) {
    console.error("[import-think-aloud-pow] System 2 inference failed:", response.error);
    return { promotions: [], end_of_chain: null };
  }
  return parseSystem2Inference(response.data);
}
