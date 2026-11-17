/**
 * Named embedding spaces: mix stored basis channel vectors at read time.
 * Path is always first. Extra channels (audio, eeg, video, screen) combine
 * later; combinations are not persisted.
 */

import { l2Normalize } from "@/lib/knowledge-config/math";

export const FLOW_EMBEDDING_BASIS_CHANNELS = [
  "path",
  "audio",
  "eeg",
  "video",
  "screen",
] as const;

export type FlowEmbeddingBasisChannel = (typeof FLOW_EMBEDDING_BASIS_CHANNELS)[number];

export const FLOW_EMBEDDING_BASIS_CHANNEL_LABELS: Record<FlowEmbeddingBasisChannel, string> = {
  path: "Path",
  audio: "Audio",
  eeg: "EEG",
  video: "Video",
  screen: "Screen",
};

export const FLOW_EMBEDDING_SPACE_PATH_WEIGHT = 0.75;
export const FLOW_EMBEDDING_SPACE_EXTRA_WEIGHT = 0.25;

const BASIS_DIM = 96;
const BASIS_SET = new Set<string>(FLOW_EMBEDDING_BASIS_CHANNELS);

const CHANNEL_ALIASES: Record<string, FlowEmbeddingBasisChannel> = {
  path: "path",
  audio: "audio",
  voice: "audio",
  eeg: "eeg",
  muse: "eeg",
  video: "video",
  screen: "screen",
  screenshots: "screen",
};

export type FlowEmbeddingChannelVectors = {
  path: number[];
} & Partial<Record<Exclude<FlowEmbeddingBasisChannel, "path">, number[]>>;

export type FlowEmbeddingSpaceParse =
  | { ok: true; space: string; channels: FlowEmbeddingBasisChannel[] }
  | { ok: false; error: string };

function isUnitBasisVector(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length === BASIS_DIM &&
    value.every((n) => typeof n === "number" && Number.isFinite(n))
  );
}

export function canonicalFlowEmbeddingSpace(
  channels: readonly FlowEmbeddingBasisChannel[],
): string {
  const extras = [...new Set(channels.filter((channel) => channel !== "path"))].sort();
  if (!extras.length) return "path";
  return ["path", ...extras].join("+");
}

export function parseFlowEmbeddingSpace(value: unknown): FlowEmbeddingSpaceParse {
  if (value == null) {
    return { ok: true, space: "path", channels: ["path"] };
  }
  if (typeof value !== "string") {
    return { ok: false, error: "space must be a string" };
  }
  const raw = value.trim().toLowerCase();
  if (!raw) {
    return { ok: true, space: "path", channels: ["path"] };
  }
  if (raw === "path_text" || raw === "path+text") {
    return { ok: true, space: "path+audio", channels: ["path", "audio"] };
  }
  const parts = raw.split("+").map((part) => part.trim()).filter(Boolean);
  if (!parts.length) {
    return { ok: true, space: "path", channels: ["path"] };
  }
  const seen = new Set<FlowEmbeddingBasisChannel>();
  const extras: FlowEmbeddingBasisChannel[] = [];
  for (const part of parts) {
    const mapped = CHANNEL_ALIASES[part];
    if (!mapped) {
      return { ok: false, error: `Unknown space channel: ${part}` };
    }
    if (mapped === "path" || seen.has(mapped)) continue;
    seen.add(mapped);
    extras.push(mapped);
  }
  extras.sort();
  const channels: FlowEmbeddingBasisChannel[] = ["path", ...extras];
  return { ok: true, space: canonicalFlowEmbeddingSpace(channels), channels };
}

export function flowEmbeddingSpaceLabel(space: string): string {
  const parsed = parseFlowEmbeddingSpace(space);
  if (!parsed.ok) return space;
  return parsed.channels.map((channel) => FLOW_EMBEDDING_BASIS_CHANNEL_LABELS[channel]).join(" + ");
}

export function isZeroFlowEmbeddingVector(vector: readonly number[] | null | undefined): boolean {
  if (!Array.isArray(vector) || !vector.length) return true;
  return vector.every((value) => value === 0);
}

export function parseFlowEmbeddingChannelVectors(
  value: unknown,
): FlowEmbeddingChannelVectors | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const path = Array.isArray(record.path)
    ? record.path.filter((n): n is number => typeof n === "number" && Number.isFinite(n))
    : [];
  if (!isUnitBasisVector(path)) return null;
  const out: FlowEmbeddingChannelVectors = { path };
  for (const channel of FLOW_EMBEDDING_BASIS_CHANNELS) {
    if (channel === "path") continue;
    const raw = record[channel];
    const vector = Array.isArray(raw)
      ? raw.filter((n: unknown): n is number => typeof n === "number" && Number.isFinite(n))
      : [];
    if (isUnitBasisVector(vector) && !isZeroFlowEmbeddingVector(vector)) {
      out[channel] = vector;
    }
  }
  return out;
}

function channelVector(
  basis: Partial<Record<FlowEmbeddingBasisChannel, number[] | undefined>>,
  channel: FlowEmbeddingBasisChannel,
): number[] | null {
  const vector = basis[channel];
  if (!isUnitBasisVector(vector) || isZeroFlowEmbeddingVector(vector)) return null;
  return vector;
}

/**
 * Mix basis vectors into a named space. Path weight 0.75 when any extra
 * channel has signal; remaining 0.25 split equally. Silent extras drop out,
 * so path+audio with no audio equals path (legacy Path+Text).
 */
export function mixFlowEmbeddingSpace(
  basis: Partial<Record<FlowEmbeddingBasisChannel, number[] | undefined>>,
  space: string,
): number[] {
  const parsed = parseFlowEmbeddingSpace(space);
  const path = channelVector(basis, "path");
  if (!path) return new Array(BASIS_DIM).fill(0);
  if (!parsed.ok) return path;
  const extras = parsed.channels
    .filter((channel) => channel !== "path")
    .map((channel) => channelVector(basis, channel))
    .filter((vector): vector is number[] => !!vector);
  if (!extras.length) return path;
  const extraWeight = FLOW_EMBEDDING_SPACE_EXTRA_WEIGHT / extras.length;
  const mixed = path.map((value, index) => {
    let sum = value * FLOW_EMBEDDING_SPACE_PATH_WEIGHT;
    for (const extra of extras) {
      sum += (extra[index] ?? 0) * extraWeight;
    }
    return sum;
  });
  return l2Normalize(mixed);
}
