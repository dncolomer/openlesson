/**
 * Public explainer for the unsys model.
 * Visitor copy uses FEP names: generative model, hidden state, state factor,
 * observation, action, policy. Calibrate, Learn, and Verify are how the system
 * uses that model. Do not call the generative model a map.
 */

import { LEARNING_MODEL_OBJECTS } from "@/lib/learning-model";

export const SCIENCE_LEARNING_MODEL_PATH = "/science/learning-model" as const;

export const SCIENCE_LEARNING_MODEL_TERMS = [
  "generative model",
  "hidden state",
  "state factor",
  "observation",
  "action",
  "policy",
  "priced edge",
  "Calibrate",
  "Learn",
  "Verify",
  "projection",
  "expected free energy",
  "cost",
  "distance",
] as const;

export const SCIENCE_LEARNING_MODEL_COPY = {
  eyebrow: "UNSYS MODEL",
  title: "A generative model you can act on.",
  lead:
    "The unsys model is a generative model of a concept the user is trying to learn or verify: hidden states, state factors, observations, priced edges, and policies. Our system generates a learning simulation of that model and uses it to calibrate sessions, verify knowledge, and steer learning.",
  foundationTitle: "Where this comes from",
  foundation:
    "Karl Friston’s Free Energy Principle says living systems keep a generative model of the world, then act to reduce uncertainty about its hidden states. A mismatch between the observation a hidden state would generate and what the learner produces is a surprise. We use those Concepts for Calibrate, Learn, and Verify. We do not compute variational free energy, and we do not claim the full formal theory.",
  howTitle: "What the system does",
  how:
    "Before a session starts we freeze a generative model of the concept. Related hidden states share a state factor. Each hidden state carries an observation: what we would expect while focusing on it. An action is travel along a priced edge from the current hidden state to another, with a cost: its expected-free-energy price. A policy is a sequence of those hidden states, or the cheapest outgoing edge. Taps, speech, and canvas work are projected onto a policy. Learn shows those costs so the policy can steer. Verify hides them and scores distance from the cheapest policy.",
  conceptsTitle: "The six Concepts",
  modesTitle: "Three sessions, one generative model",
  projectionTitle: "Projection",
  projectionHeading: "Work projects onto a policy.",
  projection:
    "Taps, canvas work, or one spoken plan are projected onto a nearby hidden state on the frozen generative model. That travel is an action: a priced edge. The check is whether that projection matches the cheapest policy. Expected free energy is the influence on those costs. Learn shows the costs. Verify hides them and records distance from the cheapest policy. The system records which policy the user followed while learning or verifying.",
  calibrate:
    "The user taps hidden states they would not trust themselves on, for the concept they are trying to learn or verify. Taps that stay on one state factor are a hole. Speech about how they would look next is projected onto nearby hidden states of the same state factor. The result is a prior over hidden states: the starting point Learn and Verify later price against.",
  learn:
    "The user talks, writes, and draws. Live inference projects that work onto hidden-state travel on priced edges. The cheapest outgoing edge is the preferred next policy, and those costs stay visible so the policy can steer learning.",
  verify:
    "The same projection, on a clock, for someone whose knowledge we are verifying. Edge costs stay hidden. Each projected step is compared with the cheapest priced edge on that hidden state. Distance is the average of how much more those steps cost. Distance 0 means every step followed the cheapest policy. The score is stored with the identity they claimed.",
  caveat:
    "The Free Energy Principle is an influence on the unsys model. We do not claim that Uncertain Systems is Friston’s full formal theory, and we do not claim completed FEP empirical results.",
  explorerTitle: "A small generative model",
  explorerLead:
    "Integrals is a frozen generative model of the concept the user is trying to learn or verify. Three state factors structure it: Meaning, Technique, and Setup. A hidden state can open several finer hidden states at the same depth. Each hidden state carries an observation: what we would expect while focusing on it. Travel from a hidden state is a priced edge: the expected-free-energy cost of going to the next hidden state. Costs change with the hidden state you are on. Switch the explorer between Learn and Verify. In Learn the costs stay visible and the cheapest edge is marked as the policy, so the policy can steer. In Verify the costs stay hidden; each step is scored as distance from that cheapest policy. Click or drag a hidden state, then take an edge.",
  explorerOpening:
    "You are on Integrals, the frozen generative model. Click or drag a hidden state, then take a priced edge.",
  explorerDragHint: "Drag a hidden state. It returns.",
  explorerLearnCaption:
    "Edge costs stay visible. The cheapest outgoing hidden state is the policy.",
  explorerVerifyCaption:
    "Edge costs stay hidden. Distance is how much more each travel cost than the cheapest policy, averaged over the steps.",
  schematicTitle: "Integrals",
  schematicLead:
    "One frozen generative model of Integrals. Three state factors, each with its own color. Hidden states branch off those factors: one hidden state can have several finer hidden states at the same depth. The observation sits on the hidden state you are on. Priced edges leave that hidden state for another, each with a cost that depends on where you are.",
  pipelinesTitle: "Calibrate, Learn, Verify",
  pipelinesLead:
    "The same frozen generative model. Calibrate builds a prior over hidden states. Learn follows a policy: edge costs stay visible, and the cheapest outgoing hidden state is the compass. Verify hides those costs and measures distance from the cheapest policy.",
} as const;

