/**
 * Present proof_of_work index + hydrated JSON/JSONL bodies as a compact
 * Stored record explorer. Bytes stay on BlobStore; this never inlines
 * person audio/video or large image payloads.
 */
import {
  BEHAVIOR_SCHEMA,
  BEHAVIOR_STREAMS,
  BEHAVIOR_TOOL_NAME,
  type BehaviorSample,
} from "@/lib/behavior-capture";
import { BEHAVIOR_ROLLUP_ACTION, BEHAVIOR_ROLLUP_SCHEMA } from "@/lib/behavior-capture-rollup";
import type { FlowPowRow } from "@/lib/flow-embedding";

export const RECORD_HYDRATE_MAX_FILES = 40;
export const RECORD_HYDRATE_MAX_BYTES = 400 * 1024;
export const RECORD_MAX_SAMPLES = 800;
export const RECORD_MAX_SAMPLES_PER_STREAM = 200;

const ENVELOPE_KEYS = new Set(["t", "sid", "hid", "seq", "stream"]);

export type StoredRecordFileKind =
  | "behavior_chunk"
  | "rollup"
  | "screen"
  | "facial"
  | "eeg"
  | "transcript"
  | "canvas"
  | "document"
  | "tool"
  | "person_media"
  | "other";

export type StoredRecordFile = {
  kind: StoredRecordFileKind;
  type: string;
  tool_name: string | null;
  tool_action: string | null;
  timestamp_ms: number | null;
  file_name: string | null;
  mime_type: string | null;
  xai_file_id: string | null;
  file_size: number | null;
  schema: string | null;
  streams: string[];
  sample_count: number | null;
  hydrated: boolean;
  href: string | null;
};

export type StoredRecordSample = {
  t: number;
  seq: number;
  sid: string;
  hid: string | null;
  stream: string;
  body: Record<string, unknown>;
};

export type StoredRecordStream = {
  stream: string;
  count: number;
  shown: number;
  t0: number | null;
  t1: number | null;
  samples: StoredRecordSample[];
};

export type StoredRecordView = {
  sample_count: number;
  shown_count: number;
  truncated: boolean;
  streams: StoredRecordStream[];
  files: StoredRecordFile[];
  rollup: Record<string, unknown> | null;
};

export type StoredRecordPowRow = FlowPowRow & {
  mime_type?: string | null;
  file_size?: number | null;
  file_name?: string | null;
  proof_of_work_type?: string | null;
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function mimeOf(row: StoredRecordPowRow): string {
  return text(row.mime_type).split(";")[0].toLowerCase();
}

function isPersonMediaRow(row: StoredRecordPowRow): boolean {
  const mime = mimeOf(row);
  const type = text(row.type || row.proof_of_work_type).toLowerCase();
  return type === "video" || mime.startsWith("audio/") || mime.startsWith("video/");
}

export function storedRecordFileKind(row: StoredRecordPowRow): StoredRecordFileKind {
  if (isPersonMediaRow(row)) return "person_media";
  const type = text(row.type || row.proof_of_work_type).toLowerCase();
  const tool = text(row.tool_name).toLowerCase();
  const action = text(row.tool_action).toLowerCase();
  if (tool === BEHAVIOR_TOOL_NAME && action === BEHAVIOR_ROLLUP_ACTION) return "rollup";
  if (tool === BEHAVIOR_TOOL_NAME) return "behavior_chunk";
  if (type === "screen") return "screen";
  if (tool === "facial") return "facial";
  if (type === "eeg") return "eeg";
  if (tool === "transcript" || tool === "speech-segment" || tool === "tap-speech-segment") {
    return "transcript";
  }
  if (action === "canvas_document" || mimeOf(row).startsWith("text/markdown")) return "document";
  if (tool === "canvas") return "canvas";
  if (type === "tool" || tool) return "tool";
  return "other";
}

export function shouldHydrateStoredRecordFile(row: StoredRecordPowRow): boolean {
  if (!text(row.xai_file_id)) return false;
  if (isPersonMediaRow(row)) return false;
  const mime = mimeOf(row);
  if (mime.startsWith("image/") || mime.startsWith("audio/") || mime.startsWith("video/")) {
    return false;
  }
  const action = text(row.tool_action).toLowerCase();
  if (action === "canvas_draw") return false;
  const size = Number(row.file_size);
  if (Number.isFinite(size) && size > RECORD_HYDRATE_MAX_BYTES) return false;
  if (mime && !(mime.includes("json") || mime.includes("jsonl") || mime.startsWith("text/"))) {
    return false;
  }
  return true;
}

export function storedRecordHydratePriority(row: StoredRecordPowRow): number {
  const kind = storedRecordFileKind(row);
  if (kind === "behavior_chunk" || kind === "rollup") return 0;
  if (kind === "facial" || kind === "transcript") return 1;
  if (kind === "eeg") return 2;
  return 3;
}

export function parseBehaviorJsonl(textBody: string): BehaviorSample[] {
  const samples: BehaviorSample[] = [];
  for (const line of textBody.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      const sample = asBehaviorSample(parsed);
      if (sample) samples.push(sample);
    } catch {
      /* skip a broken line */
    }
  }
  return samples;
}

