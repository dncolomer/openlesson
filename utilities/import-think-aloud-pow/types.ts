import type { IleSystem1Action, IleSystem2Action, IleTraceType } from "@/lib/ile-thought-traces";
import type { UploadWorkspaceProofOfWorkInput } from "@/lib/pow-api/upload-workspace-proof-of-work";

/** Word-level STT timing. `start` / `end` are seconds from media t=0 (xAI STT). */
export type ThinkAloudWord = {
  text: string;
  start: number;
  end: number;
};

export type ThinkAloudTranscript = {
  text?: string;
  duration?: number;
  words?: ThinkAloudWord[];
};

export type IleSoloSpeechStartEvent = {
  kind: "speech_start";
  timestampMs: number;
  segmentId: string;
};

export type IleSoloSpeechStopEvent = {
  kind: "speech_stop";
  timestampMs: number;
  segmentId: string;
  durationMs?: number;
  transcriptSnapshot?: string;
};

export type IleSoloSpeechEvent = IleSoloSpeechStartEvent | IleSoloSpeechStopEvent;

export type IleSoloThoughtEvent = {
  kind: "thought";
  timestampMs: number;
  thoughtId: string;
  thoughtIds?: string[];
  chainId: string;
  text: string;
  traceType: IleTraceType;
  action: IleSystem1Action | IleSystem2Action;
  combined?: boolean;
};

export type IleSoloIdleEvent = {
  kind: "idle";
  timestampMs: number;
  idleDurationMs: number;
};

export type IleSoloTimelineEvent = IleSoloSpeechEvent | IleSoloThoughtEvent | IleSoloIdleEvent;

export type System2Promotion = {
  thought_id: string;
};

export type System2EndOfChain = {
  thought_ids: string[];
  text?: string;
};

/** xAI-shaped Solo System 2 inference. Applied automatically (no operator loop). */
export type System2Inference = {
  promotions: System2Promotion[];
  end_of_chain: System2EndOfChain | null;
};

export type IleSoloImportContext = {
  workspaceId: string;
  sessionId: string;
  blockId?: string | null;
};

export type MappedStill = {
  timestampMs: number;
  mimeType: string;
  fileName: string;
  dataBase64: string;
};

export type MappedVideoClip = {
  timestampMs: number;
  mimeType: string;
  fileName: string;
  dataBase64: string;
};

export type IleSoloUploadInput = UploadWorkspaceProofOfWorkInput & {
  type: "tool" | "screen" | "video";
  session_id: string;
  timestamp_ms: number;
  metadata: Record<string, unknown>;
};
