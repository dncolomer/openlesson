/**
 * Production Data Studio demo catalog: two Verification sets and two
 * Calibration sets. Each has a priced hidden-state tree, six walks,
 * spoken traces, and Path plus Path + Text regions. No DB I/O.
 */

import {
  completeFlowEmbedding,
  flowEmbeddingModelIdForChannel,
  parseFlowEmbeddingChannel,
  type FlowEmbeddingChannel,
  type FlowEmbeddingRecord,
  type FlowKind,
} from "@/lib/flow-embedding";
import {
  createCustomVerificationModelFromVectors,
  voiceRegionName,
  type CustomVerificationModelSpec,
} from "@/lib/knowledge-config/custom-verification-model";
import { cosineSimilarity } from "@/lib/knowledge-config/math";
import {
  normalizeSessionBranchModel,
  type SessionBranchModel,
} from "@/lib/session-branch-model";

export const PRODUCTION_STUDIO_DEMO_MARKER = "[PROD:studio-demo-v1]";
export const PRODUCTION_STUDIO_DEMO_VERSION = "v1";

export type StudioDemoProduct = "verification" | "calibration";
export type StudioDemoRunKey = "ada" | "bea" | "cam" | "dev" | "eve" | "fay";

export type StudioDemoRunDef = {
  key: StudioDemoRunKey;
  identity: string;
  sequence: readonly string[];
  speech: string;
  inRegion: boolean;
};

export type StudioDemoQuestion = { id: string; text: string };

export type StudioDemoSetId =
  | "verify-limits"
  | "verify-bayes"
  | "calibrate-continuity"
  | "calibrate-conditional";

export type StudioDemoSetDef = {
  id: StudioDemoSetId;
  marker: string;
  product: StudioDemoProduct;
  flowKind: FlowKind;
  title: string;
  topic: string;
  goal: string;
  description: string;
  flowName: string;
  questions: readonly StudioDemoQuestion[];
  durationMinutes: number;
  actionCatalog: 4;
  publicTokenPrefix: string;
  regionName: string;
  regionDescription: string;
  tree: () => SessionBranchModel;
  runs: readonly StudioDemoRunDef[];
};

type TreeRegion = {
  title: string;
  question: string;
  observation: string;
  edgePrice: number;
  children?: TreeRegion[];
};

function sixRegionTree(input: {
  chapter: string;
  premise: string;
  question: string;
  territory: string;
  observation: string;
  regions: readonly [TreeRegion, TreeRegion, TreeRegion, TreeRegion, TreeRegion, TreeRegion];
}): SessionBranchModel {
  const model = normalizeSessionBranchModel(
    {
      premise: input.premise,
      question: input.question,
      territory: input.territory,
      observation: input.observation,
      regions: input.regions.map((region) => ({
        title: region.title,
        question: region.question,
        observation: region.observation,
        edgePrice: region.edgePrice,
        children: region.children?.map((child) => ({
          title: child.title,
          question: child.question,
          observation: child.observation,
          edgePrice: child.edgePrice,
        })),
      })),
    },
    input.chapter,
  );
  if (!model) throw new Error(`studio demo tree refused: ${input.chapter}`);
  return model;
}

const WALK: Record<StudioDemoRunKey, { sequence: readonly string[]; inRegion: boolean }> = {
  ada: { sequence: ["r1", "r1-c1"], inRegion: true },
  bea: { sequence: ["r1", "r1-c1"], inRegion: true },
  cam: { sequence: ["r1", "r1-c2"], inRegion: true },
  dev: { sequence: ["r2", "r2-c1"], inRegion: false },
  eve: { sequence: ["r6"], inRegion: false },
  fay: { sequence: ["r3"], inRegion: false },
};

function runs(
  speech: Record<StudioDemoRunKey, string>,
): StudioDemoRunDef[] {
  return (Object.keys(WALK) as StudioDemoRunKey[]).map((key) => ({
    key,
    identity: key,
    sequence: WALK[key].sequence,
    speech: speech[key],
    inRegion: WALK[key].inRegion,
  }));
}