export const SCIENCE_LEARNING_MODEL_CONCEPT_BLURBS: Record<string, string> = {
  "generative-model":
    "The generative model represents a concept's hidden states, our observations of those states, and the priced edges that travel between them. Our system generates a learning simulation of this model that is then used to calibrate the learner's sessions, verify someone's knowledge, and serve as a learning compass to help someone learn more optimally.",
  "hidden-state":
    "A hidden state represents one hypothesis about the concept that the user is trying to learn or verify. The system infers which hidden state the user is focusing on while calibrating, learning, or verifying.",
  "state-factor":
    "A state factor represents one dimension of the concept, grouping the hidden states that answer the same kind of question. The system uses state factors to structure the generative model so calibration can find where understanding is thin, and so learning and verification stay oriented to that dimension.",
  observation:
    "An observation represents what we would expect while the user is focusing on a hidden state. The system keeps that observation with the hidden state and uses it, in calibration, learning, and verification, to project what the learner produces onto the generative model.",
  action:
    "An action represents travel from the current hidden state to another along a priced edge, and how that travel changes what we can learn about the concept. Each edge carries a cost: its expected-free-energy price. The system shows those costs while learning so the cheapest policy can steer, and records the same costs as distance while verifying.",
  policy:
    "A policy represents a sequence of hidden states through the generative model, or the cheapest outgoing edge from the current hidden state. The system uses that cheapest policy as the learning compass. Calibration writes the prior the policy will use; learning shows the cheapest edge; verification scores distance from it.",
};

export const SCIENCE_LEARNING_MODEL_MODES = [
  {
    id: "calibrate",
    name: "Calibrate",
    job: "Build a prior over hidden states",
    input: "Tap hidden states you would not trust",
    projection: "Spoken plan onto nearby hidden states of the same state factor",
    result: "A prior: lost, localized, coverage, or unsettled",
    body: SCIENCE_LEARNING_MODEL_COPY.calibrate,
  },
  {
    id: "learn",
    name: "Learn",
    job: "Follow a policy",
    input: "Talk, write, draw",
    projection: "Canvas work onto priced edges, costs visible",
    result: "A kept posterior",
    body: SCIENCE_LEARNING_MODEL_COPY.learn,
  },
  {
    id: "verify",
    name: "Verify",
    job: "Measure the policy",
    input: "Work the concept before the clock ends",
    projection: "Canvas work onto priced edges, costs hidden",
    result: "Distance from the cheapest policy",
    body: SCIENCE_LEARNING_MODEL_COPY.verify,
  },
] as const;

export type ScienceLearningModelFactor = {
  id: string;
  label: string;
  color: string;
  states: readonly {
    id: string;
    title: string;
    parentId: string;
    observation: string;
  }[];
};

