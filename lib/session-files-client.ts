/**
 * Client helper for uploading session artifacts (facial / tool / eeg / screen)
 * via the server-side proxy at /api/session-files/upload.
 *
 * The server forwards the bytes to xAI Files and inserts a row into the
 * appropriate session_* table. xAI API key never leaves the server.
 */

export type SessionDataKind = "facial" | "tool" | "eeg" | "screen";

export interface UploadSessionFileOptions {
  sessionId: string;
  kind: SessionDataKind;
  fileName: string;
  mimeType: string;
  /** Raw content (will be base64-encoded for transport).
   *  - string: raw UTF-8 text (e.g. JSON)
   *  - Blob/ArrayBuffer/Uint8Array: raw bytes
   */
  data: Blob | ArrayBuffer | Uint8Array | string;
  timestampMs?: number;
  chunkIndex?: number;
  metadata?: Record<string, unknown>;
  // Tool-specific
  toolName?: string;
  toolAction?: string;
  // EEG-specific
  bandPowers?: Record<string, number> | null;
  deviceName?: string | null;
  sampleCount?: number;
}

export interface UploadSessionFileResult {
  success: boolean;
  xai_file_id?: string;
  error?: string;
}

async function toBase64(input: Blob | ArrayBuffer | Uint8Array | string): Promise<string> {
  let bytes: Uint8Array;

  if (typeof input === "string") {
    // Treat string as raw UTF-8 text
    bytes = new TextEncoder().encode(input);
  } else if (input instanceof Blob) {
    bytes = new Uint8Array(await input.arrayBuffer());
  } else if (input instanceof ArrayBuffer) {
    bytes = new Uint8Array(input);
  } else {
    bytes = input;
  }

  // btoa can't handle long binary strings directly — chunk it
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export async function uploadSessionFile(
  opts: UploadSessionFileOptions
): Promise<UploadSessionFileResult> {
  try {
    const base64 = await toBase64(opts.data);

    const res = await fetch("/api/session-files/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: opts.sessionId,
        kind: opts.kind,
        fileName: opts.fileName,
        mimeType: opts.mimeType,
        data: base64,
        timestampMs: opts.timestampMs,
        chunkIndex: opts.chunkIndex,
        metadata: opts.metadata,
        toolName: opts.toolName,
        toolAction: opts.toolAction,
        bandPowers: opts.bandPowers,
        deviceName: opts.deviceName,
        sampleCount: opts.sampleCount,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { success: false, error: body?.error || `HTTP ${res.status}` };
    }

    const body = (await res.json()) as { xai_file_id?: string };
    return { success: true, xai_file_id: body.xai_file_id };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
