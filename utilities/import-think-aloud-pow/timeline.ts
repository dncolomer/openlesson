import {
  ILE_IMPORT_AUTO_STASH_MS,
  ILE_IMPORT_CHAIN_GAP_MS,
  ILE_IMPORT_IDLE_MS,
  ILE_IMPORT_SPEECH_GAP_MS,
} from "./constants";
import type {
  IleSoloTimelineEvent,
  ThinkAloudTranscript,
  ThinkAloudWord,
} from "./types";

type NormalizedWord = {
  text: string;
  startMs: number;
  endMs: number;
};

type SpeechSegment = {
  id: string;
  words: NormalizedWord[];
  startMs: number;
  endMs: number;
  text: string;
};

function secondsToMs(value: number): number {
  return Math.round(value * 1000);
}

function normalizeWords(words: ThinkAloudWord[] | undefined): NormalizedWord[] {
  if (!Array.isArray(words)) return [];
  const out: NormalizedWord[] = [];
  for (const word of words) {
    const text = String(word?.text || "").replace(/\s+/g, " ").trim();
    if (!text) continue;
    if (!Number.isFinite(word.start) || !Number.isFinite(word.end)) continue;
    const startMs = secondsToMs(word.start);
    const endMs = secondsToMs(word.end);
    out.push({
      text,
      startMs: Math.min(startMs, endMs),
      endMs: Math.max(startMs, endMs),
    });
  }
  out.sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);
  return out;
}

function joinSegmentText(words: NormalizedWord[]): string {
  return words
    .map((word) => word.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildSpeechSegments(words: NormalizedWord[]): SpeechSegment[] {
  const segments: SpeechSegment[] = [];
  let current: SpeechSegment | null = null;
  let index = 0;
  for (const word of words) {
    if (!current) {
      current = {
        id: `seg_${index}`,
        words: [word],
        startMs: word.startMs,
        endMs: word.endMs,
        text: word.text,
      };
      continue;
    }
    const gap = word.startMs - current.endMs;
    if (gap >= ILE_IMPORT_SPEECH_GAP_MS) {
      current.text = joinSegmentText(current.words);
      segments.push(current);
      index += 1;
      current = {
        id: `seg_${index}`,
        words: [word],
        startMs: word.startMs,
        endMs: word.endMs,
        text: word.text,
      };
    } else {
      current.words.push(word);
      current.endMs = Math.max(current.endMs, word.endMs);
    }
  }
  if (current) {
    current.text = joinSegmentText(current.words);
    segments.push(current);
  }
  return segments;
}

function fallbackSegment(transcript: ThinkAloudTranscript): SpeechSegment[] {
  const text = String(transcript.text || "").replace(/\s+/g, " ").trim();
  if (!text) return [];
  const durationMs =
    typeof transcript.duration === "number" && Number.isFinite(transcript.duration)
      ? secondsToMs(transcript.duration)
      : 0;
  return [
    {
      id: "seg_0",
      words: [{ text, startMs: 0, endMs: durationMs }],
      startMs: 0,
      endMs: durationMs,
      text,
    },
  ];
}

function mediaDurationMs(transcript: ThinkAloudTranscript, lastEndMs: number): number | null {
  if (typeof transcript.duration === "number" && Number.isFinite(transcript.duration)) {
    return Math.max(secondsToMs(transcript.duration), lastEndMs);
  }
  return null;
}

function emitIdleEvents(fromMs: number, toMs: number): IleSoloTimelineEvent[] {
  const events: IleSoloTimelineEvent[] = [];
  let elapsed = 0;
  let t = fromMs;
  while (t + ILE_IMPORT_IDLE_MS <= toMs) {
    t += ILE_IMPORT_IDLE_MS;
    elapsed += ILE_IMPORT_IDLE_MS;
    events.push({
      kind: "idle",
      timestampMs: t,
      idleDurationMs: elapsed,
    });
  }
  return events;
}

function eventRank(event: IleSoloTimelineEvent): number {
  if (event.kind === "speech_start") return 0;
  if (event.kind === "speech_stop") return 1;
  if (event.kind === "thought") {
    return event.traceType === "system2" ? 4 : 2;
  }
  return 3;
}

export function sortIleSoloTimeline(events: IleSoloTimelineEvent[]): IleSoloTimelineEvent[] {
  return events.slice().sort((a, b) => {
    if (a.timestampMs !== b.timestampMs) return a.timestampMs - b.timestampMs;
    return eventRank(a) - eventRank(b);
  });
}

/**
 * Build ILE Explore Solo timeline from a timed transcript.
 * Every utterance is System 1 first. Speech gaps use 2600ms; auto-stash 5000ms; idle 60000ms.
 * Timestamps are media-relative milliseconds (not write-time).
 */
export function buildIleSoloTimeline(transcript: ThinkAloudTranscript): IleSoloTimelineEvent[] {
  const words = normalizeWords(transcript.words);
  const segments = words.length > 0 ? buildSpeechSegments(words) : fallbackSegment(transcript);
  if (segments.length === 0) return [];

  const events: IleSoloTimelineEvent[] = [];
  let lastThoughtTimestampMs = Number.NEGATIVE_INFINITY;
  let chainSerial = 0;
  let chainId = `chain_${chainSerial}`;
  const lastEnd = segments[segments.length - 1].endMs;
  const durationMs = mediaDurationMs(transcript, lastEnd);

  for (let i = 0; i < segments.length; i += 1) {
    const segment = segments[i];
    const nextStart = i + 1 < segments.length ? segments[i + 1].startMs : durationMs;
    const silenceAfter =
      typeof nextStart === "number" ? Math.max(0, nextStart - segment.endMs) : 0;
    const action = silenceAfter >= ILE_IMPORT_AUTO_STASH_MS ? "auto_stash" : "pause_finalize";

    events.push({
      kind: "speech_start",
      timestampMs: segment.startMs,
      segmentId: segment.id,
    });
    events.push({
      kind: "speech_stop",
      timestampMs: segment.endMs,
      segmentId: segment.id,
      durationMs: Math.max(0, segment.endMs - segment.startMs),
      transcriptSnapshot: segment.text,
    });

    if (segment.endMs - lastThoughtTimestampMs > ILE_IMPORT_CHAIN_GAP_MS) {
      chainSerial += 1;
      chainId = `chain_${chainSerial}`;
    }
    lastThoughtTimestampMs = segment.endMs;

    events.push({
      kind: "thought",
      timestampMs: segment.endMs,
      thoughtId: `t${i}`,
      chainId,
      text: segment.text,
      traceType: "system1",
      action,
    });

    if (typeof nextStart === "number") {
      events.push(...emitIdleEvents(segment.endMs, nextStart));
    }
  }

  return sortIleSoloTimeline(events);
}
