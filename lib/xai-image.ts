/**
 * xAI Imagine stills. Chat stays on lib/xai-client.ts.
 */

import { getChatConfig, resolveChatApiKey } from "@/lib/ai/chat";
import { IMAGINE_IMAGE_MODEL } from "@/lib/xai-models";

export type XaiImageResult =
  | { ok: true; bytes: Buffer; contentType: "image/png" | "image/jpeg" | "image/webp" }
  | { ok: false; error: string };

function sniffContentType(bytes: Buffer): "image/png" | "image/jpeg" | "image/webp" | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 12 &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

async function bytesFromUrl(url: string): Promise<Buffer | null> {
  const response = await fetch(url);
  if (!response.ok) return null;
  return Buffer.from(await response.arrayBuffer());
}

function bytesFromDataUrl(dataUrl: string): Buffer | null {
  const match = /^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/i.exec(dataUrl.trim());
  if (!match) return null;
  try {
    return Buffer.from(match[1], "base64");
  } catch {
    return null;
  }
}

function packBytes(bytes: Buffer | null): XaiImageResult {
  if (!bytes || bytes.length === 0) return { ok: false, error: "Image generation returned no bytes" };
  const contentType = sniffContentType(bytes);
  if (!contentType) return { ok: false, error: "Image generation returned an unsupported file" };
  return { ok: true, bytes, contentType };
}

type ImagineRow = {
  url?: unknown;
  b64_json?: unknown;
};

function firstImagineRow(payload: unknown): ImagineRow | null {
  if (!payload || typeof payload !== "object") return null;
  const data = (payload as { data?: unknown }).data;
  if (!Array.isArray(data) || !data[0] || typeof data[0] !== "object") return null;
  return data[0] as ImagineRow;
}

async function rowToBytes(row: ImagineRow): Promise<XaiImageResult> {
  const b64 = typeof row.b64_json === "string" ? row.b64_json.trim() : "";
  if (b64) {
    try {
      return packBytes(Buffer.from(b64, "base64"));
    } catch {
      return { ok: false, error: "Image generation returned invalid encoding" };
    }
  }
  const url = typeof row.url === "string" ? row.url.trim() : "";
  if (!url) return { ok: false, error: "Image generation returned no image" };
  if (url.startsWith("data:")) return packBytes(bytesFromDataUrl(url));
  return packBytes(await bytesFromUrl(url));
}

async function postImagine(path: string, body: Record<string, unknown>): Promise<XaiImageResult> {
  const apiKey = resolveChatApiKey();
  if (!apiKey) return { ok: false, error: "xAI API key is not configured" };
  const base = getChatConfig().baseURL.replace(/\/+$/, "");
  const response = await fetch(`${base}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    return { ok: false, error: `Image generation failed (${response.status})${text ? `: ${text.slice(0, 180)}` : ""}` };
  }
  const payload = (await response.json().catch(() => null)) as unknown;
  const row = firstImagineRow(payload);
  if (!row) return { ok: false, error: "Image generation returned no image" };
  return rowToBytes(row);
}

export async function generateXaiImage(prompt: string): Promise<XaiImageResult> {
  const text = String(prompt || "").trim();
  if (!text) return { ok: false, error: "Image prompt is required" };
  return postImagine("/images/generations", {
    model: IMAGINE_IMAGE_MODEL,
    prompt: text,
    n: 1,
    aspect_ratio: "9:16",
  });
}

export async function editXaiImage(input: {
  prompt: string;
  imageUrls: readonly string[];
}): Promise<XaiImageResult> {
  const text = String(input.prompt || "").trim();
  const urls = input.imageUrls.map((url) => String(url || "").trim()).filter(Boolean).slice(0, 5);
  if (!text) return { ok: false, error: "Image prompt is required" };
  if (urls.length === 0) return generateXaiImage(text);
  const image =
    urls.length === 1
      ? { url: urls[0], type: "image_url" }
      : urls.map((url) => ({ url, type: "image_url" }));
  return postImagine("/images/edits", {
    model: IMAGINE_IMAGE_MODEL,
    prompt: text,
    image,
    aspect_ratio: "9:16",
  });
}
