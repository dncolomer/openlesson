/**
 * Public explainer for the unsys model.
 * Visitor copy uses FEP names: generative model, hidden state, state factor,
 * observation, action, policy. Calibrate, Learn, and Verify are how the system
 * uses that model. Do not call the generative model a map.
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
  "observation",
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
  "cost",
  "distance",
] as const;

export const SCIENCE_LEARNING_MODEL_COPY = {
  eyebrow: "UNSYS MODEL",
  title: "A generative model you can act on.",
  lead:
    "The unsys model is a generative model of a concept the user is trying to learn or verify: hidden states, state factors, observations, actions, and policies. Our system generates a learning simulation of that model and uses it to calibrate sessions, verify knowledge, and steer learning.",
  foundationTitle: "Where this comes from",
  foundation:
    "Karl Friston’s Free Energy Principle says living systems keep a generative model of the world, then act to reduce uncertainty about its hidden states. A mismatch between the observation a hidden state would generate and what the learner produces is a surprise. We use those Concepts for Calibrate, Learn, and Verify. We do not compute variational free energy, and we do not claim the full formal theory.",
  howTitle: "What the system does",
  how:
    "Before a session starts we freeze a generative model of the concept. Related hidden states share a state factor. Each hidden state carries an observation: what we would expect while focusing on it. An action is a move from the current hidden state, with a cost: its expected-free-energy price. A policy is a sequence of those actions, or the cheapest next action. Taps, speech, and canvas work are projected onto a policy. Learn shows those costs so the policy can steer. Verify hides them and scores distance from the cheapest policy.",
  conceptsTitle: "The six Concepts",
  catalogsTitle: "Actions",
  catalogsLead:
    "An action is a move from the current hidden state. Live sessions use four: Forage, Exploit, Avoid, Infer. Eight and sixteen are finer catalogs a workspace or a flow can pick. Each action below includes a move a learner would make on Integrals, and how the system classifies it.",
  fourTitle: "4 actions",
  fourLead:
    "Forage seeks information. Exploit settles the current hidden state. Avoid withdraws. Infer crafts the insight: the hidden state the work found. That four-action policy is what a live session uses. Each action has a cost on the current hidden state: cheaper is the preferred policy. In Learn those costs stay visible; in Verify they stay hidden and the score is distance from the cheapest policy. The Integrals lines are the observations we would project onto each action.",
  eightLead:
    "Adds travel on the generative model (Descend, Ascend, Switch) and splits foraging into Sample and Predict. Same Integrals concept; finer actions.",
  sixteenLead:
    "Adds precision, prediction error, and prior preference over observations. Same Integrals concept; the full catalog.",
  modesTitle: "Three sessions, one generative model",
  projectionTitle: "Projection",
  projectionHeading: "Work projects onto a policy.",
  projection:
    "Taps, canvas work, or one spoken plan are projected onto a hidden state or an action on the frozen generative model. The check is whether that projection matches the cheapest policy, or a nearby hidden state. Expected free energy is the influence on those costs. Learn shows the costs. Verify hides them and records distance from the cheapest policy. The system records which policy the user followed while learning or verifying.",
  calibrate:
    "The user taps hidden states they would not trust themselves on, for the concept they are trying to learn or verify. Taps that stay on one state factor are a hole. Speech about how they would look next is projected onto nearby hidden states of the same state factor. The result is a prior over hidden states: the starting point Learn and Verify later price against.",
  learn:
    "The user talks, writes, and draws. That work is projected onto Forage, Exploit, Avoid, and Infer. Each action on the current hidden state has a cost: its expected-free-energy price. The cheapest cost is the preferred next policy, and those costs stay visible so the policy can steer learning. Infer records the insight: the hidden state they found.",
  verify:
    "The same projection, on a clock, for someone whose knowledge we are verifying. Action costs stay hidden. Each projected action is compared with the cheapest policy on that hidden state. Distance is the average of how much more those actions cost. Distance 0 means every step followed the cheapest policy. The score is stored with the identity they claimed.",
  caveat:
    "The Free Energy Principle is an influence on the unsys model. We do not claim that Uncertain Systems is Friston’s full formal theory, and we do not claim completed FEP empirical results.",
  explorerTitle: "A small generative model",
  explorerLead:
    "Integrals is a frozen generative model of the concept the user is trying to learn or verify. Three state factors structure it: Meaning, Technique, and Setup. A hidden state can open several finer hidden states at the same depth. Each hidden state carries an observation: what we would expect while focusing on it. Each of the four actions from that hidden state has a cost: the expected-free-energy price of taking it. Costs change with the hidden state you are on. Forage is cheap while finer hidden states remain; Infer is cheap on a leaf. Switch the explorer between Learn and Verify. In Learn the costs stay visible and the cheapest action is marked as the policy, so the policy can steer. In Verify the costs stay hidden; each action you take is scored as distance from that cheapest policy. Click or drag a hidden state, then take an action. The system uses the same four actions a live session uses to learn or verify.",
  explorerOpening:
    "You are on Integrals, the frozen generative model. Click or drag a hidden state, or take an action.",
  explorerDragHint: "Drag a hidden state. It returns.",
  explorerLearnCaption:
    "Action costs stay visible. The cheapest action is the policy.",
  explorerVerifyCaption:
    "Action costs stay hidden. Distance is how much more each action cost than the cheapest policy, averaged over the steps.",
  schematicTitle: "Integrals",
  schematicLead:
    "One frozen generative model of Integrals. Three state factors, each with its own color. Hidden states branch off those factors: one hidden state can have several finer hidden states at the same depth. The observation sits on the hidden state you are on. Actions leave that hidden state, each with a cost that depends on where you are.",
  pipelinesTitle: "Calibrate, Learn, Verify",
  pipelinesLead:
    "The same frozen generative model. Calibrate builds a prior over hidden states. Learn follows a policy: action costs stay visible, and the cheapest action is the compass. Verify hides those costs and measures distance from the cheapest policy.",
} as const;

export const SCIENCE_LEARNING_MODEL_CONCEPT_BLURBS: Record<string, string> = {
  "generative-model":
    "The generative model represents a concept's hidden states, our observations of those states, and how certain actions affect what we learn about it. Our system generates a learning simulation of this model that is then used to calibrate the learner's sessions, verify someone's knowledge, and serve as a learning compass to help someone learn more optimally.",
  "hidden-state":
    "A hidden state represents one hypothesis about the concept that the user is trying to learn or verify. The system observes which hidden state the user is focusing on, and treats Infer as the moment that work finds a hidden state, while calibrating, learning, or verifying.",
  "state-factor":
    "A state factor represents one dimension of the concept, grouping the hidden states that answer the same kind of question. The system uses state factors to structure the generative model so calibration can find where understanding is thin, and so learning and verification stay oriented to that dimension.",
  observation:
    "An observation represents what we would expect while the user is focusing on a hidden state. The system keeps that observation with the hidden state and uses it, in calibration, learning, and verification, to project what the learner produces onto the generative model.",
  action:
    "An action represents a move from the current hidden state, and how taking it changes what we can learn about the concept. Each action carries a cost: its expected-free-energy price from that hidden state. The system generates the allowed actions at each hidden state, shows those costs while learning so the cheapest policy can steer, and records the same costs as distance while verifying.",
  policy:
    "A policy represents a sequence of actions through the generative model, or the next preferred action from the current hidden state: the one with the cheapest cost. The system uses that cheapest policy as the learning compass. Calibration writes the prior the policy will use; learning shows the cheapest action; verification scores distance from it.",
};

export const SCIENCE_LEARNING_MODEL_ACTION_HINTS: Record<string, string> = {
  forage: "Seek information on this hidden state.",
  exploit: "Settle this hidden state.",
  avoid: "Withdraw from this hidden state.",
  infer: "Craft the insight: the hidden state you found.",
};

/**
 * Natural-language Integrals moves the system would classify as each action.
 * Every catalog action id must have a row.
 */