function asBehaviorSample(value: unknown): BehaviorSample | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const rec = value as Record<string, unknown>;
  const stream = text(rec.stream);
  if (!stream) return null;
  const t = Number(rec.t);
  const seq = Number(rec.seq);
  const body: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(rec)) {
    if (!ENVELOPE_KEYS.has(key)) body[key] = entry;
  }
  return {
    t: Number.isFinite(t) ? t : 0,
    sid: text(rec.sid),
    hid: rec.hid == null ? null : text(rec.hid) || null,
    seq: Number.isFinite(seq) ? seq : 0,
    stream,
    ...body,
  };
}

function sampleFromParsed(
  value: unknown,
  fallbackStream: string,
  timestampMs: number | null,
): StoredRecordSample[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => sampleFromParsed(item, fallbackStream, timestampMs));
  }
  const asSample = asBehaviorSample(value);
  if (asSample) return [toStoredSample(asSample)];
  if (value && typeof value === "object") {
    const rec = value as Record<string, unknown>;
    if (Array.isArray(rec.data)) {
      return rec.data.flatMap((item, index) => {
        if (item && typeof item === "object" && !Array.isArray(item)) {
          return [
            {
              t: timestampMs ?? index,
              seq: index,
              sid: text(rec.session_id),
              hid: null,
              stream: fallbackStream,
              body: item as Record<string, unknown>,
            },
          ];
        }
        return [];
      });
    }
    return [
      {
        t: Number(rec.t ?? rec.timestamp_ms ?? timestampMs) || 0,
        seq: Number(rec.seq) || 0,
        sid: text(rec.sid || rec.session_id),
        hid: rec.hid == null ? null : text(rec.hid) || null,
        stream: text(rec.stream) || fallbackStream,
        body: rec,
      },
    ];
  }
  return [];
}

function toStoredSample(sample: BehaviorSample): StoredRecordSample {
  const body: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(sample)) {
    if (!ENVELOPE_KEYS.has(key)) body[key] = value;
  }
  return {
    t: sample.t,
    seq: sample.seq,
    sid: sample.sid,
    hid: sample.hid,
    stream: sample.stream,
    body,
  };
}

function looksLikeJsonl(textBody: string): boolean {
  const trimmed = textBody.trim();
  if (!trimmed.includes("\n")) return false;
  const first = trimmed.split(/\r?\n/).find((line) => line.trim());
  return Boolean(first?.startsWith("{"));
}

function ingestBody(
  row: StoredRecordPowRow,
  textBody: string,
): { samples: StoredRecordSample[]; rollup: Record<string, unknown> | null } {
  const kind = storedRecordFileKind(row);
  const fallback = kind === "facial" ? "facial" : kind === "eeg" ? "eeg" : kind === "transcript" ? "speech" : text(row.tool_name) || "tool";
  if (looksLikeJsonl(textBody) || kind === "behavior_chunk") {
    const jsonl = parseBehaviorJsonl(textBody);
    if (jsonl.length) return { samples: jsonl.map(toStoredSample), rollup: null };
  }
  try {
    const parsed = JSON.parse(textBody) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const rec = parsed as Record<string, unknown>;
      if (text(rec.schema) === BEHAVIOR_ROLLUP_SCHEMA || kind === "rollup") {
        return { samples: [], rollup: rec };
      }
    }
    return { samples: sampleFromParsed(parsed, fallback, row.timestamp_ms ?? null), rollup: null };
  } catch {
    return { samples: [], rollup: null };
  }
}

export async function loadStoredRecordBodies(
  rows: readonly StoredRecordPowRow[],
  getText: (fileId: string) => Promise<string | null>,
): Promise<Record<string, string>> {
  const ranked = [...rows]
    .filter(shouldHydrateStoredRecordFile)
    .sort((a, b) => storedRecordHydratePriority(a) - storedRecordHydratePriority(b))
    .slice(0, RECORD_HYDRATE_MAX_FILES);
  const bodies: Record<string, string> = {};
  await Promise.all(
    ranked.map(async (row) => {
      const id = text(row.xai_file_id);
      if (!id) return;
      try {
        const body = await getText(id);
        if (!body) return;
        if (body.length > RECORD_HYDRATE_MAX_BYTES) return;
        bodies[id] = body;
      } catch {
        /* leave unhydrated */
      }
    }),
  );
  return bodies;
}

