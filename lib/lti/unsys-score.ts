import { knowledgeRegionUnsysDistance } from "@/lib/knowledge-region-figure";

/** Brightspace line-item ceiling so scoreGiven has a max. Raw unsys is not inverted. */
export const LTI_UNSYS_SCORE_MAXIMUM = 1000;

export const LTI_AGS_TAG_LATEST = "unsys_distance";
export const LTI_AGS_TAG_AVERAGE = "unsys_average";

export function meanUnsysDistance(values: readonly number[]): number | null {
  const scored = values.filter((value) => Number.isFinite(value));
  if (!scored.length) return null;
  return scored.reduce((sum, value) => sum + value, 0) / scored.length;
}

export function unsysDistanceFromEmbeddingRaw(raw: unknown): number | null {
  return knowledgeRegionUnsysDistance(raw);
}

export type LtiUnsysScoreSet = {
  latest: number | null;
  average: number | null;
  observationCount: number;
  scoredCount: number;
};

export function ltiUnsysScores(input: {
  latestRaw?: unknown;
  distances: readonly number[];
}): LtiUnsysScoreSet {
  const fromLatest = unsysDistanceFromEmbeddingRaw(input.latestRaw);
  const scored = input.distances.filter((value) => Number.isFinite(value));
  const latest = fromLatest != null ? fromLatest : scored[0] ?? null;
  return {
    latest,
    average: meanUnsysDistance(scored.length ? scored : latest != null ? [latest] : []),
    observationCount: Math.max(input.distances.length, fromLatest != null ? 1 : 0),
    scoredCount: scored.length || (latest != null ? 1 : 0),
  };
}

export function ltiAgsComment(scores: LtiUnsysScoreSet): string {
  const latest = scores.latest == null ? "" : String(scores.latest);
  const average = scores.average == null ? "" : String(scores.average);
  return `unsys_distance=${latest}; unsys_average=${average}; observations=${scores.observationCount}`;
}

export function ltiAgsGradingProgress(score: number | null): "FullyGraded" | "Pending" {
  return score != null && Number.isFinite(score) ? "FullyGraded" : "Pending";
}