export const SCIENCE_LEARNING_MODEL_ACTION_EXAMPLES: Record<string, string> = {
  forage:
    "You are on Accumulation and you say you still cannot tell whether the integral is net change or signed area. You sketch rectangles under y = x² from 0 to 1 to get a finer observation. We classify that as Forage: seeking information and opening a finer hidden state on the Meaning state factor.",
  exploit:
    "You write F(1) - F(0) for the integral of 2x from 0 to 1, treat Antiderivative as precise enough, and go on to the next integrand. We classify that as Exploit: settling the current hidden state and acting on a preferred outcome.",
  avoid:
    "You start a u-substitution on the integral of x cos(x), see a product in the integrand rather than a composition, and drop that line. We classify that as Avoid: this is not the hidden state in focus, so you withdraw.",
  infer:
    "You write that the definite integral is the net change of an antiderivative, the Fundamental Theorem. We classify that as Infer: crafting the insight, the hidden state the work found.",
  descend:
    "You are on Riemann sum and you open Substitution, one of the finer hidden states at this depth on Technique, beside By parts and Fractions. We classify that as Descend: travel to a finer hidden state of the same state factor.",
  ascend:
    "You leave Substitution and return to Riemann sum, the coarser hidden state on Technique. We classify that as Ascend: travel to the coarser hidden state.",
  switch:
    "You were treating the integral as Signed area; you now try Net change, a rival hidden state on Meaning at the same depth under Accumulation. We classify that as Switch.",
  sample:
    "You stay on Definite and pick a new integrand, sin(x) from 0 to pi, to see whether this hidden state still generates the observation you expect. We classify that as Sample: a new observation, no change of hidden state.",
  predict:
    "Before working the next problem you state the observation: we are focusing on Substitution if the integrand hides a composition u = g(x). We classify that as Predict: generating the observation we would expect while focusing on this hidden state.",
  divert:
    "You stop asking what the integral means and open Technique: how to compute it. We classify that as Divert: leaving one state factor for a hidden state on another.",
  dwell:
    "You stay on By parts and work the product integrands x e^x and ln(x), without changing hidden state. We classify that as Dwell: remaining in place and gathering observations.",
  reopen:
    "You had settled Definite, then you undo that and ask again whether the integral is Indefinite. We classify that as Reopen: reversing an exploit so the hidden state is open again.",
  compare:
    "You predicted F(1) - F(0) = 1 from the observation on Antiderivative; the worked integral is 1; you read the prediction error as zero. We classify that as Compare.",
  novelty:
    "You look for an integrand this hidden state would not generate — an improper limit, or a jump discontinuity — to see where the observation fails. We classify that as Novelty: seeking an unexpected observation.",
  sharpen:
    "You say you now trust the antiderivative reading of the Fundamental Theorem, and you raise precision on that hidden state. We classify that as Sharpen.",
  relax:
    "You say the substitution on this integrand might be a coincidence, and you lower precision on Substitution. We classify that as Relax: the prediction is not trusted.",
  prefer:
    "You mark a worked F(b) - F(a) as the observation you want Antiderivative to keep generating. We classify that as Prefer: updating the prior preference over observations for this hidden state.",
};

