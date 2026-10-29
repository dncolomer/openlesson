/**
 * Server-side fetch of a public http(s) file for content-block ingest.
 */

import { isValidHttpUrl } from "@/lib/workspace-external-resources";
import {
  isHeliosAllowedMimeType,
  normalizeHeliosFileMime,
} from "@/lib/workspace-helios-files";
import { MAP_BLOCK_MAX_FILE_BYTES } from "@/lib/map-block-files";

const BLOCKED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "[::1]",
]);

function hostIsPrivate(hostname: string): boolean {
  const host = hostname.trim().toLowerCase();
  if (BLOCKED_HOSTS.has(host)) return true;
  if (host.endsWith(".localhost")) return true;
  if (/^10\.\d+\.\d+\.\d+$/.test(host)) return true;
  if (/^192\.168\.\d+\.\d+$/.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(host)) return true;
  if (/^169\.254\.\d+\.\d+$/.test(host)) return true;
  return false;
}

function fileNameFromUrl(url: string, fallback: string): string {
  try {
    const path = new URL(url).pathname;
    const leaf = decodeURIComponent(path.split("/").filter(Boolean).pop() || "");
    if (leaf && /\.[a-z0-9]{2,8}$/i.test(leaf)) return leaf.slice(0, 180);
  } catch {
    /* ignore */
  }
  return fallback || "download";
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export type FetchedPublicFile = {
  name: string;
  mimeType: string;
  data: string;
  byteLength: number;
};

export async function fetchPublicFileAsBase64(
  url: string,
  opts?: { name?: string; timeoutMs?: number },
): Promise<FetchedPublicFile> {
  const rawUrl = String(url || "").trim();
  if (!rawUrl || !isValidHttpUrl(rawUrl)) {
    throw new Error("A public http(s) URL is required");
  }
  const parsed = new URL(rawUrl);
  if (hostIsPrivate(parsed.hostname)) {
    throw new Error("That URL is not allowed");
  }
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    opts?.timeoutMs ?? 15_000,
  );
  try {
    const res = await fetch(rawUrl, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: "application/pdf,text/plain,text/markdown,image/*,*/*;q=0.8",
        "User-Agent": "OpenLessonBot/1.0 (+https://openlesson.app; map-block-file)",
      },
    });
    if (!res.ok) throw new Error(`Could not download file (${res.status})`);
    const hintedName =
      String(opts?.name || "").trim() || fileNameFromUrl(rawUrl, "download");
    const mimeType = normalizeHeliosFileMime(
      hintedName,
      res.headers.get("content-type") || "",
    );
    if (!isHeliosAllowedMimeType(mimeType)) {
      throw new Error("That file type is not supported.");
    }
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength > MAP_BLOCK_MAX_FILE_BYTES) {
      throw new Error("File is too large (10 MB).");
    }
    if (buf.byteLength === 0) throw new Error("File was empty");
    return {
      name: hintedName,
      mimeType,
      data: bytesToBase64(buf),
      byteLength: buf.byteLength,
    };
  } finally {
    clearTimeout(timer);
  }
}
