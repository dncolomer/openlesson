/**
 * CPU test harness for flowcfg-v1-d96: distances, ablations, provisional
 * regions, and a 2D export. Does not train weights.
 */

import {
  ablateFlowPathWalk,
  collectFlowPowTranscripts,
  embedFlowChannels,
  FLOW_EMBEDDING_DIM,
  FLOW_EMBEDDING_MODEL_ID,
  FLOW_EMBEDDING_PATH_TEXT_MODEL_ID,
  recoverFlowEmbeddingRaw,
  vectorsMatch,
  type FlowEmbeddingChannel,
  type FlowEmbeddingRaw,
} from "@/lib/flow-embedding";
import {
  createCustomVerificationModelFromVectors,
  scoreAgainstCustomVerificationModel,
  type CustomVerificationModelSpec,
  type CustomVerificationScore,
} from "@/lib/knowledge-config/custom-verification-model";
import { cosineSimilarity, l2Distance, l2Normalize } from "@/lib/knowledge-config/math";
import {
  projectVectors2D,
  type Point2D,
  type ProjectionAlgorithmId,
} from "@/lib/knowledge-config/project-2d";
import {
  syntheticFlowHarnessCases,
  type FlowHarnessCase,
  type HarnessRole,
} from "@/lib/flow-embedding-fixtures";

export type { FlowHarnessCase, HarnessRole };

export type HarnessEmbeddedCase = FlowHarnessCase & {
  path: number[];
  path_text: number[];
  path_no_walk: number[];
  transcripts: string[];
};

export type HarnessPair = {
  a: string;
  b: string;
  channel: FlowEmbeddingChannel | "path_no_walk";
  cosine: number;
  l2: number;
};

export type HarnessRegionScore = CustomVerificationScore & {
  id: string;
  role: HarnessRole;
  problem: string;
};

export type FlowEmbeddingHarnessReport = {
  algorithm_id: typeof FLOW_EMBEDDING_MODEL_ID;
  dim: typeof FLOW_EMBEDDING_DIM;
  generated_at: string;
  cases: Array<{
    id: string;
    label: string;
    problem: string;
    role: HarnessRole;
    path: number[];
    path_text: number[];
    path_no_walk: number[];
    transcripts: string[];
    xy: Point2D;
    xy_path_text: Point2D;
  }>;
  pairwise: HarnessPair[];
  ablations: {
    path_equals_path_text_when_silent: string[];
    path_unchanged_by_transcript: Array<{ a: string; b: string }>;
    path_text_moves_with_transcript: Array<{ a: string; b: string; cosine: number }>;
    walk_off_changes_path: Array<{ id: string; cosine: number }>;
    determinism: boolean;
  };
  region: {
    name: string;
    channel: FlowEmbeddingChannel;
    spec: CustomVerificationModelSpec;
    scores: HarnessRegionScore[];
  } | null;
  projection: {
    algorithm: ProjectionAlgorithmId;
    frame: "path" | "path_text";
  };
};

function vectorFor(
  embedded: HarnessEmbeddedCase,
  channel: FlowEmbeddingChannel | "path_no_walk",
): number[] {
  if (channel === "path_text") return embedded.path_text;
  if (channel === "path_no_walk") return embedded.path_no_walk;
  return embedded.path;
}

export function embedHarnessCase(input: FlowHarnessCase): HarnessEmbeddedCase {
  const recovered = recoverFlowEmbeddingRaw(input.raw);
  if (!recovered) {
    throw new Error(`harness case ${input.id} has no recoverable raw payload`);
  }
  const channels = embedFlowChannels(recovered);
  return {
    ...input,
    raw: channels.raw,
    path: channels.path,
    path_text: channels.path_text,
    path_no_walk: ablateFlowPathWalk(channels.path),
    transcripts: collectFlowPowTranscripts(channels.raw.pow),
  };
}

export function pairwiseDistances(
  cases: readonly HarnessEmbeddedCase[],
  channel: FlowEmbeddingChannel | "path_no_walk" = "path",
): HarnessPair[] {
  const pairs: HarnessPair[] = [];
  for (let i = 0; i < cases.length; i += 1) {
    for (let j = i + 1; j < cases.length; j += 1) {
      const a = vectorFor(cases[i], channel);
      const b = vectorFor(cases[j], channel);
      pairs.push({
        a: cases[i].id,
        b: cases[j].id,
        channel,
        cosine: cosineSimilarity(a, b),
        l2: l2Distance(a, b),
      });
    }
  }
  return pairs;
}

export function buildProvisionalRegion(
  cases: readonly HarnessEmbeddedCase[],
  options: {
    name?: string;
    channel?: FlowEmbeddingChannel;
    roles?: readonly HarnessRole[];
    problem?: string;
  } = {},
): { spec: CustomVerificationModelSpec; members: HarnessEmbeddedCase[] } | null {
  const channel = options.channel ?? "path";
  const roles = new Set(options.roles ?? ["expert"]);
  const members = cases.filter((row) => {
    if (!roles.has(row.role)) return false;
    if (options.problem && row.problem !== options.problem) return false;
    return true;
  });
  if (members.length < 2) return null;
  const modelId = channel === "path_text" ? FLOW_EMBEDDING_PATH_TEXT_MODEL_ID : FLOW_EMBEDDING_MODEL_ID;
  const spec = createCustomVerificationModelFromVectors({
    name: options.name ?? "provisional expert region",
    vectors: members.map((row) => vectorFor(row, channel)),
    subjects: members.map((row) => ({ label: row.id })),
    embedding_model_id: modelId,
  });
  return { spec, members };
}

