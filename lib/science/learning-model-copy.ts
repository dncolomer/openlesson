/**
 * Public explainer for the learning model: generative model, hidden states,
 * state factors, likelihood, actions, and policies. Calibrate, Learn, Verify.
 */

import {
  LEARNING_MODEL_CATALOG_4,
  LEARNING_MODEL_CATALOG_8,
  LEARNING_MODEL_CATALOG_16,
  LEARNING_MODEL_OBJECTS,
} from "@/lib/learning-model";

export const SCIENCE_LEARNING_MODEL_PATH = "/science/learning-model" as const;

export const SCIENCE_LEARNING_MODEL_TERMS = [
  "generative model",
  "hidden state",
  "state factor",
  "likelihood",
  "action",
  "policy",
  "Forage",
  "Exploit",
  "Avoid",
  "Infer",
  "Calibrate",
  "Learn",
  "Verify",
  "projection",
  "expected free energy",
] as const;

export const SCIENCE_LEARNING_MODEL_COPY = {
  eyebrow: "LEARNING MODEL",
  title: "A generative model you can walk.",
  lead:
    "Before a session starts, the topic is written as a frozen generative model. You occupy hidden states, grouped by state factor. Each hidden state has a likelihood — the predicted observation. From there you take actions. A set of actions is a policy. Work is projected onto that policy. Nothing is graded as prose.",
  objectsTitle: "The objects",
  catalogsTitle: "Action catalogs",
  catalogsLead:
    "The learning model comes in three granularities. A Learning workspace picks one in Settings. A verification or calibration flow picks one when the flow is set up.",
  fourTitle: "4 actions — the core policy",
  fourLead:
    "Forage, Exploit, Avoid, Infer. Seek information, act on a preference, withdraw, or report the posterior.",
  modesTitle: "What each session does",
  projectionTitle: "Projection",
  projection:
    "Projection lands what you did — taps, canvas work, or one spoken plan — on a discrete action or hidden state of the frozen generative model. The check is whether that landing matches the cheapest policy, or a nearby hidden state. The writing itself is not scored.",
  calibrate:
    "Calibrate finds where uncertainty sits. You tap every hidden state you would not trust yourself to occupy. Taps that stay on one state factor are a hole. Taps that hop factors do not place. A marked hole can then be spoken: what is uncertain, and how you would forage. That speech is projected onto nearby hidden states.",
  learn:
    "Learn produces one inferred cause. You speak, write, and draw on the work canvas. Canvas work is projected onto Forage, Exploit, Avoid, and Infer. One accepted Infer ends the session. Prices and the cheapest next policy are visible.",
  verify:
    "Verify scores distance from the cheapest policy. You work the question on the canvas before the clock ends. The same projection onto actions runs, hidden. Distance 0 means every inferred step matched the cheapest action on the generative model. The score is stored with the identity you claimed.",
  caveat:
    "The Free Energy Principle is an influence on this learning model. We do not claim that Uncertain Systems is Friston’s full formal theory, and we do not claim completed FEP empirical results.",
  explorerTitle: "Try the 4-action policy",
  explorerLead:
    "You are occupying a hidden state on a tiny frozen generative model. Take an action. The landing is the projection.",
  schematicTitle: "The same frozen generative model",
  schematicLead:
    "One G* is written before the session. Hidden states sit on a state factor. Each hidden state carries a likelihood p(o|s). Actions leave that hidden state. A sequence of actions is a policy. Calibrate, Learn, and Verify all project onto this object.",
  pipelinesTitle: "How each session projects",
  pipelinesLead:
    "Calibrate, Learn, and Verify occupy the same G*. They differ in the work they take in, what they project onto, and what they leave behind.",
} as const;