function limitsTree(): SessionBranchModel {
  return sixRegionTree({
    chapter: "Limits",
    premise: "A limit is a promise about nearby values.",
    question: "What does it take to meet an arbitrary closeness challenge?",
    territory: "Epsilon-delta definition of a limit",
    observation: "The field is the set of hidden states for a limit proof.",
    regions: [
      {
        title: "Epsilon neighborhood",
        question: "What does |f(x) − L| < ε demand of nearby x?",
        observation: "The values stay inside the band.",
        edgePrice: 8,
        children: [
          {
            title: "Pick ε first",
            question: "Why is ε given before δ?",
            observation: "The challenge is arbitrary closeness.",
            edgePrice: 10,
          },
          {
            title: "Open interval",
            question: "Why is the neighborhood open?",
            observation: "Equality at the endpoint is not required.",
            edgePrice: 22,
          },
        ],
      },
      {
        title: "Delta response",
        question: "What must |x − a| < δ guarantee?",
        observation: "Every such x maps into the ε-band.",
        edgePrice: 14,
        children: [
          {
            title: "Work backwards",
            question: "How do you solve for δ from ε?",
            observation: "The algebra produces a positive δ.",
            edgePrice: 16,
          },
        ],
      },
      {
        title: "Sequence of epsilons",
        question: "What happens if ε keeps getting smaller?",
        observation: "Each smaller challenge still needs its own δ.",
        edgePrice: 36,
      },
      {
        title: "Graphical slope",
        question: "Does a steep graph near a block a delta?",
        observation: "Steepness shrinks the window but a window can remain.",
        edgePrice: 52,
      },
      {
        title: "Algebraic rearrangement",
        question: "Which algebra isolates a bound on |x − a|?",
        observation: "Factoring produces a δ in terms of ε.",
        edgePrice: 68,
      },
      {
        title: "Unrelated series test",
        question: "Does a ratio test settle this limit?",
        observation: "Series tests do not answer an ε-δ challenge.",
        edgePrice: 88,
      },
    ],
  });
}

function bayesTree(): SessionBranchModel {
  return sixRegionTree({
    chapter: "Bayes",
    premise: "A posterior is a prior rewritten by the likelihood of what was seen.",
    question: "How do you update a belief after one observation?",
    territory: "Bayes update",
    observation: "The field is the set of hidden states for a single update.",
    regions: [
      {
        title: "Write the prior",
        question: "What probability mass sits on each hypothesis before the data?",
        observation: "The prior is a distribution over hypotheses.",
        edgePrice: 11,
        children: [
          {
            title: "Normalize first",
            question: "Why must the prior sum to one before multiplying?",
            observation: "An unnormalized prior distorts the posterior.",
            edgePrice: 13,
          },
          {
            title: "Support of H",
            question: "Which hypotheses are even allowed?",
            observation: "Zero prior stays zero after the update.",
            edgePrice: 27,
          },
        ],
      },
      {
        title: "Likelihood of the observation",
        question: "How probable is the data under each hypothesis?",
        observation: "p(data | H) reweights the prior.",
        edgePrice: 19,
        children: [
          {
            title: "Multiply then normalize",
            question: "Where does the evidence p(data) enter?",
            observation: "The marginal is the sum of prior times likelihood.",
            edgePrice: 21,
          },
        ],
      },
      {
        title: "Second observation",
        question: "What happens if you see another independent datum?",
        observation: "Yesterday’s posterior is today’s prior.",
        edgePrice: 41,
      },
      {
        title: "Base-rate neglect",
        question: "What fails if you report only the likelihood?",
        observation: "The prior still belongs in the product.",
        edgePrice: 57,
      },
      {
        title: "MAP shortcut",
        question: "Does the mode of the posterior replace the full distribution?",
        observation: "A point estimate drops mass that later data may need.",
        edgePrice: 73,
      },
      {
        title: "Frequentist p-value",
        question: "Does a p-value give you p(H | data)?",
        observation: "A tail probability under a null is not a posterior.",
        edgePrice: 94,
      },
    ],
  });
}

