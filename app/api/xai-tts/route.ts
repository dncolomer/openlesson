import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedProductUser } from "@/lib/api/require-auth";

export const runtime = "nodejs";
export const maxDuration = 30;

const XAI_TTS_URL = "https://api.x.ai/v1/tts";
const DEFAULT_VOICE = "leo"; // warm, friendly — fits a tutor greeting

/**
 * Server-side proxy for xAI's Text-to-Speech endpoint. Keeps the API key
 * off the client and caches repeated identical requests for a day.
 *
 * Request body:
 *   { text: string, voiceId?: string, language?: string }
 *
 * Response: MP3 audio stream (audio/mpeg).
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuthenticatedProductUser();
  if (!auth.ok) return auth.response;

  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    return jsonError(501, "XAI_API_KEY not configured");
  }

  let body: { text?: unknown; voiceId?: unknown; language?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid JSON body");
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) {
    return jsonError(400, "Missing text");
  }
  // xAI limit is 15k chars; we cap defensively.
  if (text.length > 15000) {
    return jsonError(400, "Text exceeds 15000 character limit");
  }

  const voiceId =
    typeof body.voiceId === "string" && body.voiceId.length > 0
      ? body.voiceId
      : DEFAULT_VOICE;
  const language =
    typeof body.language === "string" && body.language.length > 0
      ? body.language
      : "auto";

  try {
    const response = await fetch(XAI_TTS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        voice_id: voiceId,
        language,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error("[xai-tts] upstream error", response.status, errorText);
      return jsonError(502, `xAI TTS error: ${response.status}`);
    }

    const audio = await response.arrayBuffer();
    return new NextResponse(audio, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": audio.byteLength.toString(),
        // Identical payloads are safe to cache for a day.
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (err) {
    console.error("[xai-tts] error", err);
    return jsonError(500, "Internal server error");
  }
}
