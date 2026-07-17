/**
 * xAI Speech-to-Text helper
 * API ref: https://docs.x.ai/developers/model-capabilities/audio/speech-to-text
 *
 * Endpoint: POST https://api.x.ai/v1/stt (multipart/form-data)
 *
 * Supported container formats (auto-detected by magic bytes):
 *   WAV, MP3, OGG, Opus, FLAC, AAC, MP4, M4A, MKV
 *
 * NOT supported: WebM. If the browser records as WebM+Opus, re-label
 * the file as .ogg / audio/ogg before sending — the raw opus frames
 * are identical. The storage layer (lib/storage.ts) and transcription
 * routes handle this re-labeling automatically.
 *
 * Max file size: 500 MB
 */

const XAI_STT_URL = "https://api.x.ai/v1/stt";

export interface TranscriptionResult {
  text: string;
  language?: string;
  duration?: number;
  words?: Array<{ text: string; start: number; end: number; speaker?: number }>;
}

interface TranscribeOptions {
  language?: string; // e.g. "en", "fr"
  format?: boolean;  // Inverse Text Normalization (numbers/currencies → written form). Requires language.
  diarize?: boolean;
  /** Per-organization xAI API key when available. */
  apiKey?: string | null;
}

/**
 * Transcribe an audio buffer using xAI's STT REST endpoint.
 * @param buffer - Audio file bytes
 * @param fileName - File name with extension (e.g. "chunk.webm" or "audio.mp3")
 * @param mimeType - MIME type (e.g. "audio/webm", "audio/mpeg")
 */
export async function transcribeAudio(
  buffer: Buffer | Uint8Array,
  fileName: string,
  mimeType: string,
  options: TranscribeOptions = {}
): Promise<TranscriptionResult | null> {
  const apiKey = options.apiKey || process.env.XAI_API_KEY;
  if (!apiKey) {
    console.error("[xai-stt] XAI_API_KEY not configured");
    return null;
  }

  try {
    const formData = new FormData();

    // Other fields must come BEFORE file (xAI requirement)
    if (options.language) formData.append("language", options.language);
    if (options.format) formData.append("format", "true");
    if (options.diarize) formData.append("diarize", "true");

    // File goes last
    const blob = new Blob([buffer as BlobPart], { type: mimeType });
    formData.append("file", blob, fileName);

    const response = await fetch(XAI_STT_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[xai-stt] Transcription failed (${response.status}):`, errorText);
      return null;
    }

    const result = (await response.json()) as TranscriptionResult;
    return result;
  } catch (err) {
    console.error("[xai-stt] Error:", err);
    return null;
  }
}

/**
 * Transcribe audio from a base64-encoded buffer.
 * Convenience wrapper for endpoints that receive base64 audio.
 */
export async function transcribeAudioBase64(
  base64Data: string,
  fileName: string,
  mimeType: string,
  options: TranscribeOptions = {}
): Promise<TranscriptionResult | null> {
  const buffer = Buffer.from(base64Data, "base64");
  return transcribeAudio(buffer, fileName, mimeType, options);
}
