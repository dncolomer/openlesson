import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, extname, join } from "node:path";
import { MAX_WORKSPACE_PROOF_OF_WORK_BYTES } from "@/lib/pow-api/workspace-proof-of-work";
import type { MappedStill, MappedVideoClip } from "./types";

const VIDEO_EXT = new Set([".mp4", ".webm", ".mov", ".mkv", ".m4v", ".avi"]);
const AUDIO_EXT = new Set([".mp3", ".wav", ".m4a", ".aac", ".ogg", ".opus", ".flac", ".wma"]);

const MIME_BY_EXT: Record<string, string> = {
  ".mp4": "video/mp4",
  ".m4v": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".mkv": "video/x-matroska",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".ogg": "audio/ogg",
  ".opus": "audio/ogg",
  ".flac": "audio/flac",
};

export type MediaKind = "video" | "audio" | "unknown";

export function mediaKindFromPath(mediaPath: string): MediaKind {
  const ext = extname(mediaPath).toLowerCase();
  if (VIDEO_EXT.has(ext)) return "video";
  if (AUDIO_EXT.has(ext)) return "audio";
  return "unknown";
}

export function mimeFromPath(mediaPath: string): string {
  const ext = extname(mediaPath).toLowerCase();
  return MIME_BY_EXT[ext] || "application/octet-stream";
}

export function ffmpegAvailable(): boolean {
  const result = spawnSync("ffmpeg", ["-version"], { encoding: "utf8" });
  return result.status === 0;
}

export function extractEventStills(input: {
  mediaPath: string;
  timestampsMs: number[];
  maxStills?: number;
}): { stills: MappedStill[]; ffmpeg: boolean } {
  const kind = mediaKindFromPath(input.mediaPath);
  if (kind !== "video") return { stills: [], ffmpeg: ffmpegAvailable() };
  if (!ffmpegAvailable()) return { stills: [], ffmpeg: false };

  const unique = [...new Set(input.timestampsMs.filter((ms) => Number.isFinite(ms) && ms >= 0))];
  unique.sort((a, b) => a - b);
  const capped = unique.slice(0, input.maxStills ?? 24);
  const dir = mkdtempSync(join(tmpdir(), "ile-think-aloud-stills-"));
  const stills: MappedStill[] = [];
  try {
    for (const timestampMs of capped) {
      const seconds = Math.max(0, timestampMs / 1000);
      const fileName = `ile-screen-${timestampMs}.jpg`;
      const outPath = join(dir, fileName);
      const result = spawnSync(
        "ffmpeg",
        [
          "-hide_banner",
          "-loglevel",
          "error",
          "-y",
          "-ss",
          seconds.toFixed(3),
          "-i",
          input.mediaPath,
          "-frames:v",
          "1",
          "-q:v",
          "4",
          outPath,
        ],
        { encoding: "utf8" },
      );
      if (result.status !== 0 || !existsSync(outPath)) continue;
      const bytes = readFileSync(outPath);
      if (bytes.length === 0 || bytes.length > MAX_WORKSPACE_PROOF_OF_WORK_BYTES) continue;
      stills.push({
        timestampMs,
        mimeType: "image/jpeg",
        fileName,
        dataBase64: bytes.toString("base64"),
      });
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  return { stills, ffmpeg: true };
}

export function optionalShortVideoClip(mediaPath: string): MappedVideoClip | null {
  if (mediaKindFromPath(mediaPath) !== "video") return null;
  if (!existsSync(mediaPath)) return null;
  const size = statSync(mediaPath).size;
  if (size <= 0 || size > MAX_WORKSPACE_PROOF_OF_WORK_BYTES) return null;
  const mime = mimeFromPath(mediaPath);
  if (!mime.startsWith("video/")) return null;
  if (mime === "video/x-matroska") return null;
  return {
    timestampMs: 0,
    mimeType: mime,
    fileName: basename(mediaPath),
    dataBase64: readFileSync(mediaPath).toString("base64"),
  };
}

export function readMediaBytes(mediaPath: string): { buffer: Buffer; fileName: string; mimeType: string } {
  return {
    buffer: readFileSync(mediaPath),
    fileName: basename(mediaPath),
    mimeType: mimeFromPath(mediaPath),
  };
}

/** xAI STT rejects WebM; relabel identical Opus as OGG when needed. */
export function sttUploadNameAndMime(mediaPath: string): { fileName: string; mimeType: string } {
  const ext = extname(mediaPath).toLowerCase();
  if (ext === ".webm") {
    return { fileName: `${basename(mediaPath, ext)}.ogg`, mimeType: "audio/ogg" };
  }
  return { fileName: basename(mediaPath), mimeType: mimeFromPath(mediaPath) };
}

export function writeMinimalWav(targetPath: string, durationMs = 120): void {
  const sampleRate = 8000;
  const samples = Math.max(1, Math.round((durationMs / 1000) * sampleRate));
  const dataSize = samples * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
  writeFileSync(targetPath, buffer);
}