function continuityTree(): SessionBranchModel {
  return sixRegionTree({
    chapter: "Continuity",
    premise: "Continuity at a point is a limit that equals the value there.",
    question: "Which questions would you not trust about continuity at a?",
    territory: "Continuity at a point",
    observation: "The sounding field is the hidden states of a continuity check.",
    regions: [
      {
        title: "Value at a",
        question: "Is f(a) even defined?",
        observation: "A hole at a already breaks continuity.",
        edgePrice: 7,
        children: [
          {
            title: "Limit exists",
            question: "Does lim x→a f(x) exist as a real number?",
            observation: "Both sides must agree.",
            edgePrice: 9,
          },
          {
            title: "Limit equals f(a)",
            question: "Does that limit equal the assigned value?",
            observation: "A jump or a removable fill can still fail equality.",
            edgePrice: 18,
          },
        ],
      },
      {
        title: "One-sided check",
        question: "What do the left and right limits each say?",
        observation: "A mismatch is a jump.",
        edgePrice: 12,
        children: [
          {
            title: "Oscillation",
            question: "Can the function oscillate too wildly to have a limit?",
            observation: "No δ can trap an unbounded wiggle.",
            edgePrice: 15,
          },
        ],
      },
      {
        title: "Removable discontinuity",
        question: "What if redefining f(a) would repair the graph?",
        observation: "The limit exists but was not used as the value.",
        edgePrice: 29,
      },
      {
        title: "Uniform continuity",
        question: "Is continuity on a compact interval the same as at one point?",
        observation: "A single point does not give a uniform δ.",
        edgePrice: 44,
      },
      {
        title: "Differentiability",
        question: "Does a derivative at a imply continuity there?",
        observation: "Differentiable implies continuous; the converse fails.",
        edgePrice: 61,
      },
      {
        title: "Connectedness slogan",
        question: "Does “you can draw it without lifting the pen” settle a?",
        observation: "A picture is not the ε-δ check at a point.",
        edgePrice: 81,
      },
    ],
  });
}

function conditionalTree(): SessionBranchModel {
  return sixRegionTree({
    chapter: "Conditional",
    premise: "A conditional probability is a restriction of the sample space.",
    question: "Which questions would you not trust about P(A | B)?",
    territory: "Conditional probability",
    observation: "The sounding field is the hidden states of a restriction.",
    regions: [
      {
        title: "Condition has mass",
        question: "Is P(B) strictly positive?",
        observation: "You cannot condition on a null event.",
        edgePrice: 6,
        children: [
          {
            title: "Intersection",
            question: "What is P(A ∩ B) in this experiment?",
            observation: "The numerator is the joint.",
            edgePrice: 8,
          },
          {
            title: "Ratio",
            question: "Why is P(A | B) the joint over P(B)?",
            observation: "B becomes the new whole.",
            edgePrice: 17,
          },
        ],
      },
      {
        title: "Independence",
        question: "Does P(A | B) equal P(A)?",
        observation: "Equality is the definition of independence.",
        edgePrice: 10,
        children: [
          {
            title: "Order of conditioning",
            question: "Is P(A | B) the same as P(B | A)?",
            observation: "Bayes swaps them using the two marginals.",
            edgePrice: 14,
          },
        ],
      },
      {
        title: "Law of total probability",
        question: "How do you recover P(A) from a partition of B?",
        observation: "Sum the joints over a partition.",
        edgePrice: 25,
      },
      {
        title: "Simpson reversal",
        question: "Can every subgroup reverse the aggregate association?",
        observation: "A hidden confounder can flip the sign.",
        edgePrice: 38,
      },
      {
        title: "Causation",
        question: "Does P(A | B) say that B caused A?",
        observation: "A conditional is an observation, not an intervention.",
        edgePrice: 54,
      },
      {
        title: "Bare conjunction",
        question: "Is P(A and B) already the conditional?",
        observation: "The joint still needs to be divided by P(B).",
        edgePrice: 76,
      },
    ],
  });
}

