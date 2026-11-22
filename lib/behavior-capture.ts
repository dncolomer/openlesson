import type { IleProofOfWorkUploadItem } from "@/lib/learn-evidence-buffer";

export const BEHAVIOR_SCHEMA = "behavior-v0" as const;
export const BEHAVIOR_TOOL_NAME = "behavior";
export const PERSON_MEDIA_REFUSED = "person_media_refused";

export const BEHAVIOR_STREAMS = [
  "pointer",
  "pointer_edge",
  "wheel",
  "viewport",
  "tool_state",
  "edit_state",
  "resize_rotate",
  "hover",
  "laser",
  "command_attempt",
  "chrome",
  "idle",
  "focus",
  "unsys",
  "speech",
  "facial",
  "screen_hash",
] as const;

export type BehaviorStream = (typeof BEHAVIOR_STREAMS)[number];

/** High-Hz streams dropped first when the upload queue is full. */
export const DROPPABLE_BEHAVIOR_STREAMS: ReadonlySet<string> = new Set(["hover", "pointer"]);

export const NEVER_DROP_BEHAVIOR_STREAMS: ReadonlySet<string> = new Set([
  "pointer_edge",
  "command_attempt",
  "speech",
  "unsys",
]);

export type BehaviorSample = {
  t: number;
  sid: string;
  hid: string | null;
  seq: number;
  stream: string;
  [key: string]: unknown;
};

export type ClosedBehaviorChunk = {
  t0: number;
  t1: number;
  sampleCount: number;
  chunkIndex: number;
  bytes: number;
  jsonl: string;
  streams: string[];
};

const PERSON_MIME = /^(audio|video)\//i;
const PERSON_DATA_URL = /^data:(audio|video)\//i;
const PERSON_FILE = /\.(webm|wav|mp3|mpeg|mp4|m4a|aac|ogg|opus|flac|mov|quicktime)$/i;

export function isDroppableBehaviorStream(stream: string): boolean {
  return DROPPABLE_BEHAVIOR_STREAMS.has(stream);
}

export function envelopeBehaviorSample(input: {
  t: number;
  sid: string;
  hid?: string | null;
  seq: number;
  stream: string;
  body?: Record<string, unknown>;
}): BehaviorSample {
  const body = input.body ? { ...input.body } : {};
  delete body.t;
  delete body.sid;
  delete body.hid;
  delete body.seq;
  delete body.stream;
  return {
    t: input.t,
    sid: input.sid,
    hid: input.hid ?? null,
    seq: input.seq,
    stream: input.stream,
    ...body,
  };
}

export function quantizeCoord(n: number, decimals = 1): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

export function assertNoPersonMedia(item: {
  mimeType?: string | null;
  kind?: string | null;
  proof_of_work_type?: string | null;
  payload?: string | null;
  fileName?: string | null;
}): void {
  const mime = String(item.mimeType || "").split(";")[0].trim();
  if (PERSON_MIME.test(mime)) {
    throw new Error(PERSON_MEDIA_REFUSED);
  }
  const stored = String(item.kind || item.proof_of_work_type || "").trim().toLowerCase();
  if (stored === "video") {
    throw new Error(PERSON_MEDIA_REFUSED);
  }
  const payload = String(item.payload || "");
  if (PERSON_DATA_URL.test(payload)) {
    throw new Error(PERSON_MEDIA_REFUSED);
  }
  const name = String(item.fileName || "");
  if (PERSON_FILE.test(name)) {
    throw new Error(PERSON_MEDIA_REFUSED);
  }
}

export function buildBehaviorUploadItem(input: {
  sessionId: string;
  chunk: ClosedBehaviorChunk;
  timestampMs?: number;
}): IleProofOfWorkUploadItem {
  assertNoPersonMedia({
    mimeType: "application/json",
    kind: "tool",
    payload: input.chunk.jsonl,
    fileName: behaviorChunkFileName(input.sessionId, input.chunk),
  });
  return {
    kind: "tool",
    mimeType: "application/json",
    fileName: behaviorChunkFileName(input.sessionId, input.chunk),
    payload: input.chunk.jsonl,
    timestampMs: input.timestampMs ?? input.chunk.t1,
    toolName: BEHAVIOR_TOOL_NAME,
    toolAction: "chunk",
    sampleCount: input.chunk.sampleCount,
    metadata: {
      schema: BEHAVIOR_SCHEMA,
      stream: input.chunk.streams.length === 1 ? input.chunk.streams[0] : "mixed",
      streams: input.chunk.streams,
      t0: input.chunk.t0,
      t1: input.chunk.t1,
      sample_count: input.chunk.sampleCount,
      chunk_index: input.chunk.chunkIndex,
    },
  };
}

export function behaviorChunkFileName(sessionId: string, chunk: ClosedBehaviorChunk): string {
  const stream = chunk.streams.length === 1 ? chunk.streams[0] : "behavior";
  return `${stream}-${sessionId}-${chunk.t0}-${chunk.chunkIndex}.jsonl`;
}
