/**
 * Canonical Free Energy Principle names for the unsys model.
 * Stored keys (territory, try/hold/drop/insight, scout) stay for persistence.
 * Visitor-facing FEP copy uses these names: generative model, hidden state,
 * state factor, observation, action, policy. Do not call the generative model a
 * map, or a Concept an object, on FEP public surfaces.
 *
 * Workspace chapter grids, TAPBench Knowledge Mapping, and Map of Knowledge
 * research copy are other surfaces and may still say "map".
 */

export const LEARNING_MODEL_NAME = "unsys model" as const;
export const LEARNING_MODEL_PUBLIC_LABEL = "Unsys model" as const;

export const FEP_CONCEPT_NAMES = [
  "generative model",
  "hidden state",
  "state factor",
  "observation",
  "action",
  "policy",
] as const;

/** Files whose visitor strings must use FEP names. Add new explainer copy here. */
export const FEP_PUBLIC_SURFACE_FILES = [
  "lib/learning-model/vocabulary.ts",
  "lib/learning-model/action-catalog.ts",
  "lib/science/learning-model-copy.ts",
  "lib/science/hub.ts",
  "app/science/learning-model/page.tsx",
  "components/science/LearningModelScene.tsx",
  "components/science/LearningModelPipelines.tsx",
  "components/science/LearningModelMarks.tsx",
  "components/science/LearningModelFactorCopy.tsx",
] as const;

const BANNED_MAP = ["m", "ap"].join("");
const BANNED_OBJECT = ["obj", "ect"].join("");

export const FEP_PUBLIC_BANNED = [
  {
    id: BANNED_MAP,
    pattern: new RegExp(`\\b${BANNED_MAP}s?\\b`, "i"),
    use: "generative model",
  },
  {
    id: BANNED_OBJECT,
    pattern: new RegExp(`\\b${BANNED_OBJECT}s?\\b`, "i"),
    use: "Concept",
  },
] as const;

export function fepPublicCopyViolations(text: string): string[] {
  return FEP_PUBLIC_BANNED.filter((row) => row.pattern.test(text)).map(
    (row) => `${row.id} (use ${row.use})`,
  );
}

export const LEARNING_MODEL_OBJECTS = [
  {
    id: "generative-model",
    name: "Generative model",
    symbol: "G*",
    stored: "session branch field",
    meaning:
      "The frozen hierarchical model of how this topic generates observations. Written before a session starts and held still so later work can be projected onto it.",
  },
  {
    id: "hidden-state",
    name: "Hidden state",
    symbol: "s",
    stored: "branch / still",
    meaning:
      "One discrete hypothesis on the generative model. Focusing on a hidden state is entertaining that hypothesis. Live inference names the hidden state the work is on.",
  },
  {
    id: "state-factor",
    name: "State factor",
    symbol: "f",
    stored: "territory",
    meaning:
      "Which family of hidden states a hidden state belongs to. Hidden states that share a state factor are alternative explanations of the same coarser hidden state.",
  },
  {
    id: "observation",
    name: "Observation",
    symbol: "o",
    stored: "observation",
    meaning:
      "What we would expect while the user is focusing on this hidden state. Learner work is projected onto the generative model by matching it to this observation.",
  },
  {
    id: "action",
    name: "Action",
    symbol: "u",
    stored: "session mark",
    meaning:
      "Travel along a priced edge from the current hidden state to another. Each edge has an expected-free-energy price. A lower price is the preferred next policy.",
  },
  {
    id: "policy",
    name: "Policy",
    symbol: "π",
    stored: "hidden-state sequence",
    meaning:
      "A sequence of hidden states, or the cheapest outgoing edge on the generative model. Projection lands learner work on a policy without grading prose.",
  },
] as const;

export type LearningModelObjectId = (typeof LEARNING_MODEL_OBJECTS)[number]["id"];

export function learningModelObject(
  id: LearningModelObjectId,
): (typeof LEARNING_MODEL_OBJECTS)[number] {
  return LEARNING_MODEL_OBJECTS.find((row) => row.id === id)!;
}