export function presentStoredRecord(input: {
  rows: readonly StoredRecordPowRow[];
  bodies?: Record<string, string> | null;
  filePath?: string | null;
}): StoredRecordView {
  const filePath = text(input.filePath);
  const bodies = input.bodies ?? {};
  const files: StoredRecordFile[] = [];
  const collected: StoredRecordSample[] = [];
  let rollup: Record<string, unknown> | null = null;

  for (const row of input.rows) {
    const kind = storedRecordFileKind(row);
    const id = text(row.xai_file_id) || null;
    const hydratedText = id ? bodies[id] : undefined;
    const hydrated = typeof hydratedText === "string" && hydratedText.length > 0;
    const meta = row.metadata && typeof row.metadata === "object" ? row.metadata : null;
    const schema = text(meta?.schema) || (kind === "behavior_chunk" ? BEHAVIOR_SCHEMA : null);
    const metaStreams = Array.isArray(meta?.streams)
      ? meta.streams.filter((item): item is string => typeof item === "string")
      : [];
    const sampleCountRaw = Number(meta?.sample_count);
    files.push({
      kind,
      type: text(row.type || row.proof_of_work_type) || "tool",
      tool_name: text(row.tool_name) || null,
      tool_action: text(row.tool_action) || null,
      timestamp_ms: Number.isFinite(Number(row.timestamp_ms)) ? Number(row.timestamp_ms) : null,
      file_name: text(row.payload) || text((row as { file_name?: string }).file_name) || null,
      mime_type: mimeOf(row) || null,
      xai_file_id: id,
      file_size: Number.isFinite(Number(row.file_size)) ? Number(row.file_size) : null,
      schema,
      streams: metaStreams,
      sample_count: Number.isFinite(sampleCountRaw) ? sampleCountRaw : null,
      hydrated,
      href: kind === "person_media" || !id || !filePath ? null : `${filePath}?fileId=${encodeURIComponent(id)}`,
    });
    if (!hydrated || !hydratedText) continue;
    const ingested = ingestBody(row, hydratedText);
    if (ingested.rollup && !rollup) rollup = ingested.rollup;
    collected.push(...ingested.samples);
  }

  collected.sort((a, b) => a.t - b.t || a.seq - b.seq);
  const perStreamShown = new Map<string, number>();
  const shown: StoredRecordSample[] = [];
  for (const sample of collected) {
    const used = perStreamShown.get(sample.stream) ?? 0;
    if (used >= RECORD_MAX_SAMPLES_PER_STREAM) continue;
    if (shown.length >= RECORD_MAX_SAMPLES) break;
    perStreamShown.set(sample.stream, used + 1);
    shown.push(sample);
  }

  const counts = new Map<string, { count: number; t0: number | null; t1: number | null }>();
  for (const sample of collected) {
    const prev = counts.get(sample.stream) ?? { count: 0, t0: null, t1: null };
    prev.count += 1;
    prev.t0 = prev.t0 == null ? sample.t : Math.min(prev.t0, sample.t);
    prev.t1 = prev.t1 == null ? sample.t : Math.max(prev.t1, sample.t);
    counts.set(sample.stream, prev);
  }

  const grouped = new Map<string, StoredRecordSample[]>();
  for (const sample of shown) {
    const list = grouped.get(sample.stream) ?? [];
    list.push(sample);
    grouped.set(sample.stream, list);
  }

  const known = new Set<string>(BEHAVIOR_STREAMS);
  const streamOrder = [...BEHAVIOR_STREAMS, ...[...counts.keys()].filter((name) => !known.has(name))];
  const streams: StoredRecordStream[] = [];
  for (const name of streamOrder) {
    const stats = counts.get(name);
    if (!stats) continue;
    streams.push({
      stream: name,
      count: stats.count,
      shown: grouped.get(name)?.length ?? 0,
      t0: stats.t0,
      t1: stats.t1,
      samples: grouped.get(name) ?? [],
    });
  }

  return {
    sample_count: collected.length,
    shown_count: shown.length,
    truncated: shown.length < collected.length,
    streams,
    files,
    rollup,
  };
}

export function storedRecordStreamLabel(stream: string): string {
  return stream.replace(/_/g, " ");
}
