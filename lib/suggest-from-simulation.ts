/**
 * Suggest from Simulation — pure prompt assembly grounded in the curated
 * workspace simulation collection (questions + exercises authors have kept).
 */

import {
  listSimulationCollectionItems,
  type SimulationCollection,
  type SimulationCollectionItem,
} from "@/lib/workspace-simulation-collection";

export type SuggestFromSimulationContext = {
  surface?: string | null;
  draftPrompt?: string | null;
  workspaceTitle?: string | null;
  workspaceGoal?: string | null;
  limit?: number;
};

export type SimulationPromptSuggestion = {
  id: string;
  label: string;
  prompt: string;
  sourceItemIds: string[];
  rationale: string;
};

function clean(s: unknown): string {
  return String(s ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function clip(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Build prompt suggestions from curated simulation items.
 */
export function buildSuggestFromSimulation(
  collection: SimulationCollection | null | undefined,
  context: SuggestFromSimulationContext = {},
): SimulationPromptSuggestion[] {
  const items = listSimulationCollectionItems(collection);
  const limit = Math.max(1, Math.min(context.limit ?? 5, 12));
  const draft = clean(context.draftPrompt);
  const surface = clean(context.surface) || "map build";
  const wsTitle = clean(context.workspaceTitle) || "this workspace";
  const wsGoal = clean(context.workspaceGoal);

  if (items.length === 0) {
    return [
      {
        id: "simulation-empty-0",
        label: "No curated simulation yet",
        prompt: [
          draft ? `Continue from: ${clip(draft, 120)}.` : null,
          `Generate ${surface} content for “${wsTitle}” that surfaces what learners might not know they don't know.`,
          wsGoal ? `Workspace goal: ${clip(wsGoal, 140)}.` : null,
          "Prefer topics that could later become simulation questions or solo exercises.",
        ]
          .filter(Boolean)
          .join(" "),
        sourceItemIds: [],
        rationale: "Collection empty — generic simulation-oriented framing.",
      },
    ];
  }

  const suggestions: SimulationPromptSuggestion[] = [];

  // Aggregate: mix of questions + exercises
  {
    const questions = items.filter((i) => i.kind === "question").slice(0, 4);
    const exercises = items.filter((i) => i.kind === "exercise").slice(0, 4);
    const corpus = [...questions, ...exercises];
    if (corpus.length) {
      const bullets = corpus
        .map((i) => `- (${i.kind}) ${clip(i.text, 160)}`)
        .join("\n");
      const prompt = [
        "Use the following curated simulation probes as context for generation:",
        bullets,
        draft ? `Author draft: ${clip(draft, 100)}.` : null,
        wsGoal ? `Workspace goal: ${clip(wsGoal, 120)}.` : null,
        `Produce a ${surface} topic/prompt for “${wsTitle}” that bridges or expands these unknowns.`,
      ]
        .filter(Boolean)
        .join("\n");
      suggestions.push({
        id: "simulation-aggregate",
        label: `From ${corpus.length} curated probes`,
        prompt,
        sourceItemIds: corpus.map((i) => i.id),
        rationale: "Mixed questions + exercises from the Simulation tab collection.",
      });
    }
  }

  // Individual high-signal items
  for (const item of items) {
    if (suggestions.length >= limit) break;
    suggestions.push(itemToSuggestion(item, { draft, surface, wsTitle, wsGoal }));
  }

  return suggestions.slice(0, limit);
}

function itemToSuggestion(
  item: SimulationCollectionItem,
  ctx: {
    draft: string;
    surface: string;
    wsTitle: string;
    wsGoal: string;
  },
): SimulationPromptSuggestion {
  const originLabel =
    item.origin.kind === "block"
      ? `block ${clean(item.origin.blockTitle) || item.origin.blockId.slice(0, 8)}`
      : item.origin.kind === "multi_block"
        ? `${item.origin.blockIds.length} blocks`
        : "workspace";
  const prompt = [
    `Simulation ${item.kind} (${originLabel}): ${clip(item.text, 280)}`,
    item.coachCue ? `Coach cue: ${clip(item.coachCue, 120)}.` : null,
    item.modifierPrompt
      ? `Original modifier: ${clip(item.modifierPrompt, 100)}.`
      : null,
    ctx.draft ? `Author draft: ${clip(ctx.draft, 100)}.` : null,
    ctx.wsGoal ? `Workspace goal: ${clip(ctx.wsGoal, 120)}.` : null,
    `Turn this unknown into a concrete ${ctx.surface} generation prompt for “${ctx.wsTitle}”.`,
  ]
    .filter(Boolean)
    .join(" ");
  return {
    id: `simulation-item-${item.id}`,
    label: clip(`${item.kind}: ${item.text}`, 48),
    prompt,
    sourceItemIds: [item.id],
    rationale: `Curated ${item.kind} from ${originLabel}`,
  };
}