export function scoreAgainstProvisionalRegion(
  cases: readonly HarnessEmbeddedCase[],
  spec: CustomVerificationModelSpec,
  channel: FlowEmbeddingChannel = "path",
): HarnessRegionScore[] {
  return cases.map((row) => ({
    id: row.id,
    role: row.role,
    problem: row.problem,
    ...scoreAgainstCustomVerificationModel(vectorFor(row, channel), spec),
  }));
}

function silentIds(cases: readonly HarnessEmbeddedCase[]): string[] {
  return cases.filter((row) => vectorsMatch(row.path, row.path_text)).map((row) => row.id);
}

function sameTreeWalkPairs(cases: readonly HarnessEmbeddedCase[]): Array<{ a: string; b: string }> {
  const out: Array<{ a: string; b: string }> = [];
  for (let i = 0; i < cases.length; i += 1) {
    for (let j = i + 1; j < cases.length; j += 1) {
      const a = cases[i];
      const b = cases[j];
      if (a.problem !== b.problem) continue;
      const seqA = a.raw.projectedPolicy?.sequence?.join(">") ?? "";
      const seqB = b.raw.projectedPolicy?.sequence?.join(">") ?? "";
      if (seqA && seqA === seqB && vectorsMatch(a.path, b.path) && a.id !== b.id) {
        out.push({ a: a.id, b: b.id });
      }
    }
  }
  return out;
}

export function runFlowEmbeddingHarness(input: {
  cases?: readonly FlowHarnessCase[];
  projection?: ProjectionAlgorithmId;
  regionName?: string;
  regionChannel?: FlowEmbeddingChannel;
  regionProblem?: string;
}): FlowEmbeddingHarnessReport {
  const source = input.cases?.length ? input.cases : syntheticFlowHarnessCases();
  const cases = source.map(embedHarnessCase);
  const projection = input.projection ?? "pca";
  const pathCoords = projectVectors2D(
    cases.map((row) => row.path),
    projection,
  );
  const pathTextCoords = projectVectors2D(
    cases.map((row) => row.path_text),
    projection,
  );

  const first = cases[0];
  const determinism =
    !!first &&
    vectorsMatch(embedHarnessCase(source[0]).path, first.path) &&
    vectorsMatch(embedHarnessCase(source[0]).path_text, first.path_text);

  const transcriptMoves: Array<{ a: string; b: string; cosine: number }> = [];
  for (const pair of sameTreeWalkPairs(cases)) {
    const a = cases.find((row) => row.id === pair.a);
    const b = cases.find((row) => row.id === pair.b);
    if (!a || !b) continue;
    if (vectorsMatch(a.path_text, b.path_text)) continue;
    transcriptMoves.push({
      a: pair.a,
      b: pair.b,
      cosine: cosineSimilarity(a.path_text, b.path_text),
    });
  }

  const regionBuilt = buildProvisionalRegion(cases, {
    name: input.regionName,
    channel: input.regionChannel ?? "path",
    problem: input.regionProblem ?? "quadratic",
  });

  return {
    algorithm_id: FLOW_EMBEDDING_MODEL_ID,
    dim: FLOW_EMBEDDING_DIM,
    generated_at: new Date().toISOString(),
    cases: cases.map((row, index) => ({
      id: row.id,
      label: row.label,
      problem: row.problem,
      role: row.role,
      path: row.path,
      path_text: row.path_text,
      path_no_walk: row.path_no_walk,
      transcripts: row.transcripts,
      xy: pathCoords[index] ?? { x: 0, y: 0 },
      xy_path_text: pathTextCoords[index] ?? { x: 0, y: 0 },
    })),
    pairwise: [
      ...pairwiseDistances(cases, "path"),
      ...pairwiseDistances(cases, "path_text"),
      ...pairwiseDistances(cases, "path_no_walk"),
    ],
    ablations: {
      path_equals_path_text_when_silent: silentIds(cases),
      path_unchanged_by_transcript: sameTreeWalkPairs(cases),
      path_text_moves_with_transcript: transcriptMoves,
      walk_off_changes_path: cases
        .filter((row) => (row.raw.projectedPolicy?.sequence.length ?? 0) > 0)
        .map((row) => ({
          id: row.id,
          cosine: cosineSimilarity(row.path, row.path_no_walk),
        })),
      determinism,
    },
    region: regionBuilt
      ? {
          name: regionBuilt.spec.name,
          channel: input.regionChannel ?? "path",
          spec: regionBuilt.spec,
          scores: scoreAgainstProvisionalRegion(
            cases,
            regionBuilt.spec,
            input.regionChannel ?? "path",
          ),
        }
      : null,
    projection: {
      algorithm: projection,
      frame: "path",
    },
  };
}

export function harnessExportJson(report: FlowEmbeddingHarnessReport): string {
  return `${JSON.stringify(report)}\n`;
}

/** Unit L2 centroid of selected Path vectors (2–5 expert-like trajectories). */
export function centroidOfCases(
  cases: readonly HarnessEmbeddedCase[],
  channel: FlowEmbeddingChannel | "path_no_walk" = "path",
): number[] {
  if (!cases.length) return new Array(FLOW_EMBEDDING_DIM).fill(0);
  const dim = vectorFor(cases[0], channel).length;
  const acc = new Array(dim).fill(0);
  for (const row of cases) {
    const v = vectorFor(row, channel);
    for (let i = 0; i < dim; i += 1) acc[i] += v[i] ?? 0;
  }
  for (let i = 0; i < dim; i += 1) acc[i] /= cases.length;
  return l2Normalize(acc);
}
