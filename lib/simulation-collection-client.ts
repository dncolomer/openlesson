/**
 * Browser helper for Simulation collection writes (create one / deposit many).
 */

import { errorMessageFromBody } from "@/lib/api-error-envelope";
import type { SimulationProbe } from "@/lib/block-simulation";
import type {
  SimulationCollectionItem,
  SimulationCollectionItemKind,
  SimulationCollectionOrigin,
} from "@/lib/workspace-simulation-collection";

export type SimulationCollectionWriteResult = {
  ok: boolean;
  items: SimulationCollectionItem[];
  error: string | null;
};

export async function writeSimulationCollection(input: {
  workspaceId: string;
  ayclToken?: string | null;
  action: "create" | "deposit";
  kind?: SimulationCollectionItemKind;
  text?: string;
  coachCue?: string | null;
  questions?: string[];
  exercises?: string[];
  probes?: SimulationProbe[];
  origin?: SimulationCollectionOrigin | Record<string, unknown>;
  modifierPrompt?: string | null;
}): Promise<SimulationCollectionWriteResult> {
  try {
    const res = await fetch("/api/workspace/simulation-collection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceId: input.workspaceId,
        action: input.action,
        kind: input.kind,
        text: input.text,
        coachCue: input.coachCue,
        questions: input.questions,
        exercises: input.exercises,
        probes: input.probes,
        origin: input.origin,
        modifierPrompt: input.modifierPrompt,
        ...(input.ayclToken ? { ayclToken: input.ayclToken } : {}),
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      items?: SimulationCollectionItem[];
      error?: string;
    };
    if (!res.ok) {
      return {
        ok: false,
        items: [],
        error: errorMessageFromBody(data, "Failed to update collection"),
      };
    }
    return {
      ok: true,
      items: Array.isArray(data.items) ? data.items : [],
      error: null,
    };
  } catch (err) {
    return {
      ok: false,
      items: [],
      error: err instanceof Error ? err.message : "Failed to update collection",
    };
  }
}

export async function fetchSimulationCollectionItems(input: {
  workspaceId: string;
}): Promise<SimulationCollectionItem[]> {
  const res = await fetch(
    `/api/workspace/simulation-collection?workspaceId=${encodeURIComponent(input.workspaceId)}`,
  );
  const data = (await res.json().catch(() => ({}))) as {
    items?: SimulationCollectionItem[];
  };
  if (!res.ok || !Array.isArray(data.items)) return [];
  return data.items;
}
