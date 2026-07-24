import type { ProofOfWorkApiInterruption } from "@/lib/pow-api/predictive-interruption";
import type { IleBufferedScreenshot, IleProofOfWorkUploadItem } from "@/lib/ile-evidence-buffer";

export interface UploadIleProofOfWorkInput {
  workspaceId: string;
  sessionId: string;
  type: "tool" | "screen" | "eeg";
  mime_type: string;
  data: string;
  file_name?: string;
  timestamp_ms?: number;
  tool_name?: string;
  tool_action?: string;
  metadata?: Record<string, unknown>;
  band_powers?: Record<string, number> | null;
  device_name?: string | null;
  sample_count?: number | null;
  /** Shareable ILE guest link token so unauthenticated guests can upload PoW. */
  ileToken?: string;
  /** Share URL query params for param-scoped guest identity. */
  entryQueryParams?: Record<string, string | string[]>;
}

export interface UploadIleProofOfWorkResult {
  ok: boolean;
  error?: string;
  proof_of_work?: Record<string, unknown>;
  interruption?: ProofOfWorkApiInterruption;
}

export function textToBase64(text: string): string {
  if (typeof window !== "undefined" && typeof window.btoa === "function") {
    const bytes = new TextEncoder().encode(text);
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return window.btoa(binary);
  }
  return Buffer.from(text, "utf8").toString("base64");
}

export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error || new Error("Failed to read blob"));
    reader.readAsDataURL(blob);
  });
}

export async function uploadIleProofOfWork(
  input: UploadIleProofOfWorkInput,
): Promise<UploadIleProofOfWorkResult> {
  try {
    const { sessionId, ileToken, entryQueryParams, ...rest } = input;
    const res = await fetch("/api/workspace/proof-of-work", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...rest,
        session_id: sessionId,
        ...(ileToken ? { ileToken } : {}),
        ...(entryQueryParams && Object.keys(entryQueryParams).length > 0
          ? { entryQueryParams }
          : {}),
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: body?.error || `Proof-of-work upload failed (${res.status})` };
    }
    return {
      ok: true,
      proof_of_work: body.proof_of_work,
      interruption: body.interruption ?? null,
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Proof-of-work upload failed" };
  }
}

export async function uploadIleEvidenceItem(
  workspaceId: string,
  sessionId: string,
  item: IleProofOfWorkUploadItem,
  ileToken?: string,
  entryQueryParams?: Record<string, string | string[]>,
): Promise<UploadIleProofOfWorkResult> {
  return uploadIleProofOfWork({
    workspaceId,
    sessionId,
    type: item.kind,
    mime_type: item.mimeType,
    data: textToBase64(item.payload),
    file_name: item.fileName,
    timestamp_ms: item.timestampMs,
    tool_name: item.toolName,
    tool_action: item.toolAction,
    metadata: item.metadata,
    band_powers: item.bandPowers,
    device_name: item.deviceName,
    sample_count: item.sampleCount,
    ...(ileToken ? { ileToken } : {}),
    ...(entryQueryParams ? { entryQueryParams } : {}),
  });
}

export async function uploadIleScreenshot(
  workspaceId: string,
  sessionId: string,
  screenshot: IleBufferedScreenshot,
  ileToken?: string,
  entryQueryParams?: Record<string, string | string[]>,
): Promise<UploadIleProofOfWorkResult> {
  const mime = screenshot.blob.type || "image/png";
  return uploadIleProofOfWork({
    workspaceId,
    sessionId,
    type: "screen",
    mime_type: mime,
    data: await blobToBase64(screenshot.blob),
    file_name: `ile-screen-${screenshot.timestampMs}.png`,
    timestamp_ms: screenshot.timestampMs,
    metadata: { size: screenshot.blob.size },
    ...(ileToken ? { ileToken } : {}),
    ...(entryQueryParams ? { entryQueryParams } : {}),
  });
}