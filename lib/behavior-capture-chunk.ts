import {
  buildBehaviorUploadItem,
  envelopeBehaviorSample,
  isDroppableBehaviorStream,
  type ClosedBehaviorChunk,
} from "@/lib/behavior-capture";
import type { IleProofOfWorkUploadItem } from "@/lib/learn-evidence-buffer";

/** Open JSONL stays under this; rotate before the 10 MB PoW cap. */
export const BEHAVIOR_OPEN_CHUNK_MAX_BYTES = 200 * 1024;
export const BEHAVIOR_OPEN_CHUNK_MAX_MS = 5_000;
/** Closed chunks waiting to upload, plus in-flight uploads. */
export const BEHAVIOR_MAX_PENDING = 2;

const encoder = new TextEncoder();

function utf8Bytes(text: string): number {
  return encoder.encode(text).length;
}

export type AppendBehaviorResult = {
  accepted: boolean;
  dropped: boolean;
  rotated: ClosedBehaviorChunk | null;
};

/**
 * One multiplexed JSONL buffer per session. Lives outside React.
 * Flush-and-drop: takePending() yields the payload; the caller must release it after upload.
 */
export class BehaviorChunker {
  readonly sessionId: string;
  hid: string | null;
  readonly maxOpenBytes: number;
  readonly maxOpenMs: number;
  readonly maxPending: number;

  private lines: string[] = [];
  private bytes = 0;
  private t0: number | null = null;
  private t1: number | null = null;
  private sampleCount = 0;
  private seq = 0;
  private chunkIndex = 0;
  private streams = new Set<string>();
  private pending: ClosedBehaviorChunk[] = [];
  private inFlight = 0;
  private dropped = 0;

  constructor(input: {
    sessionId: string;
    hid?: string | null;
    maxOpenBytes?: number;
    maxOpenMs?: number;
    maxPending?: number;
  }) {
    this.sessionId = input.sessionId;
    this.hid = input.hid ?? null;
    this.maxOpenBytes = input.maxOpenBytes ?? BEHAVIOR_OPEN_CHUNK_MAX_BYTES;
    this.maxOpenMs = input.maxOpenMs ?? BEHAVIOR_OPEN_CHUNK_MAX_MS;
    this.maxPending = input.maxPending ?? BEHAVIOR_MAX_PENDING;
  }

  get openByteLength(): number {
    return this.bytes;
  }

  get pendingCount(): number {
    return this.pending.length;
  }

  get inFlightCount(): number {
    return this.inFlight;
  }

  get droppedCount(): number {
    return this.dropped;
  }

  get openSampleCount(): number {
    return this.sampleCount;
  }

  queuedCount(): number {
    return this.pending.length + this.inFlight;
  }

  append(input: {
    t: number;
    stream: string;
    hid?: string | null;
    sid?: string;
    body?: Record<string, unknown>;
  }): AppendBehaviorResult {
    const queued = this.queuedCount();
    if (queued >= this.maxPending && isDroppableBehaviorStream(input.stream)) {
      this.dropped += 1;
      return { accepted: false, dropped: true, rotated: null };
    }
    if (queued >= this.maxPending && this.pending.length > 0) {
      this.pending.shift();
      this.dropped += 1;
    }

    const sample = envelopeBehaviorSample({
      t: input.t,
      sid: input.sid ?? this.sessionId,
      hid: input.hid !== undefined ? input.hid : this.hid,
      seq: this.seq,
      stream: input.stream,
      body: input.body,
    });
    const line = JSON.stringify(sample);
    const lineBytes = utf8Bytes(line) + 1;
    let rotated: ClosedBehaviorChunk | null = null;
    const age = this.t0 == null ? 0 : input.t - this.t0;
    if (this.sampleCount > 0 && (this.bytes + lineBytes > this.maxOpenBytes || age >= this.maxOpenMs)) {
      rotated = this.rotateOpen();
    }

    this.lines.push(line);
    this.bytes += lineBytes;
    this.t0 = this.t0 ?? input.t;
    this.t1 = input.t;
    this.sampleCount += 1;
    this.seq += 1;
    this.streams.add(input.stream);
    return { accepted: true, dropped: false, rotated };
  }

  flush(): ClosedBehaviorChunk | null {
    if (this.sampleCount === 0) return null;
    return this.rotateOpen();
  }

  takePending(): ClosedBehaviorChunk | null {
    return this.pending.shift() ?? null;
  }

  markUploadStart(): void {
    this.inFlight += 1;
  }

  markUploadSettled(): void {
    this.inFlight = Math.max(0, this.inFlight - 1);
  }

  drainUploadItems(): IleProofOfWorkUploadItem[] {
    this.flush();
    const items: IleProofOfWorkUploadItem[] = [];
    let next = this.takePending();
    while (next) {
      items.push(buildBehaviorUploadItem({ sessionId: this.sessionId, chunk: next }));
      next = this.takePending();
    }
    return items;
  }

  private rotateOpen(): ClosedBehaviorChunk {
    const chunk: ClosedBehaviorChunk = {
      t0: this.t0 ?? 0,
      t1: this.t1 ?? this.t0 ?? 0,
      sampleCount: this.sampleCount,
      chunkIndex: this.chunkIndex,
      bytes: this.bytes,
      jsonl: this.lines.join("\n"),
      streams: [...this.streams],
    };
    this.lines = [];
    this.bytes = 0;
    this.t0 = null;
    this.t1 = null;
    this.sampleCount = 0;
    this.streams = new Set();
    this.chunkIndex += 1;
    if (this.pending.length >= this.maxPending) {
      this.pending.shift();
      this.dropped += 1;
    }
    this.pending.push(chunk);
    return chunk;
  }
}
