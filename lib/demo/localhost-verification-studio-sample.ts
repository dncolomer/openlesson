/**
 * Localhost-only Verification Data Studio sample: one flow, several hidden-state
 * walks, spoken traces, and Path plus Path + Text regions. No DB I/O.
 */

import {
  completeFlowEmbedding,
  flowEmbeddingModelIdForChannel,
  parseFlowEmbeddingChannel,
  type FlowEmbeddingChannel,
  type FlowEmbeddingRecord,
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

export const LOCALHOST_VERIFICATION_STUDIO_MARKER = "[LOCAL:verification-studio-v1]";

export const LOCALHOST_VERIFICATION_STUDIO_WORKSPACE = {
  title: "Local Data Studio — Limits",
  root_topic: "Epsilon-delta definition of a limit",
  description:
    "Localhost sample Verification workspace for Data Studio. Six Verify runs walk one hidden-state tree; a Path region covers the ε-δ walkers.",
  workspace_goal: "Visualize a knowledge region against other Verify runs in Data Studio.",
  notes: `${LOCALHOST_VERIFICATION_STUDIO_MARKER} Localhost Verification Data Studio sample.`,
  status: "active" as const,
  workspace_kind: "knowledge_region" as const,
};

export const LOCALHOST_VERIFICATION_STUDIO_FLOW = {
  name: "Limits ε-δ",
  topic: "Epsilon-delta definition of a limit",
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
  publicTokenPrefix: "local-ds-limits",
};

export type LocalhostStudioRunKey = "ada" | "bea" | "cam" | "dev" | "eve" | "fay";

export type LocalhostStudioRunDef = {
  key: LocalhostStudioRunKey;
  identity: string;
  sequence: readonly string[];
  speech: string;
  inRegion: boolean;
};

export const LOCALHOST_VERIFICATION_STUDIO_RUNS: readonly LocalhostStudioRunDef[] = [
  {
    key: "ada",
    identity: "ada",
    sequence: ["r1", "r1-c1"],
    speech: "I pick epsilon first, then find a delta that keeps f of x inside the band.",
    inRegion: true,
  },
  {
    key: "bea",
    identity: "bea",
    sequence: ["r1", "r1-c1"],
    speech: "Start with the given closeness and work backwards to a window around a.",
    inRegion: true,
  },
  {
    key: "cam",
    identity: "cam",
    sequence: ["r1", "r1-c2"],
    speech: "The neighborhood is open, so equality at the endpoint is not required.",
    inRegion: true,
  },
  {
    key: "dev",
    identity: "dev",
    sequence: ["r2", "r2-c1"],
    speech: "I algebraically rearrange the inequality until a positive delta appears.",
    inRegion: false,
  },
  {
    key: "eve",
    identity: "eve",
    sequence: ["r6"],
    speech: "I tried a ratio test on a series instead of answering the epsilon challenge.",
    inRegion: false,
  },
  {
    key: "fay",
    identity: "fay",
    sequence: ["r3"],
    speech: "A sequence of smaller epsilons still needs a delta at each step.",
    inRegion: false,
  },
];

export function localhostVerificationStudioTree(): SessionBranchModel {
  const model = normalizeSessionBranchModel(
    {
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
    },
    "Limits",
  );
  if (!model) throw new Error("localhost verification studio tree was refused");
  return model;
}

export function encodeLocalhostVerificationStudioRun(
  run: LocalhostStudioRunDef,
  model: SessionBranchModel = localhostVerificationStudioTree(),
): FlowEmbeddingRecord {
  return completeFlowEmbedding({
    flowKind: "verify",
    model,
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

export function encodeLocalhostVerificationStudioRuns(
  model: SessionBranchModel = localhostVerificationStudioTree(),
): Array<LocalhostStudioRunDef & { embedding: FlowEmbeddingRecord }> {
  return LOCALHOST_VERIFICATION_STUDIO_RUNS.map((run) => ({
    ...run,
    embedding: encodeLocalhostVerificationStudioRun(run, model),
  }));
}

export function buildLocalhostVerificationStudioRegion(
  encoded: readonly (LocalhostStudioRunDef & { embedding: FlowEmbeddingRecord })[] = encodeLocalhostVerificationStudioRuns(),
  channel: FlowEmbeddingChannel | string = "path",
): CustomVerificationModelSpec {
  const space = parseFlowEmbeddingChannel(channel);
  const inRegion = encoded.filter((run) => run.inRegion);
  const vectorOf = (run: LocalhostStudioRunDef & { embedding: FlowEmbeddingRecord }) =>
    space === "path_text" ? run.embedding.vector_path_text : run.embedding.vector;
  const model = createCustomVerificationModelFromVectors({
    name: space === "path_text" ? voiceRegionName("ε-δ walkers") : "ε-δ walkers",
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

export function buildLocalhostVerificationStudioRegions(
  encoded: readonly (LocalhostStudioRunDef & { embedding: FlowEmbeddingRecord })[] = encodeLocalhostVerificationStudioRuns(),
): { path: CustomVerificationModelSpec; voice: CustomVerificationModelSpec } {
  return {
    path: buildLocalhostVerificationStudioRegion(encoded, "path"),
    voice: buildLocalhostVerificationStudioRegion(encoded, "path_text"),
  };
}
