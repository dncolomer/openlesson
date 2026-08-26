import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { transcribeAudio } from "@/lib/xai-stt";
import { createAdminClient } from "@/lib/supabase/admin";
import { uploadWorkspaceProofOfWork } from "@/lib/pow-api/upload-workspace-proof-of-work";
import type { AuthContext } from "@/lib/pow-api/types";
import { inferIleSoloSystem2 } from "./infer-system2";
import {
  extractEventStills,
  ffmpegAvailable,
  mediaKindFromPath,
  optionalShortVideoClip,
  readMediaBytes,
  sttUploadNameAndMime,
} from "./media";
import { mapIleSoloEventsToUploadInputs } from "./persist-map";
import { applySystem2Inference } from "./system2";
import { buildIleSoloTimeline } from "./timeline";
import type {
  IleSoloImportContext,
  IleSoloTimelineEvent,
  IleSoloUploadInput,
  ThinkAloudTranscript,
  ThinkAloudWord,
} from "./types";

export type ImportThinkAloudResult = {
  dryRun: boolean;
  persisted: number;
  events: IleSoloTimelineEvent[];
  uploads: IleSoloUploadInput[];
  ffmpeg: boolean | null;
  transcribed: boolean;
  system2Inferred: boolean;
  warnings: string[];
};

function loadTranscriptFile(path: string): ThinkAloudTranscript {
  const parsed = JSON.parse(readFileSync(path, "utf8")) as ThinkAloudTranscript;
  return parsed && typeof parsed === "object" ? parsed : {};
}

function transcriptFromStt(result: {
  text?: string;
  duration?: number;
  words?: Array<{ text: string; start: number; end: number }>;
}): ThinkAloudTranscript {
  const words: ThinkAloudWord[] = (result.words ?? [])
    .filter((word) => Number.isFinite(word.start) && Number.isFinite(word.end))
    .map((word) => ({ text: word.text, start: word.start, end: word.end }));
  return {
    text: result.text,
    duration: result.duration,
    words,
  };
}

async function transcribeMedia(mediaPath: string): Promise<ThinkAloudTranscript> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    throw new Error("XAI_API_KEY is not configured; cannot transcribe --media. Pass --transcript for a dry-run fixture.");
  }
  const { buffer } = readMediaBytes(mediaPath);
  const { fileName, mimeType } = sttUploadNameAndMime(mediaPath);
  const result = await transcribeAudio(buffer, fileName, mimeType, { apiKey });
  if (!result) {
    throw new Error("xAI STT returned no transcript");
  }
  return transcriptFromStt(result);
}

async function persistUploads(uploads: IleSoloUploadInput[], workspaceId: string): Promise<number> {
  const supabase = createAdminClient();
  const { data: workspace, error } = await supabase
    .from("workspaces")
    .select("id, user_id, organization_id, evaluation_mode, protocol_config, external_refs, title, root_topic, workspace_goal")
    .eq("id", workspaceId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!workspace) throw new Error(`Workspace not found: ${workspaceId}`);

  const auth: AuthContext = {
    user_id: workspace.user_id,
    guest_user_id: null,
    organization_id: workspace.organization_id,
    is_org_admin: false,
    key_id: "",
    scopes: ["workspaces:write"],
  };

  let persisted = 0;
  for (const input of uploads) {
    await uploadWorkspaceProofOfWork(supabase, auth, workspace, input);
    persisted += 1;
  }
  return persisted;
}

export async function runImportThinkAloud(input: {
  workspaceId: string;
  mediaPath?: string | null;
  transcriptPath?: string | null;
  sessionId?: string | null;
  blockId?: string | null;
  dryRun: boolean;
}): Promise<ImportThinkAloudResult> {
  const warnings: string[] = [];
  const context: IleSoloImportContext = {
    workspaceId: input.workspaceId,
    sessionId: input.sessionId || randomUUID(),
    blockId: input.blockId ?? null,
  };

  let transcribed = false;
  let transcript: ThinkAloudTranscript;
  if (input.transcriptPath) {
    if (!existsSync(input.transcriptPath)) {
      throw new Error(`Transcript file not found: ${input.transcriptPath}`);
    }
    transcript = loadTranscriptFile(input.transcriptPath);
  } else if (input.mediaPath) {
    if (!existsSync(input.mediaPath)) {
      throw new Error(`Media file not found: ${input.mediaPath}`);
    }
    transcript = await transcribeMedia(input.mediaPath);
    transcribed = true;
  } else {
    throw new Error("--media or --transcript is required");
  }

  let events = buildIleSoloTimeline(transcript);
  let system2Inferred = false;
  const canInfer = Boolean(process.env.XAI_API_KEY);
  if (canInfer) {
    const inference = await inferIleSoloSystem2(events);
    events = applySystem2Inference(events, inference);
    system2Inferred = true;
  } else {
    warnings.push("XAI_API_KEY missing; System 2 inference skipped (System 1 only)");
  }

  const stillTimestamps = events
    .filter((event) => event.kind === "thought" || event.kind === "speech_stop")
    .map((event) => event.timestampMs);

  let ffmpeg: boolean | null = null;
  let stills: ReturnType<typeof extractEventStills>["stills"] = [];
  let videoClip = null as ReturnType<typeof optionalShortVideoClip>;
  if (input.mediaPath && mediaKindFromPath(input.mediaPath) === "video") {
    const extracted = extractEventStills({
      mediaPath: input.mediaPath,
      timestampsMs: stillTimestamps,
    });
    ffmpeg = extracted.ffmpeg;
    stills = extracted.stills;
    if (!extracted.ffmpeg) {
      warnings.push("ffmpeg not found; skipping video stills (audio-only traces)");
    }
    videoClip = optionalShortVideoClip(input.mediaPath);
    if (!videoClip) {
      warnings.push("video file exceeds 10MB or MIME not allowed; skipping type=video clip");
    }
  } else {
    ffmpeg = ffmpegAvailable();
  }

  const uploads = mapIleSoloEventsToUploadInputs(events, context, { stills, videoClip });

  let persisted = 0;
  if (!input.dryRun) {
    persisted = await persistUploads(uploads, input.workspaceId);
  }

  return {
    dryRun: input.dryRun,
    persisted,
    events,
    uploads,
    ffmpeg,
    transcribed,
    system2Inferred,
    warnings,
  };
}