export const PRODUCTION_STUDIO_DEMO_SETS: readonly StudioDemoSetDef[] = [
  {
    id: "verify-limits",
    marker: `${PRODUCTION_STUDIO_DEMO_MARKER}:verify-limits`,
    product: "verification",
    flowKind: "verify",
    title: "Demo Verify — Limits",
    topic: "Epsilon-delta definition of a limit",
    goal: "See a Path region of cheap ε-δ walks against other Verify runs.",
    description:
      "Production Data Studio sample. Six Verify runs walk one hidden-state tree; a Path region covers the ε-δ walkers.",
    flowName: "Limits ε-δ",
    questions: [
      {
        id: "q-epsilon",
        text: "What must |f(x) − L| < ε say about values of f near a?",
      },
      {
        id: "q-delta",
        text: "How do you produce a δ that answers an arbitrary ε?",
      },
    ],
    durationMinutes: 15,
    actionCatalog: 4,
    publicTokenPrefix: "demo-v-limits",
    regionName: "ε-δ walkers",
    regionDescription: "Path-space region of the cheapest ε-δ walks (ada, bea, cam).",
    tree: limitsTree,
    runs: runs({
      ada: "I pick epsilon first, then find a delta that keeps f of x inside the band.",
      bea: "Start with the given closeness and work backwards to a window around a.",
      cam: "The neighborhood is open, so equality at the endpoint is not required.",
      dev: "I algebraically rearrange the inequality until a positive delta appears.",
      eve: "I tried a ratio test on a series instead of answering the epsilon challenge.",
      fay: "A sequence of smaller epsilons still needs a delta at each step.",
    }),
  },
  {
    id: "verify-bayes",
    marker: `${PRODUCTION_STUDIO_DEMO_MARKER}:verify-bayes`,
    product: "verification",
    flowKind: "verify",
    title: "Demo Verify — Bayes",
    topic: "Bayes update",
    goal: "See a Path region of prior-then-likelihood walks against other Verify runs.",
    description:
      "Production Data Studio sample. Six Verify runs walk one hidden-state tree; a Path region covers the Bayes walkers.",
    flowName: "Bayes update",
    questions: [
      {
        id: "q-prior",
        text: "What probability mass sits on each hypothesis before the data?",
      },
      {
        id: "q-likelihood",
        text: "How does the likelihood of one observation rewrite that prior?",
      },
    ],
    durationMinutes: 15,
    actionCatalog: 4,
    publicTokenPrefix: "demo-v-bayes",
    regionName: "Bayes walkers",
    regionDescription: "Path-space region of the cheapest Bayes updates (ada, bea, cam).",
    tree: bayesTree,
    runs: runs({
      ada: "I write a normalized prior, then multiply by the likelihood of what I saw.",
      bea: "Start with p of H, reweight by p of data given H, then divide by the evidence.",
      cam: "Zero prior on a hypothesis stays zero; I keep the support honest.",
      dev: "I report only the likelihood and skip the base rate.",
      eve: "I quoted a p-value as if it were the posterior of the hypothesis.",
      fay: "A second independent observation uses yesterday’s posterior as the new prior.",
    }),
  },
  {
    id: "calibrate-continuity",
    marker: `${PRODUCTION_STUDIO_DEMO_MARKER}:calibrate-continuity`,
    product: "calibration",
    flowKind: "calibrate",
    title: "Demo Calibrate — Continuity",
    topic: "Continuity at a point",
    goal: "Sound the hidden-state field for continuity at a before any policy is projected.",
    description:
      "Production Data Studio sample. Six Calibrate soundings of one hidden-state tree; a Path region covers the trusted continuity taps.",
    flowName: "Continuity at a",
    questions: [
      {
        id: "q-defined",
        text: "Is f(a) defined, and does the limit as x approaches a exist?",
      },
      {
        id: "q-equal",
        text: "Does that limit equal the value assigned at a?",
      },
    ],
    durationMinutes: 15,
    actionCatalog: 4,
    publicTokenPrefix: "demo-c-continuity",
    regionName: "continuity sounders",
    regionDescription: "Path-space region of the cheapest continuity soundings (ada, bea, cam).",
    tree: continuityTree,
    runs: runs({
      ada: "I would not trust a claim that skips whether f of a is defined.",
      bea: "I tap the limit existing before I ask whether it equals the assigned value.",
      cam: "Left and right limits have to agree or I already have a jump.",
      dev: "I mixed the point check with uniform continuity on a whole interval.",
      eve: "I treated a freehand sketch as the epsilon-delta check at a.",
      fay: "A removable hole still fails until the value is set to the limit.",
    }),
  },
  {
    id: "calibrate-conditional",
    marker: `${PRODUCTION_STUDIO_DEMO_MARKER}:calibrate-conditional`,
    product: "calibration",
    flowKind: "calibrate",
    title: "Demo Calibrate — Conditional",
    topic: "Conditional probability",
    goal: "Sound the hidden-state field for P(A | B) before any policy is projected.",
    description:
      "Production Data Studio sample. Six Calibrate soundings of one hidden-state tree; a Path region covers the trusted conditional taps.",
    flowName: "P(A | B)",
    questions: [
      {
        id: "q-mass",
        text: "Is P(B) strictly positive in this experiment?",
      },
      {
        id: "q-ratio",
        text: "Why is P(A | B) the joint divided by P(B)?",
      },
    ],
    durationMinutes: 15,
    actionCatalog: 4,
    publicTokenPrefix: "demo-c-conditional",
    regionName: "conditional sounders",
    regionDescription: "Path-space region of the cheapest conditional soundings (ada, bea, cam).",
    tree: conditionalTree,
    runs: runs({
      ada: "I would not trust a conditional until I know B has positive mass.",
      bea: "I tap the joint first, then divide by P of B so B is the new whole.",
      cam: "Independence is exactly when the conditional matches the marginal.",
      dev: "I treated the joint as if it were already the conditional.",
      eve: "I read P of A given B as a claim that B caused A.",
      fay: "A partition of B recovers P of A by summing the joints.",
    }),
  },
];