export const SCIENCE_LEARNING_MODEL_MODES = [
  {
    id: "calibrate",
    name: "Calibrate",
    job: "Build a prior over hidden states",
    input: "Tap hidden states you would not trust",
    projection: "Spoken forage onto nearby hidden states of the same state factor",
    result: "A prior: lost, localized, coverage, or unsettled",
    body: SCIENCE_LEARNING_MODEL_COPY.calibrate,
  },
  {
    id: "learn",
    name: "Learn",
    job: "Follow a policy",
    input: "Talk, write, draw, then Infer",
    projection: "Canvas work onto Forage, Exploit, Avoid, Infer, costs visible",
    result: "A kept posterior",
    body: SCIENCE_LEARNING_MODEL_COPY.learn,
  },
  {
    id: "verify",
    name: "Verify",
    job: "Measure the policy",
    input: "Work the concept before the clock ends",
    projection: "Canvas work onto the same four actions, costs hidden",
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

export function scienceLearningModelStep(
  focusId: string,
  actionId: string,
): { focusId: string; log: string } {
  const nodes = scienceLearningModelNodes();
  const focus = nodes.find((row) => row.id === focusId) ?? SCIENCE_LEARNING_MODEL_ROOT;
  const children = nodes.filter((row) => row.parentId === focus.id);
  const parent = nodes.find((row) => row.id === focus.parentId) ?? null;
  const factor = scienceLearningModelFactor(focus.factorId);
  const factorLabel = factor?.label ?? "the model";

  if (actionId === "forage") {
    const next = children[0];
    if (!next) {
      return {
        focusId: focus.id,
        log: `Forage. Still on hidden state ${focus.title}. No finer hidden state on this state factor.`,
      };
    }
    const nextFactor = scienceLearningModelFactor(next.factorId);
    const finerTitles = children.map((row) => row.title).join(", ");
    const branch =
      children.length > 1 ? ` Finer hidden states at this depth: ${finerTitles}.` : "";
    return {
      focusId: next.id,
      log: `Forage.${branch} Now on hidden state ${next.title} (${nextFactor?.label ?? factorLabel} state factor).`,
    };
  }
  if (actionId === "avoid") {
    if (!parent) {
      return {
        focusId: focus.id,
        log: `Avoid. Already on hidden state ${focus.title}, the root of the generative model.`,
      };
    }
    const parentFactor = scienceLearningModelFactor(parent.factorId);
    return {
      focusId: parent.id,
      log: `Avoid. Withdraw to hidden state ${parent.title}${parentFactor ? ` (${parentFactor.label} state factor)` : ""}.`,
    };
  }
  if (actionId === "exploit") {
    return {
      focusId: focus.id,
      log: `Exploit. Hidden state ${focus.title} is treated as settled.`,
    };
  }
  if (actionId === "infer") {
    return {
      focusId: focus.id,
      log: `Infer. The insight is hidden state ${focus.title}.`,
    };
  }
  return { focusId: focus.id, log: `Hidden state ${focus.title}.` };
}

export const SCIENCE_LEARNING_MODEL_LIVE_ACTIONS = [
  "forage",
  "exploit",
  "avoid",
  "infer",
] as const;

export type ScienceLearningModelLiveAction =
  (typeof SCIENCE_LEARNING_MODEL_LIVE_ACTIONS)[number];

export type ScienceLearningModelActionCosts = Record<
  ScienceLearningModelLiveAction,
  number
>;

function isLiveAction(id: string): id is ScienceLearningModelLiveAction {
  return (SCIENCE_LEARNING_MODEL_LIVE_ACTIONS as readonly string[]).includes(id);
}

function roundCost(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Expected-free-energy costs G(π) for the four live actions on this hidden state. */
export function scienceLearningModelActionCosts(
  focusId: string,
): ScienceLearningModelActionCosts {
  const nodes = scienceLearningModelNodes();
  const focus = nodes.find((row) => row.id === focusId) ?? SCIENCE_LEARNING_MODEL_ROOT;
  let childCount = 0;
  for (const row of nodes) {
    if (row.parentId === focus.id) childCount += 1;
  }
  const atRoot = !focus.parentId;
  const atLeaf = childCount === 0;
  if (atRoot) {
    return { forage: 0.3, exploit: 1.8, avoid: 2.2, infer: 1.6 };
  }
  if (atLeaf) {
    return { forage: 2.2, exploit: 0.7, avoid: 0.9, infer: 0.4 };
  }
  return { forage: 0.4, exploit: 1.3, avoid: 0.9, infer: 1.1 };
}

export function scienceLearningModelCheapestAction(
  focusId: string,
): ScienceLearningModelLiveAction {
  const costs = scienceLearningModelActionCosts(focusId);
  let best: ScienceLearningModelLiveAction = SCIENCE_LEARNING_MODEL_LIVE_ACTIONS[0];
  for (const id of SCIENCE_LEARNING_MODEL_LIVE_ACTIONS) {
    if (costs[id] < costs[best]) best = id;
  }
  return best;
}

export function scienceLearningModelActionScore(
  focusId: string,
  actionId: string,
): {
  cost: number;
  cheapestId: ScienceLearningModelLiveAction;
  cheapestCost: number;
  excess: number;
} {
  const costs = scienceLearningModelActionCosts(focusId);
  const cheapestId = scienceLearningModelCheapestAction(focusId);
  const cheapestCost = costs[cheapestId];
  const cost = isLiveAction(actionId) ? costs[actionId] : cheapestCost;
  return {
    cost,
    cheapestId,
    cheapestCost,
    excess: roundCost(Math.max(0, cost - cheapestCost)),
  };
}

export function scienceLearningModelPolicyDistance(
  startId: string,
  actionIds: readonly string[],
): { focusId: string; excess: number; steps: number; distance: number } {
  let focusId = startId;
  let excess = 0;
  for (const actionId of actionIds) {
    const score = scienceLearningModelActionScore(focusId, actionId);
    excess = roundCost(excess + score.excess);
    focusId = scienceLearningModelStep(focusId, actionId).focusId;
  }
  const steps = actionIds.length;
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
  const catalogs = [...LEARNING_MODEL_CATALOG_4, ...LEARNING_MODEL_CATALOG_8, ...LEARNING_MODEL_CATALOG_16]
    .map((row) => `${row.label} ${row.meaning} ${row.efe}`)
    .join("\n");
  const modes = SCIENCE_LEARNING_MODEL_MODES.map((row) => `${row.name} ${row.job} ${row.body}`).join("\n");
  const examples = Object.entries(SCIENCE_LEARNING_MODEL_ACTION_EXAMPLES)
    .map(([id, example]) => `${id} ${example}`)
    .join("\n");
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
    catalogs,
    modes,
    examples,
    copy.projectionHeading,
    copy.projection,
    copy.caveat,
    copy.fourLead,
    copy.eightLead,
    copy.sixteenLead,
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