export const SCIENCE_LEARNING_MODEL_PIPELINES = [
  {
    id: "calibrate",
    steps: [
      { label: "G*", detail: "Frozen generative model" },
      { label: "Tap", detail: "Hidden states you would not occupy" },
      { label: "State factor", detail: "Same factor is a hole. Hops do not place." },
      { label: "Forage", detail: "Speak the plan on a marked hole" },
      { label: "Projection", detail: "Speech lands on nearby hidden states" },
      { label: "Prior", detail: "lost, localized, coverage, or unsettled" },
    ],
  },
  {
    id: "learn",
    steps: [
      { label: "G*", detail: "Same frozen generative model" },
      { label: "Canvas", detail: "Speak, write, and draw" },
      { label: "Actions", detail: "Forage, Exploit, Avoid" },
      { label: "Infer", detail: "Report the posterior" },
      { label: "Projection", detail: "Canvas work lands on the four actions" },
      { label: "Posterior", detail: "One kept inferred cause" },
    ],
  },
  {
    id: "verify",
    steps: [
      { label: "G*", detail: "Same frozen generative model" },
      { label: "Clock", detail: "Work the question on the canvas" },
      { label: "Policy π", detail: "Cheapest next actions, prices hidden" },
      { label: "Projection", detail: "Canvas work lands on the same four actions" },
      { label: "Distance", detail: "0 is a perfect walk of the cheapest policy" },
      { label: "Record", detail: "Stored with the identity you claimed" },
    ],
  },
] as const;

export const SCIENCE_LEARNING_MODEL_MODES = [
  {
    id: "calibrate",
    name: "Calibrate",
    job: "Find where uncertainty sits",
    input: "Tap hidden states you would not trust yourself to occupy",
    projection: "Spoken forage onto nearby hidden states of the same state factor",
    result: "A prior: lost, localized, coverage, or unsettled",
    body: SCIENCE_LEARNING_MODEL_COPY.calibrate,
  },
  {
    id: "learn",
    name: "Learn",
    job: "Produce one inferred cause",
    input: "Speak, write, and draw, then Infer",
    projection: "Canvas work onto Forage, Exploit, Avoid, Infer",
    result: "A kept posterior (an inferred cause)",
    body: SCIENCE_LEARNING_MODEL_COPY.learn,
  },
  {
    id: "verify",
    name: "Verify",
    job: "Walk the cheapest policy",
    input: "Work the question on the canvas before the clock ends",
    projection: "Canvas work onto the same four actions, prices hidden",
    result: "Distance from the cheapest policy (0 is a perfect walk)",
    body: SCIENCE_LEARNING_MODEL_COPY.verify,
  },
] as const;

export const SCIENCE_LEARNING_MODEL_EXAMPLE = {
  generativeModel: "Ice melting",
  stateFactor: "Energy exchange",
  hiddenStates: [
    {
      id: "heat",
      title: "Heat in",
      likelihood: "If this cause is occupied, you should see temperature rising while the solid holds its shape.",
    },
    {
      id: "latent",
      title: "Latent heat",
      likelihood: "If this cause is occupied, temperature holds still while ice turns to water.",
    },
    {
      id: "phase",
      title: "Phase change",
      likelihood: "If this cause is occupied, the solid is gone and the liquid is the observation.",
    },
  ],
} as const;

export function getScienceLearningModelFullText(): string {
  const objects = LEARNING_MODEL_OBJECTS.map((row) => `${row.name} ${row.meaning}`).join("\n");
  const catalogs = [...LEARNING_MODEL_CATALOG_4, ...LEARNING_MODEL_CATALOG_8, ...LEARNING_MODEL_CATALOG_16]
    .map((row) => `${row.label} ${row.meaning} ${row.efe}`)
    .join("\n");
  const modes = SCIENCE_LEARNING_MODEL_MODES.map((row) => `${row.name} ${row.job} ${row.body}`).join("\n");
  const pipelines = SCIENCE_LEARNING_MODEL_PIPELINES.map((row) =>
    row.steps.map((step) => `${step.label} ${step.detail}`).join(" "),
  ).join("\n");
  const copy = SCIENCE_LEARNING_MODEL_COPY;
  return [
    copy.eyebrow,
    copy.title,
    copy.lead,
    copy.schematicTitle,
    copy.schematicLead,
    copy.pipelinesTitle,
    copy.pipelinesLead,
    objects,
    catalogs,
    modes,
    pipelines,
    copy.projection,
    copy.caveat,
    copy.explorerTitle,
    SCIENCE_LEARNING_MODEL_EXAMPLE.generativeModel,
    SCIENCE_LEARNING_MODEL_EXAMPLE.stateFactor,
  ].join("\n");
}
