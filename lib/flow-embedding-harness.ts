/**
 * Distances, provisional regions, and a 2D export for hosted Path numbers.
 * Does not run the production encoder.
 */

import {
  collectFlowPowTranscripts,
  FLOW_EMBEDDING_DIM,
  FLOW_EMBEDDING_MODEL_ID,
  recoverFlowEmbeddingRaw,
  vectorsMatch,
  type FlowEmbeddingChannel,
  type FlowEmbeddingRaw,
} from "@/lib/flow-embedding";
import { encodeFlowRaw } from "@/lib/flow-embedding-encode";
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
  transcripts: string[];
};

export type HarnessPair = {
  a: string;
  b: string;
  channel: FlowEmbeddingChannel;
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
    transcripts: string[];
    xy: Point2D;
    xy_path_text: Point2D;
  }>;
  pairwise: HarnessPair[];
  ablations: {
    path_equals_path_text_when_silent: string[];
    path_unchanged_by_transcript: Array<{ a: string; b: string }>;
    path_text_moves_with_transcript: Array<{ a: string; b: string; cosine: number }>;
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
  _channel: FlowEmbeddingChannel = "path",
): number[] {
  return embedded.path;
}

export async function embedHarnessCase(input: FlowHarnessCase): Promise<HarnessEmbeddedCase> {
  const recovered = recoverFlowEmbeddingRaw(input.raw);
  if (!recovered) {
    throw new Error(`harness case ${input.id} has no recoverable raw payload`);
  }
  const encoded = await encodeFlowRaw(recovered);
  return {
    ...input,
    raw: encoded.raw,
    path: encoded.vector,
    path_text: encoded.vector_path_text,
    transcripts: collectFlowPowTranscripts(encoded.raw.pow),
  };
}

export function pairwiseDistances(
  cases: readonly HarnessEmbeddedCase[],
  channel: FlowEmbeddingChannel = "path",
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
  const modelId = FLOW_EMBEDDING_MODEL_ID;
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

export async function runFlowEmbeddingHarness(input: {
  cases?: readonly FlowHarnessCase[];
  projection?: ProjectionAlgorithmId;
  regionName?: string;
  regionChannel?: FlowEmbeddingChannel;
  regionProblem?: string;
}): Promise<FlowEmbeddingHarnessReport> {
  const source = input.cases?.length ? input.cases : syntheticFlowHarnessCases();
  const cases = await Promise.all(source.map((row) => embedHarnessCase(row)));
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
    vectorsMatch((await embedHarnessCase(source[0])).path, first.path) &&
    vectorsMatch((await embedHarnessCase(source[0])).path_text, first.path_text);

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
      transcripts: row.transcripts,
      xy: pathCoords[index] ?? { x: 0, y: 0 },
      xy_path_text: pathTextCoords[index] ?? { x: 0, y: 0 },
    })),
    pairwise: [...pairwiseDistances(cases, "path")],
    ablations: {
      path_equals_path_text_when_silent: silentIds(cases),
      path_unchanged_by_transcript: sameTreeWalkPairs(cases),
      path_text_moves_with_transcript: transcriptMoves,
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
  channel: FlowEmbeddingChannel = "path",
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