export function productionStudioDemoSet(id: StudioDemoSetId): StudioDemoSetDef {
  const set = PRODUCTION_STUDIO_DEMO_SETS.find((row) => row.id === id);
  if (!set) throw new Error(`unknown studio demo set: ${id}`);
  return set;
}

function soundModel(
  model: SessionBranchModel,
  sequence: readonly string[],
): SessionBranchModel {
  const open = new Set<string>(["root", ...sequence]);
  const focusId = sequence[sequence.length - 1] || model.focusId;
  return {
    ...model,
    focusId: model.branches.some((branch) => branch.id === focusId) ? focusId : model.focusId,
    branches: model.branches.map((branch) => ({
      ...branch,
      status: open.has(branch.id) ? "open" : "latent",
    })),
  };
}

export function encodeStudioDemoRun(
  set: StudioDemoSetDef,
  run: StudioDemoRunDef,
  model: SessionBranchModel = set.tree(),
): FlowEmbeddingRecord {
  const sounded = set.flowKind === "calibrate" ? soundModel(model, run.sequence) : model;
  return completeFlowEmbedding({
    flowKind: set.flowKind,
    model: sounded,
    sequence: run.sequence,
    pow: [
      {
        type: "speech",
        tool_name: "speech-segment",
        tool_action: "speech_stop",
        timestamp_ms: 1,
        payload: run.speech,
        metadata: { transcript_snapshot: run.speech, text: run.speech },
      },
      ...run.sequence.map((action, index) => ({
        type: "tool" as const,
        tool_name: "session_policy",
        tool_action: action,
        timestamp_ms: index + 2,
      })),
    ],
  });
}

export function encodeStudioDemoRuns(
  set: StudioDemoSetDef,
): Array<StudioDemoRunDef & { embedding: FlowEmbeddingRecord }> {
  const model = set.tree();
  return set.runs.map((run) => ({
    ...run,
    embedding: encodeStudioDemoRun(set, run, model),
  }));
}

export function buildStudioDemoRegion(
  set: StudioDemoSetDef,
  encoded: readonly (StudioDemoRunDef & { embedding: FlowEmbeddingRecord })[] = encodeStudioDemoRuns(
    set,
  ),
  channel: FlowEmbeddingChannel | string = "path",
): CustomVerificationModelSpec {
  const space = parseFlowEmbeddingChannel(channel);
  const inRegion = encoded.filter((run) => run.inRegion);
  const vectorOf = (run: StudioDemoRunDef & { embedding: FlowEmbeddingRecord }) =>
    space === "path_text" ? run.embedding.vector_path_text : run.embedding.vector;
  const model = createCustomVerificationModelFromVectors({
    name: space === "path_text" ? voiceRegionName(set.regionName) : set.regionName,
    vectors: inRegion.map(vectorOf),
    subjects: inRegion.map((run) => ({ label: run.identity })),
    embedding_model_id: flowEmbeddingModelIdForChannel(space),
  });
  const outsider = encoded.find((run) => run.key === "eve");
  if (!outsider) return model;
  const inMin = Math.min(
    ...inRegion.map((run) => cosineSimilarity(vectorOf(run), model.centroid)),
  );
  const outCos = cosineSimilarity(vectorOf(outsider), model.centroid);
  if (!(inMin > outCos)) return model;
  return {
    ...model,
    cosine_threshold: (inMin + outCos) / 2,
  };
}

export function buildStudioDemoRegions(
  set: StudioDemoSetDef,
  encoded: readonly (StudioDemoRunDef & { embedding: FlowEmbeddingRecord })[] = encodeStudioDemoRuns(
    set,
  ),
): { path: CustomVerificationModelSpec; voice: CustomVerificationModelSpec } {
  return {
    path: buildStudioDemoRegion(set, encoded, "path"),
    voice: buildStudioDemoRegion(set, encoded, "path_text"),
  };
}

export function studioDemoCalibrationEvents(run: StudioDemoRunDef): unknown[] {
  return [
    {
      type: "uncertainty_explanation",
      questionId: "q-sound",
      text: run.speech,
      source: "dictated",
    },
  ];
}