/** Equal-luminance factor colors: gold, teal, rose. No factor is the “main” one. */
export const SCIENCE_LEARNING_MODEL_FACTORS: readonly ScienceLearningModelFactor[] = [
  {
    id: "meaning",
    label: "Meaning",
    color: "#d4b45a",
    states: [
      {
        id: "accumulation",
        title: "Accumulation",
        parentId: "integrals",
        observation:
          "We are focusing on this if the observation is a quantity whose net change equals the integral of its rate over the interval.",
      },
      {
        id: "signed-area",
        title: "Signed area",
        parentId: "accumulation",
        observation:
          "We are focusing on this if the observation is a graph of the integrand: area above the axis counted positive, area below counted negative.",
      },
      {
        id: "net-change",
        title: "Net change",
        parentId: "accumulation",
        observation:
          "We are focusing on this if the observation is F(b) - F(a): the net change of a quantity from a to b.",
      },
      {
        id: "antiderivative",
        title: "Antiderivative",
        parentId: "net-change",
        observation:
          "We are focusing on this if the observation is a function F with F' = f, and the definite integral equals F(b) - F(a).",
      },
    ],
  },
  {
    id: "technique",
    label: "Technique",
    color: "#5ab8b4",
    states: [
      {
        id: "riemann",
        title: "Riemann sum",
        parentId: "integrals",
        observation:
          "We are focusing on this if the observation is a sum of slice areas, width Δx, that approaches the integral as Δx goes to zero.",
      },
      {
        id: "substitution",
        title: "Substitution",
        parentId: "riemann",
        observation:
          "We are focusing on this if the observation is a composition inside the integrand that inverts by setting u = g(x) and rewriting the differential.",
      },
      {
        id: "parts",
        title: "By parts",
        parentId: "riemann",
        observation:
          "We are focusing on this if the observation is a product in the integrand that splits as the integral of u dv = uv minus the integral of v du.",
      },
      {
        id: "fractions",
        title: "Fractions",
        parentId: "riemann",
        observation:
          "We are focusing on this if the observation is a rational integrand split into simpler terms whose integrals are already known.",
      },
    ],
  },
  {
    id: "setup",
    label: "Setup",
    color: "#c47aa0",
    states: [
      {
        id: "indefinite",
        title: "Indefinite",
        parentId: "integrals",
        observation:
          "We are focusing on this if the observation is a family of functions plus C, with no limits on the integral.",
      },
      {
        id: "definite",
        title: "Definite",
        parentId: "indefinite",
        observation:
          "We are focusing on this if the observation is a number: net accumulation from a to b.",
      },
      {
        id: "limits",
        title: "Limits",
        parentId: "definite",
        observation:
          "We are focusing on this if the observation is the bounds a and b that close the accumulation.",
      },
      {
        id: "differential",
        title: "Differential",
        parentId: "definite",
        observation:
          "We are focusing on this if the observation is a named variable of integration, the infinitesimal width of each slice.",
      },
    ],
  },
] as const;

export type ScienceLearningModelColoredPart = {
  text: string;
  color: string | null;
};

/** Split visitor copy so Meaning / Technique / Setup can take the factor colors from the visual. */
export function splitFactorColoredParts(text: string): ScienceLearningModelColoredPart[] {
  const byLabel = new Map(
    SCIENCE_LEARNING_MODEL_FACTORS.map((factor) => [factor.label, factor.color]),
  );
  const labels = SCIENCE_LEARNING_MODEL_FACTORS.map((factor) => factor.label).join("|");
  const pattern = new RegExp(`\\b(${labels})\\b`, "g");
  const parts: ScienceLearningModelColoredPart[] = [];
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > last) {
      parts.push({ text: text.slice(last, index), color: null });
    }
    parts.push({ text: match[0], color: byLabel.get(match[0]) ?? null });
    last = index + match[0].length;
  }
  if (last < text.length) {
    parts.push({ text: text.slice(last), color: null });
  }
  return parts.length > 0 ? parts : [{ text, color: null }];
}

export type ScienceLearningModelNode = {
  id: string;
  title: string;
  parentId: string | null;
  factorId: string;
  observation: string;
};

export const SCIENCE_LEARNING_MODEL_ROOT: ScienceLearningModelNode = {
  id: "integrals",
  title: "Integrals",
  parentId: null,
  factorId: "root",
  observation:
    "We are focusing on this if the observation is a quantity accumulated from a rate. The user is trying to learn or verify what an integral is.",
};

export const SCIENCE_LEARNING_MODEL_EXAMPLE = {
  generativeModel: "Integrals",
  stateFactor: "Meaning",
  hiddenStates: SCIENCE_LEARNING_MODEL_FACTORS.flatMap((factor) =>
    factor.states.map((state) => ({
      id: state.id,
      title: state.title,
      observation: state.observation,
      factorId: factor.id,
    })),
  ),
} as const;

export function scienceLearningModelNodes(): ScienceLearningModelNode[] {
  return [
    SCIENCE_LEARNING_MODEL_ROOT,
    ...SCIENCE_LEARNING_MODEL_FACTORS.flatMap((factor) =>
      factor.states.map((state) => ({
        id: state.id,
        title: state.title,
        parentId: state.parentId,
        factorId: factor.id,
        observation: state.observation,
      })),
    ),
  ];
}

export function scienceLearningModelFactor(factorId: string) {
  return SCIENCE_LEARNING_MODEL_FACTORS.find((row) => row.id === factorId) ?? null;
}

export type ScienceLearningModelEdge = {
  toId: string;
  title: string;
  cost: number;
  kind: "child" | "parent";
};

