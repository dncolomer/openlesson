/**
 * Named embedding spaces live on the private host multimodal model.
 * OpenLesson persist and read use Path only.
 */

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

const BASIS_DIM = 96;

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
