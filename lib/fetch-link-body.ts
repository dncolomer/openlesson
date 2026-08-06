/**
 * Server-side best-effort fetch of linked page body text for create-time
 * attach context. Degrades to null on timeout/network/non-HTML — never throws.
 */

import {
  isValidHttpUrl,
  normalizeLinkBodyText,
} from "@/lib/workspace-external-resources";

const DEFAULT_TIMEOUT_MS = 6_000;
const DEFAULT_MAX_BYTES = 400_000;

export type FetchLinkBodyOptions = {
  /** Injectable fetch for tests. */
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxBytes?: number;
  /** User-Agent for polite crawlers. */
  userAgent?: string;
};

/**
 * Fetch a URL and return normalized plain-text body (or null on failure).
 * Safe for create APIs: never throws; empty body → null.
 */
export async function fetchLinkBodyText(
  url: string,
  opts: FetchLinkBodyOptions = {},
): Promise<string | null> {
  const rawUrl = String(url || "").trim();
  if (!rawUrl || !isValidHttpUrl(rawUrl)) return null;

  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;
  const fetchImpl = opts.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetchImpl(rawUrl, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
        "User-Agent":
          opts.userAgent ||
          "OpenLessonBot/1.0 (+https://openlesson.app; attach-context)",
      },
    });
    if (!res.ok) return null;
    const ctype = (res.headers.get("content-type") || "").toLowerCase();
    // Skip binary / non-text
    if (
      ctype &&
      !ctype.includes("text/") &&
      !ctype.includes("html") &&
      !ctype.includes("json") &&
      !ctype.includes("xml")
    ) {
      return null;
    }
    // Cap body size without loading unbounded buffers
    const reader = res.body?.getReader?.();
    if (!reader) {
      const text = await res.text();
      const clipped = text.slice(0, maxBytes);
      const normalized = normalizeLinkBodyText(clipped);
      return normalized || null;
    }
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        total += value.byteLength;
        if (total >= maxBytes) break;
      }
    }
    try {
      reader.cancel();
    } catch {
      /* ignore */
    }
    const buf = new Uint8Array(Math.min(total, maxBytes));
    let offset = 0;
    for (const c of chunks) {
      const n = Math.min(c.byteLength, buf.byteLength - offset);
      if (n <= 0) break;
      buf.set(c.subarray(0, n), offset);
      offset += n;
    }
    const text = new TextDecoder("utf-8", { fatal: false }).decode(
      buf.subarray(0, offset),
    );
    const normalized = normalizeLinkBodyText(text);
    return normalized || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
