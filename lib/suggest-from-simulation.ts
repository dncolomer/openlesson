/**
 * Suggest from Simulation — same assembler as knowledge, corpus from
 * the curated simulation collection.
 */

import {
  assembleSuggestFromKnowledgeXaiMessages,
  normalizeSuggestFromKnowledgeResponse,
  type KnowledgePromptSuggestion,
  type KnowledgeSnapshotSuggestInput,
  type SuggestFromKnowledgeContext,
} from "@/lib/suggest-from-knowledge";
import {
  simulationCollectionAsSuggestCorpus,
  type SimulationCollection,
} from "@/lib/workspace-simulation-collection";

export type { KnowledgePromptSuggestion as SimulationPromptSuggestion };

export function simulationCollectionToSuggestSnapshots(
  collection: SimulationCollection | null | undefined,
  limit = 24,
): KnowledgeSnapshotSuggestInput[] {
  return simulationCollectionAsSuggestCorpus(collection, limit).map((item) => ({
    id: item.id,
    excerpts: [item.text],
    vertical: item.kind,
    source: "simulation",
  }));
}

export function assembleSuggestFromSimulationXaiMessages(
  collection: SimulationCollection | null | undefined,
  context: SuggestFromKnowledgeContext = {},
) {
  return assembleSuggestFromKnowledgeXaiMessages(
    simulationCollectionToSuggestSnapshots(collection),
    context,
  );
}

export { normalizeSuggestFromKnowledgeResponse as normalizeSuggestFromSimulationResponse };