function roundCost(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Outgoing priced edges from this hidden state: children, then the parent. */
export function scienceLearningModelOutgoingEdges(focusId: string): ScienceLearningModelEdge[] {
  const nodes = scienceLearningModelNodes();
  const focus = nodes.find((row) => row.id === focusId) ?? SCIENCE_LEARNING_MODEL_ROOT;
  const children = nodes.filter((row) => row.parentId === focus.id);
  const edges: ScienceLearningModelEdge[] = children.map((child, index) => ({
    toId: child.id,
    title: child.title,
    cost: roundCost(0.3 + index * 0.5),
    kind: "child",
  }));
  if (focus.parentId) {
    const parent = nodes.find((row) => row.id === focus.parentId);
    if (parent) {
      edges.push({
        toId: parent.id,
        title: parent.title,
        cost: 1.8,
        kind: "parent",
      });
    }
  }
  return edges;
}

export function scienceLearningModelCheapestEdge(
  focusId: string,
): ScienceLearningModelEdge | null {
  const edges = scienceLearningModelOutgoingEdges(focusId);
  if (edges.length === 0) return null;
  return edges.slice().sort((a, b) => a.cost - b.cost || a.toId.localeCompare(b.toId))[0] ?? null;
}

export function scienceLearningModelTravel(
  focusId: string,
  toId: string,
): {
  focusId: string;
  log: string;
  edge: ScienceLearningModelEdge | null;
  cheapest: ScienceLearningModelEdge | null;
  excess: number;
} {
  const nodes = scienceLearningModelNodes();
  const focus = nodes.find((row) => row.id === focusId) ?? SCIENCE_LEARNING_MODEL_ROOT;
  const edges = scienceLearningModelOutgoingEdges(focus.id);
  const cheapest = scienceLearningModelCheapestEdge(focus.id);
  const edge = edges.find((row) => row.toId === toId) ?? null;
  if (!edge) {
    return {
      focusId: focus.id,
      log: `Still on hidden state ${focus.title}.`,
      edge: null,
      cheapest,
      excess: 0,
    };
  }
  const target = nodes.find((row) => row.id === edge.toId) ?? SCIENCE_LEARNING_MODEL_ROOT;
  const factor = scienceLearningModelFactor(target.factorId);
  const excess = roundCost(Math.max(0, edge.cost - (cheapest?.cost ?? edge.cost)));
  const siblings = edges.filter((row) => row.kind === "child" && row.toId !== edge.toId);
  const siblingTitles = siblings.map((row) => row.title).join(", ");
  const branch =
    edge.kind === "child" && siblings.length > 0
      ? ` Other hidden states at this depth: ${siblingTitles}.`
      : "";
  const factorBit = factor ? ` (${factor.label} state factor)` : "";
  return {
    focusId: target.id,
    log: `Travel to hidden state ${target.title}${factorBit}.${branch}`,
    edge,
    cheapest,
    excess,
  };
}

export function scienceLearningModelPolicyDistance(
  startId: string,
  toIds: readonly string[],
): { focusId: string; excess: number; steps: number; distance: number } {
  let focusId = startId;
  let excess = 0;
  for (const toId of toIds) {
    const step = scienceLearningModelTravel(focusId, toId);
    excess = roundCost(excess + step.excess);
    focusId = step.focusId;
  }
  const steps = toIds.length;
  return {
    focusId,
    excess,
    steps,
    distance: roundCost(excess / Math.max(1, steps)),
  };
}

export function formatScienceLearningModelCost(cost: number): string {
  return cost.toFixed(1);
}

export function getScienceLearningModelFullText(): string {
  const concepts = LEARNING_MODEL_OBJECTS.map(
    (row) => `${row.name} ${SCIENCE_LEARNING_MODEL_CONCEPT_BLURBS[row.id] ?? row.meaning}`,
  ).join("\n");
  const modes = SCIENCE_LEARNING_MODEL_MODES.map((row) => `${row.name} ${row.job} ${row.body}`).join("\n");
  const copy = SCIENCE_LEARNING_MODEL_COPY;
  const factors = SCIENCE_LEARNING_MODEL_FACTORS.map((row) => row.label).join(" ");
  return [
    copy.eyebrow,
    copy.title,
    copy.lead,
    copy.foundationTitle,
    copy.foundation,
    copy.howTitle,
    copy.how,
    copy.conceptsTitle,
    copy.schematicTitle,
    copy.schematicLead,
    copy.pipelinesTitle,
    copy.pipelinesLead,
    concepts,
    modes,
    copy.projectionHeading,
    copy.projection,
    copy.caveat,
    copy.explorerTitle,
    copy.explorerLead,
    copy.explorerOpening,
    copy.explorerDragHint,
    copy.explorerLearnCaption,
    copy.explorerVerifyCaption,
    SCIENCE_LEARNING_MODEL_EXAMPLE.generativeModel,
    SCIENCE_LEARNING_MODEL_EXAMPLE.stateFactor,
    factors,
  ].join("\n");
}
