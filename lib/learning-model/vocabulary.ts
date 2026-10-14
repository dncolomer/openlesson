/**
 * Canonical Free Energy Principle names for the learning model.
 * Stored keys (territory, try/hold/drop/insight, scout) stay for persistence.
 * UI, settings, and science copy use these names.
 */

export const LEARNING_MODEL_NAME = "learning model" as const;

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
      "One discrete hypothesis on the generative model. Occupying a hidden state is entertaining that cause as the current focus.",
  },
  {
    id: "state-factor",
    name: "State factor",
    symbol: "f",
    stored: "territory",
    meaning:
      "Which hidden cause a hidden state belongs to. Hidden states that share a state factor are alternative explanations of the same coarser cause.",
  },
  {
    id: "likelihood",
    name: "Likelihood",
    symbol: "p(o|s)",
    stored: "observation",
    meaning:
      "The predicted observation: what occupying this hidden state would generate. Calibrate keeps it off the card.",
  },
  {
    id: "action",
    name: "Action",
    symbol: "u",
    stored: "session mark",
    meaning:
      "A legal control from the current hidden state. Each action has an expected-free-energy price. A lower price is the preferred next policy.",
  },
  {
    id: "policy",
    name: "Policy",
    symbol: "π",
    stored: "action sequence",
    meaning:
      "A set of actions, or the cheapest legal next action on the generative model. Projection lands learner work on a policy without grading prose.",
  },
] as const;

export type LearningModelObjectId = (typeof LEARNING_MODEL_OBJECTS)[number]["id"];

export function learningModelObject(
  id: LearningModelObjectId,
): (typeof LEARNING_MODEL_OBJECTS)[number] {
  return LEARNING_MODEL_OBJECTS.find((row) => row.id === id)!;
}
